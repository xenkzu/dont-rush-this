import { initPretext, getLineRegistry, getWordRegistry } from './pretext-bridge.js'
import { initRenderer } from './renderer.js'
import { initInput } from './input.js'
import { updateStability, getStabilityLabel, getStabilityIndex } from './stability.js'
import { initPhysics, detachWord, physicsReady, applyCursorForce,
         setRecoveryMode, isCursorIdle } from './physics.js'
import { updateRecovery, isRecoveringNow, isRecoveryComplete,
         resetRecoveryGate } from './recovery.js'

// ── Preloader refs ─────────────────────────────────────────
const preloader       = document.getElementById('preloader')
const preloaderText   = document.getElementById('preloader-text')
const preloaderSub    = document.getElementById('preloader-sub')
const preloaderCircle = document.getElementById('preloader-circle-path')
const preloaderStatus = document.getElementById('preloader-status')
const hint            = document.getElementById('onboarding-hint')

// ── HUD spring state ───────────────────────────────────────
const _initSP  = window.scrollY /
  Math.max(document.body.scrollHeight - window.innerHeight, 1)
const _initTH  = Math.max(8, 120 *
  (window.innerHeight / Math.max(document.body.scrollHeight, 1)))

let hudBubbleWidth  = 140  // non-zero start prevents blooming from 0 on load
let hudTargetWidth  = 0
const _measureCtx   = document.createElement('canvas').getContext('2d')

function measureLabel(text) {
  _measureCtx.font = '9px "DM Mono", monospace'
  const baseWidth = _measureCtx.measureText(text).width
  // letter-spacing: 0.10em at 9px = 0.9px per character
  // canvas measureText ignores CSS letter-spacing — add it manually
  const letterSpacingPx = 9 * 0.10
  return baseWidth + (text.length * letterSpacingPx)
}

let hudThumbHeight = _initTH
let hudThumbTop    = _initSP * (120 - _initTH)
let hudBubbleY     = 0
let hudLabelOp     = 1
let hudLabelOpTarget = 1
let hudShakeX      = 0
let hudShakeY      = 0
let lastLabel      = ''
let labelChanging  = false

// Smoothed chaos for visuals — prevents jitter on fill/glow
let smoothChaos    = 0

const thumbEl      = document.getElementById('hud-thumb')
const labelEl      = document.getElementById('hud-label')
const bubbleEl     = document.getElementById('hud-bubble')
const bubbleFill   = document.getElementById('hud-bubble-fill')
const bubbleBorder = document.getElementById('hud-bubble-border')
const bubbleBox    = document.getElementById('hud-bubble-box')
const connectorEl  = document.getElementById('hud-connector')
const hudEl        = document.getElementById('stability-hud')

const TRACK_H  = 120
const LABEL_H  = 21  // bubble height approx

function spring(cur, tar, rate) {
  return cur + (tar - cur) * rate
}

function setProgress(pct, status) {
  if (preloaderCircle) {
    // Circle circumference is ~88 (2 * PI * 14)
    const offset = 88 - (88 * (pct / 100))
    preloaderCircle.style.strokeDashoffset = offset
  }
  if (preloaderStatus) preloaderStatus.textContent = status
}

function cubicOut(t) { return 1 - Math.pow(1 - t, 3) }
function cubicIn(t)  { return t * t * t }

// ── Preloader dismiss ──────────────────────────────────────
function dismissPreloader() {
  return new Promise(resolve => {
    if (!preloader) { resolve(); return }

    preloader.style.opacity = '0'
    preloader.style.pointerEvents = 'none'

    // Reveal article
    document.body.classList.remove('is-loading')

    // Seed and show HUD only after preloader dismisses
    const sp  = window.scrollY /
      Math.max(document.body.scrollHeight - window.innerHeight, 1)
    const th  = Math.max(8, 120 *
      (window.innerHeight / Math.max(document.body.scrollHeight, 1)))
    const tt  = sp * (120 - th)
    const top = window.innerHeight / 2 - 60
    const by  = top + tt + th / 2 - 11

    hudThumbHeight = th
    hudThumbTop    = tt
    hudBubbleY     = by
    hudBubbleWidth = 140

    const bEl = document.getElementById('hud-bubble')
    const tEl = document.getElementById('hud-thumb')
    if (bEl) bEl.style.transform = `translateY(${by.toFixed(2)}px)`
    if (tEl) {
      tEl.style.top    = tt.toFixed(2) + 'px'
      tEl.style.height = th.toFixed(2) + 'px'
    }

    // Now reveal HUD — position is already correct
    const _hudEl = document.getElementById('stability-hud')
    if (_hudEl) _hudEl.style.opacity = '1'

    setTimeout(() => {
      preloader.style.display = 'none'
      resolve()
    }, 2200)
  })
}

// ── Onboarding hint ────────────────────────────────────────
function showHintAfterDelay() {
  setTimeout(() => {
    if (!hint) return
    hint.style.opacity   = '1'
    hint.style.transform = 'translateY(0)'

    setTimeout(() => {
      hint.style.opacity   = '0'
      hint.style.transform = 'translateY(100%)'
    }, 4000)
  }, 4000)
}

// ── Boot ───────────────────────────────────────────────────
async function boot() {
  // Animate text in after short delay
  setTimeout(() => {
    if (preloaderText) {
      preloaderText.style.opacity   = '1'
      preloaderText.style.transform = 'translateY(0)'
    }
    if (preloaderSub) preloaderSub.style.opacity = '1'
  }, 300)

  const bootStart = performance.now()

  // ── Phase 1: fonts + pretext ───────────────────────────
  setProgress(10, 'loading fonts')
  await initPretext()
  setProgress(55, 'measuring text')

  // ── Phase 2: renderer ──────────────────────────────────
  setProgress(70, 'building canvas')
  initRenderer()
  setProgress(82, 'initializing physics')

  // ── Phase 3: physics + input ───────────────────────────
  initPhysics()
  initInput()
  setProgress(95, 'ready')

  // ── Minimum display time ───────────────────────────────
  // Preloader shows for at least 2800ms so text is readable
  const elapsed = performance.now() - bootStart
  const minTime = 2800
  const remaining = Math.max(0, minTime - elapsed)

  await new Promise(r => setTimeout(r, remaining))

  setProgress(100, 'ready')

  await dismissPreloader()

  // Start systems after article is visible
  requestAnimationFrame(stabilityLoop)
  detachmentLoop()
  showHintAfterDelay()

  console.log('[main] All systems running')
}

function stabilityLoop(timestamp) {
  const si    = updateStability()
  const chaos = 1 - si

  // Smooth chaos separately — slower than stability for visual calm
  smoothChaos = spring(smoothChaos, chaos, 0.06)

  // ── Thumb ───────────────────────────────────────────────
  const scrollProgress = window.scrollY /
    Math.max(document.body.scrollHeight - window.innerHeight, 1)
  const targetThumbH   = Math.max(8, TRACK_H *
    (window.innerHeight / Math.max(document.body.scrollHeight, 1)))
  const targetThumbTop = scrollProgress * (TRACK_H - targetThumbH)

  hudThumbHeight = spring(hudThumbHeight, targetThumbH,   0.16)
  hudThumbTop    = spring(hudThumbTop,    targetThumbTop, 0.16)

  if (thumbEl) {
    thumbEl.style.height     = hudThumbHeight.toFixed(2) + 'px'
    thumbEl.style.top        = hudThumbTop.toFixed(2) + 'px'
    thumbEl.style.background = isRecoveringNow() ? 'var(--text)' : 'var(--accent)'
    thumbEl.style.opacity    = (0.25 + 0.75 * cubicOut(smoothChaos)).toFixed(3)
  }

  // ── Bubble Y — spring to thumb center ──────────────────
  const trackTop    = window.innerHeight / 2 - TRACK_H / 2
  const thumbCenter = trackTop + hudThumbTop + hudThumbHeight / 2
  const targetBubY  = thumbCenter - LABEL_H / 2

  hudBubbleY = spring(hudBubbleY, targetBubY, 0.10)

  if (bubbleEl) {
    bubbleEl.style.transform = `translateY(${hudBubbleY.toFixed(2)}px)`
  }

  // ── Green fill opacity — 0.20 at rest → 1.0 at full chaos ──
  const fillOpacity   = 0.20 + 0.80 * cubicOut(smoothChaos)
  const borderOpacity = 0.25 + 0.75 * cubicOut(smoothChaos)

  if (bubbleFill)   bubbleFill.style.opacity   = fillOpacity.toFixed(3)
  if (bubbleBorder) bubbleBorder.style.opacity = borderOpacity.toFixed(3)

  // ── Bubble width spring ─────────────────────────────────
  const measuredWidth = measureLabel(labelEl?.textContent || '') + 16
  hudTargetWidth = measuredWidth

  // Asymmetric spring — expands faster than it contracts
  const expanding   = hudTargetWidth > hudBubbleWidth
  hudBubbleWidth    = spring(
    hudBubbleWidth,
    hudTargetWidth,
    expanding ? 0.10 : 0.05
  )

  if (bubbleBox) {
    bubbleBox.style.width   = hudBubbleWidth.toFixed(2) + 'px'
    bubbleBox.style.overflow = 'hidden'
  }

  // ── Connector dot opacity with chaos ────────────────────
  if (connectorEl) {
    connectorEl.style.opacity = (0.25 + 0.75 * cubicOut(smoothChaos)).toFixed(3)
    connectorEl.style.background = isRecoveringNow() ? 'var(--text)' : 'var(--accent)'
  }

  // ── Label crossfade ─────────────────────────────────────
  const currentLabel = getStabilityLabel()

  if (currentLabel !== lastLabel && !labelChanging) {
    labelChanging    = true
    hudLabelOpTarget = 0

    setTimeout(() => {
      if (labelEl) labelEl.textContent = currentLabel
      lastLabel        = currentLabel
      hudLabelOpTarget = 1
      setTimeout(() => { labelChanging = false }, 200)
    }, 180)
  }

  hudLabelOp = spring(hudLabelOp, hudLabelOpTarget, 0.15)
  if (labelEl) labelEl.style.opacity = hudLabelOp.toFixed(3)

  // ── HUD shake + scale ───────────────────────────────────
  const scale = 1 + 0.15 * cubicOut(smoothChaos)
  hudShakeX += ((Math.random()*2-1) * cubicIn(smoothChaos) * 5 - hudShakeX) * 0.35
  hudShakeY += ((Math.random()*2-1) * cubicIn(smoothChaos) * 5 - hudShakeY) * 0.35

  if (hudEl) {
    hudEl.style.transform       =
      `translate(${hudShakeX.toFixed(2)}px,${hudShakeY.toFixed(2)}px) scale(${scale.toFixed(3)})`
    hudEl.style.transformOrigin = 'right center'
  }

  requestAnimationFrame(stabilityLoop)
}

// ── Detachment loop ────────────────────────────────────────
const CRITICAL_THRESHOLD = 0.12

function detachmentLoop(timestamp) {
  if (physicsReady()) {
    const si    = getStabilityIndex()
    const words = getWordRegistry()
    const scrollY = window.scrollY
    const viewportTop    = scrollY - 80
    const viewportBottom = scrollY + window.innerHeight + 80

    if (isRecoveryComplete()) {
      if (si < CRITICAL_THRESHOLD) {
        resetRecoveryGate()
      } else {
        requestAnimationFrame(detachmentLoop)
        return
      }
    }

    if (si < CRITICAL_THRESHOLD) {
      for (const word of words) {
        if (!word.locked || word.isPhysics) continue
        const wordScreenY = word.y
        if (wordScreenY < viewportTop || wordScreenY > viewportBottom) continue
        const threshold = CRITICAL_THRESHOLD + (Math.random() * 0.06)
        if (si < threshold) {
          detachWord(word, scrollY, {
            x: (Math.random() - 0.5) * 3,
            y: -1
          })
        }
      }
    }
  }
  requestAnimationFrame(detachmentLoop)
}

boot().catch(err => console.error('[main] Boot failed:', err))

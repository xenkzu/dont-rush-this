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

// ── HUD refs ───────────────────────────────────────────────
const hudInner = document.getElementById('hud-inner')
const hudLabel = document.getElementById('hud-label')
const hudThumb = document.getElementById('hud-thumb')

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

    setTimeout(() => {
      preloader.style.display = 'none'
      resolve()
    }, 1000)
  })
}

// ── Onboarding hint ────────────────────────────────────────
function showHintAfterDelay() {
  // Only show once per session
  if (sessionStorage.getItem('hint-shown')) return

  setTimeout(() => {
    if (!hint) return
    hint.style.opacity = '1'

    setTimeout(() => {
      hint.style.opacity = '0'
      sessionStorage.setItem('hint-shown', '1')
    }, 4000)
  }, 6000)
}

// ── Boot ───────────────────────────────────────────────────
async function boot() {
  // Skip preloader if already seen this session
  const seen = sessionStorage.getItem('preloader-shown')

  if (!seen) {
    // Animate text in after short delay
    setTimeout(() => {
      if (preloaderText) {
        preloaderText.style.opacity   = '1'
        preloaderText.style.transform = 'translateY(0)'
      }
      if (preloaderSub) preloaderSub.style.opacity = '1'
    }, 300)
  }

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
  const minTime = seen ? 0 : 2800
  const remaining = Math.max(0, minTime - elapsed)

  await new Promise(r => setTimeout(r, remaining))

  setProgress(100, 'ready')
  sessionStorage.setItem('preloader-shown', '1')

  await dismissPreloader()

  // Start systems after article is visible
  stabilityLoop()
  detachmentLoop()
  showHintAfterDelay()

  console.log('[main] All systems running')
}

// ── Stability loop ─────────────────────────────────────────
let shakeX = 0, shakeY = 0

function stabilityLoop() {
  const si    = updateStability()
  const chaos = 1 - si

  const scrollProgress = window.scrollY /
    Math.max(document.body.scrollHeight - window.innerHeight, 1)
  const thumbHeight = Math.max(8, 120 *
    (window.innerHeight / Math.max(document.body.scrollHeight, 1)))

  if (hudThumb) {
    hudThumb.style.height = thumbHeight + 'px'
    hudThumb.style.top    = (scrollProgress * (120 - thumbHeight)).toFixed(1) + 'px'
    const opacity = Math.max(0.25, 0.25 + 0.75 * cubicOut(chaos))
    hudThumb.style.opacity = opacity.toFixed(3)
    hudThumb.style.background = isRecoveringNow()
      ? 'var(--text)' : 'var(--accent)'
  }

  if (hudLabel) {
    hudLabel.textContent = getStabilityLabel()
    hudLabel.style.opacity = '1'
    hudLabel.style.color = chaos > 0.05
      ? `rgb(${Math.round(200*cubicOut(chaos))},${Math.round(255*cubicOut(chaos))},${Math.round(96*cubicOut(chaos))})`
      : 'var(--text-dim)'
  }

  const scale = 1 + 0.2 * cubicOut(chaos)
  shakeX += ((Math.random()*2-1) * cubicIn(chaos) * 6 - shakeX) * 0.4
  shakeY += ((Math.random()*2-1) * cubicIn(chaos) * 6 - shakeY) * 0.4

  if (hudInner) {
    hudInner.style.transform =
      `translate(${shakeX.toFixed(2)}px,${shakeY.toFixed(2)}px) scale(${scale.toFixed(3)})`
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

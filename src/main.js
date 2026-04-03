// main.js — boot orchestrator
import { initPretext, getLineRegistry } from './pretext-bridge.js'
import { initRenderer } from './renderer.js'
import { initInput } from './input.js'
import { updateStability, getStabilityLabel, getStabilityIndex } from './stability.js'

// HUD element refs
const hudInner = document.getElementById('hud-inner')
const hudLabel = document.getElementById('hud-label')
const hudThumb = document.getElementById('hud-thumb')

// Cubic easing — maps linear 0–1 to cubic curve
function cubicOut(t) { return 1 - Math.pow(1 - t, 3) }
function cubicIn(t)  { return t * t * t }

// Shake state
let shakeX = 0, shakeY = 0, shakeTarget = 0

function stabilityLoop() {
  const si    = updateStability()
  const chaos = 1 - si   // 0 = calm, 1 = full chaos

  // ── Scroll progress thumb ──────────────────────────────
  const docHeight = Math.max(
    document.documentElement?.scrollHeight || 1,
    document.body?.scrollHeight || 1
  )
  
  const scrollY = window.scrollY || document.documentElement?.scrollTop || 0
  const scrollProgress = scrollY / Math.max(docHeight - window.innerHeight, 1)
  
  const thumbRatio = Math.min(1, window.innerHeight / Math.max(docHeight, 1))
  const thumbHeight = Math.max(8, 120 * thumbRatio)

  if (hudThumb) {
    const maxTop = 120 - thumbHeight
    hudThumb.style.height = thumbHeight + 'px'
    hudThumb.style.top    = (scrollProgress * maxTop).toFixed(1) + 'px'
  }

  // ── Label ─────────────────────────────────────────────
  if (hudLabel) {
    hudLabel.textContent = getStabilityLabel()
    // Label color shifts from dim → accent as chaos grows
    const g = Math.round(cubicOut(chaos) * 255)
    hudLabel.style.color = `rgb(${Math.round(200 * cubicOut(chaos))}, ${g}, ${Math.round(96 * cubicOut(chaos))})`
  }

  // ── Scale: 1.0 → 1.2 cubic-mapped ────────────────────
  const scale = 1 + 0.2 * cubicOut(chaos)

  // ── Shake: random offset, magnitude cubic-mapped ──────
  shakeTarget = cubicIn(chaos) * 6   // max 6px shake at full chaos
  // Interpolate shake smoothly
  shakeX += (( Math.random() * 2 - 1) * shakeTarget - shakeX) * 0.4
  shakeY += (( Math.random() * 2 - 1) * shakeTarget - shakeY) * 0.4

  // ── Apply transform ───────────────────────────────────
  if (hudInner) {
    hudInner.style.transform =
      `translate(${shakeX.toFixed(2)}px, ${shakeY.toFixed(2)}px) scale(${scale.toFixed(3)})`
  }

  // ── Thumb color intensity ─────────────────────────────
  if (hudThumb) {
    const opacity = 0.5 + 0.5 * cubicOut(chaos)
    hudThumb.style.opacity = opacity.toFixed(3)
  }

  requestAnimationFrame(stabilityLoop)
}

async function boot() {
  try {
    console.log('[main] Booting...')
    
    console.log('[main] Initializing Pretext...')
    await initPretext()
    console.log('[main] Pretext ready. Lines:', getLineRegistry().length)

    console.log('[main] Initializing Input...')
    initInput()
    
    console.log('[main] Initializing Renderer...')
    initRenderer()
    
    console.log('[main] Starting stability loop...')
    stabilityLoop()

    console.log('[main] All systems running')
  } catch (err) {
    console.error('[main] BOOT CRITICAL FAILURE:', err)
    const label = document.getElementById('hud-label')
    if (label) label.textContent = 'BOOT ERROR: ' + err.message
  }
}

boot()

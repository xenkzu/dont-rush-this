// main.js — boot orchestrator
import { initPretext, getLineRegistry, getWordRegistry } from './pretext-bridge.js'
import { initRenderer } from './renderer.js'
import { initInput } from './input.js'
import { updateStability, getStabilityLabel, getStabilityIndex } from './stability.js'
import { initPhysics, detachWord, physicsReady } from './physics.js'
import { isRecoveringNow, isRecoveryComplete, resetRecoveryGate, getRecoveryDebugState } from './recovery.js'

// HUD element refs
const hudInner = document.getElementById('hud-inner')
const hudLabel = document.getElementById('hud-label')
const hudThumb = document.getElementById('hud-thumb')

// Cubic easing
function cubicOut(t) { return 1 - Math.pow(1 - t, 3) }
function cubicIn(t)  { return t * t * t }

function stabilityLoop() {
  const si    = updateStability()
  const chaos = 1 - si

  const docHeight = Math.max(document.documentElement?.scrollHeight || 1, document.body?.scrollHeight || 1)
  const scrollY = window.scrollY || document.documentElement?.scrollTop || 0
  const scrollProgress = scrollY / Math.max(docHeight - window.innerHeight, 1)
  const thumbRatio = Math.min(1, window.innerHeight / Math.max(docHeight, 1))
  const thumbHeight = Math.max(8, 120 * thumbRatio)

  if (hudThumb) {
    const maxTop = 120 - thumbHeight
    hudThumb.style.height = thumbHeight + 'px'
    hudThumb.style.top    = (scrollProgress * maxTop).toFixed(1) + 'px'
    
    const opacity = Math.max(0.25, 0.25 + 0.75 * cubicOut(chaos))
    hudThumb.style.opacity = opacity.toFixed(3)
    
    // Tint thumb white during recovery
    if (isRecoveringNow()) {
      hudThumb.style.background = 'var(--text)'
    } else {
      hudThumb.style.background = 'var(--accent)'
    }
  }

    // Label — always visible, always current
    if (hudLabel) {
      hudLabel.textContent = getStabilityLabel()
      hudLabel.style.opacity = '1'  // never hidden

      // Color: dim at rest, accent-tinted during chaos
      const chaosVal = cubicOut(chaos)
      const chaosColor = `rgb(
        ${Math.round(200 * chaosVal)},
        ${Math.round(255 * chaosVal)},
        ${Math.round(96  * chaosVal)}
      )`
      const restColor = 'var(--text-dim)'
      hudLabel.style.color = chaos > 0.05 ? chaosColor : restColor
    }

  if (hudInner) {
    const scale = 1 + 0.2 * cubicOut(chaos)
    const shake = cubicIn(chaos) * 6
    const sx = (Math.random() * 2 - 1) * shake
    const sy = (Math.random() * 2 - 1) * shake
    hudInner.style.transform = `translate3d(${sx}px, ${sy}px, 0) scale(${scale})`
  }

  if (Math.random() < 0.02) console.log('[recovery]', getRecoveryDebugState())
  requestAnimationFrame(stabilityLoop)
}

const CRITICAL_THRESHOLD = 0.12  // only triggers at near-maximum scroll speed

function detachmentLoop(timestamp) {
  if (physicsReady()) {
    const si = getStabilityIndex()
    const words = getWordRegistry()

    // If recovery just completed, gate is active
    // Only reset gate when stability drops to critical floor fresh
    if (isRecoveryComplete()) {
      if (si < 0.12) {
        resetRecoveryGate()  // user hit max speed again — allow detachment
      } else {
        requestAnimationFrame(detachmentLoop)
        return  // gate active — no detachment
      }
    }

    const scrollY = window.scrollY
    const viewportTop    = scrollY - 80
    const viewportBottom = scrollY + window.innerHeight + 80

    if (si < CRITICAL_THRESHOLD) {
      for (const word of words) {
        if (!word.locked || word.isPhysics) continue

        // Only words currently on screen
        const wordScreenY = word.y
        if (wordScreenY < viewportTop || wordScreenY > viewportBottom) continue

        // Detach with small random variance so they don't all go at once
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

async function boot() {
  try {
    console.log('[main] Booting...')
    await initPretext()
    initInput()
    initPhysics()
    initRenderer()
    stabilityLoop()
    detachmentLoop()
    console.log('[main] All systems running')
  } catch (err) {
    console.error('[main] BOOT CRITICAL FAILURE:', err)
    const label = document.getElementById('hud-label')
    if (label) label.textContent = 'BOOT ERROR: ' + err.message
  }
}

boot()

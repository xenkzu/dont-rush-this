// recovery.js — consent-gated word reconstruction

import { getWordRegistry } from './pretext-bridge.js'
import { getStabilityIndex } from './stability.js'
import { getWorld } from './physics.js'

// We assume Matter is globally available via index.html script tag
const { Body, World } = Matter

// Collision categories
const CAT_WORD     = 0x0001   // normal word-to-word collision
const CAT_BOUNDARY = 0x0002   // floor and walls
const CAT_GHOST    = 0x0004   // recovering word — passes through other words

function setGhostMode(body, isGhost) {
  if (isGhost) {
    Body.set(body, {
      collisionFilter: {
        category: CAT_GHOST,
        mask: CAT_BOUNDARY
      }
    })
  } else {
    Body.set(body, {
      collisionFilter: {
        category: CAT_WORD,
        mask: CAT_WORD | CAT_BOUNDARY
      }
    })
  }
}

// ── Thresholds ─────────────────────────────────────────────
const CALM_THRESHOLD   = 0.55   // was 0.45 — trigger specifically at dead body level
const CALM_DURATION_MS = 1000   // was 1500 — appear 1s after reaching dead body state
const LOCK_DISTANCE    = 0.8   // was 3.5 — only snap when nearly pixel-perfect
const LOCK_VELOCITY    = 0.3   // was 1.2 — only snap when almost completely still

// ── State ──────────────────────────────────────────────────
let calmSince          = null
let dialogVisible      = false
let recoveryGranted    = false
let recoveryActive     = false
let anyWordDetached    = false  // dialog only appears if chaos actually happened
let recoveryComplete   = false  // gates new detachment after recovery
let lastRecoveryScrollY = 0      // tracks delta to shift physics items

// ── DOM refs ───────────────────────────────────────────────
const getDialog   = () => document.getElementById('recovery-dialog')
const getBackdrop = () => getDialog()?.querySelector('div')
const getBox      = () => document.getElementById('recovery-box')
const getYesBtn   = () => document.getElementById('recovery-yes')
const getNoBtn    = () => document.getElementById('recovery-no')

let eventsAttached = false
function attachEvents() {
  if (eventsAttached) return
  const yes = getYesBtn()
  const no  = getNoBtn()
  if (!yes || !no) return

  yes.addEventListener('click', () => {
    hideDialog()
    recoveryGranted = true
    recoveryActive  = true

    const words = getWordRegistry()
    const scrollY = window.scrollY

    for (const word of words) {
      if (!word.isPhysics || !word.body) continue
      setGhostMode(word.body, true)

      // Initial kick toward target
      const targetX = word.x + word.width / 2
      const targetY = word.y - scrollY + word.lineHeight * 0.5
      const dx = targetX - word.body.position.x
      const dy = targetY - word.body.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const speed = Math.min(dist * 0.18, 28)
      const nx = dx / (dist || 1)
      const ny = dy / (dist || 1)

      Body.setVelocity(word.body, { x: nx * speed, y: ny * speed })
    }

    lastRecoveryScrollY = window.scrollY

    // Hard rescue after 5s — any word still stuck gets teleported
    setTimeout(() => {
      const currentWords = getWordRegistry()
      const currentScrollY = window.scrollY
      let rescued = 0

      for (const word of currentWords) {
        if (!word.isPhysics || !word.body) continue
        
        // Teleport to home
        Body.setPosition(word.body, {
          x: word.x + word.width / 2,
          y: word.y - currentScrollY + word.lineHeight * 0.5
        })
        Body.setVelocity(word.body, { x: 0, y: 0 })
        Body.setAngle(word.body, 0)
        Body.setAngularVelocity(word.body, 0)
        rescued++
      }

      if (rescued > 0) {
        console.log(`[recovery] Hard rescued ${rescued} stuck words`)
      }
    }, 5000)
  })

  no.addEventListener('click', () => {
    hideDialog()
    recoveryGranted = false
    recoveryActive  = false
    calmSince = null
  })

  yes.addEventListener('mouseenter', () => { yes.style.background = '#d4f570' })
  yes.addEventListener('mouseleave', () => { yes.style.background = 'var(--accent)' })
  
  eventsAttached = true
}

function showDialog() {
  if (dialogVisible) return
  attachEvents()
  dialogVisible = true
  
  const backdrop = getBackdrop()
  const box      = getBox()
  const dialog   = getDialog()
  
  if (dialog) {
    dialog.style.pointerEvents = 'all'
    dialog.style.opacity = '1'
  }
  
  if (backdrop) backdrop.style.opacity = '1'
  
  setTimeout(() => {
    if (box) {
      box.style.opacity = '1'
      box.style.transform = 'translateY(0)'
    }
  }, 350)
}

function hideDialog() {
  dialogVisible = false
  const backdrop = getBackdrop()
  const box      = getBox()
  const dialog   = getDialog()
  
  if (dialog) {
    dialog.style.pointerEvents = 'none'
    dialog.style.opacity = '0'
  }
  
  if (box) {
    box.style.opacity = '0'
    box.style.transform = 'translateY(12px)'
  }
  
  setTimeout(() => {
    if (backdrop) backdrop.style.opacity = '0'
  }, 250)
}

// ── Main update ────────────────────────────────────────────
export function updateRecovery(timestamp, scrollY) {
  // Detect scroll during recovery and shift all physics bodies
  const currentScrollY = window.scrollY
  const scrollDelta = currentScrollY - lastRecoveryScrollY
  lastRecoveryScrollY = currentScrollY

  if (recoveryActive && scrollDelta !== 0) {
    const words = getWordRegistry()
    for (const word of words) {
      if (word.isPhysics && word.body) {
        // Shift body up/down with the page scroll
        Body.setPosition(word.body, {
          x: word.body.position.x,
          y: word.body.position.y - scrollDelta
        })
      }
    }
  }

  const si    = getStabilityIndex()
  const words = getWordRegistry()

  // Check every frame — not just until first true
  const currentlyDetached = words.some(w => w.isPhysics)
  if (currentlyDetached) {
    anyWordDetached = true
    recoveryComplete = false // reset detachment gate
  }

  // ── Calm detection ─────────────────────────────────────
  if (si >= CALM_THRESHOLD && anyWordDetached && !recoveryActive) {
    if (calmSince === null) {
      calmSince = timestamp
      console.log('[recovery] Stability reached calm threshold. Timer started.')
    }
    
    const calmDuration = timestamp - calmSince
    if (calmDuration >= CALM_DURATION_MS && !dialogVisible && !recoveryGranted) {
      console.log('[recovery] Calm duration threshold met. Showing dialog.')
      showDialog()
    }
  } else if (si < 0.18) {
    // If the user starts rushing again (real chaos), we hide dialog and reset timers
    if (calmSince !== null || dialogVisible) {
      console.log('[recovery] Stability lost to extreme chaos (si < 0.18). Resetting timers.')
      calmSince = null
      recoveryGranted = false
      recoveryActive = false
      hideDialog()
    }
  }

  if (!recoveryActive) return

  const world = getWorld()
  let allLocked = true

  for (const word of words) {
    if (!word.isPhysics || !word.body) continue
    allLocked = false

    if (word.body) setGhostMode(word.body, true)

    const targetX = word.x + word.width / 2
    const targetY = word.y - scrollY + word.lineHeight * 0.5

    const pos    = word.body.position
    const vel    = word.body.velocity
    const dx     = targetX - pos.x
    const dy     = targetY - pos.y
    const dist   = Math.sqrt(dx * dx + dy * dy)
    const speed  = Math.sqrt(vel.x * vel.x + vel.y * vel.y)

    // Snap only when truly home
    if (dist < LOCK_DISTANCE && speed < LOCK_VELOCITY) {
      Body.setPosition(word.body, { x: targetX, y: targetY })
      Body.setAngle(word.body, 0)
      World.remove(world, word.body)
      word.body      = null
      word.isPhysics = false
      word.locked    = true
      word.pruned    = false
      continue
    }

    const nx = dx / (dist || 1)
    const ny = dy / (dist || 1)

    // Three zones — different behavior per zone
    if (dist > 80) {
      // ZONE 1: Far away — strong pull, light damping
      const forceMag = dist * 0.00035
      Body.applyForce(word.body, pos, { x: nx * forceMag, y: ny * forceMag })
      Body.setVelocity(word.body, { x: vel.x * 0.90, y: vel.y * 0.90 })

    } else if (dist > 12) {
      // ZONE 2: Mid range — moderate pull, heavier damping to begin braking
      const forceMag = Math.max(dist * 0.00028, 0.008)
      Body.applyForce(word.body, pos, { x: nx * forceMag, y: ny * forceMag })
      Body.setVelocity(word.body, { x: vel.x * 0.82, y: vel.y * 0.82 })

    } else {
      // ZONE 3: Final approach — no more force, only heavy braking
      // Let momentum carry it in, friction brings it to rest exactly on target
      Body.setVelocity(word.body, { x: vel.x * 0.68, y: vel.y * 0.68 })
    }

    // Rescue: if stalled mid-flight, inject minimum velocity toward target
    const expectedMinSpeed = Math.min(dist * 0.04, 3.5)
    if (speed < expectedMinSpeed && dist > LOCK_DISTANCE) {
      Body.setVelocity(word.body, {
        x: nx * expectedMinSpeed,
        y: ny * expectedMinSpeed
      })
    }

    // Angle: smooth lerp toward 0 throughout all zones
    const currentAngle   = word.body.angle
    const angleDiff      = -currentAngle
    const normalizedDiff = ((angleDiff + Math.PI) % (Math.PI * 2)) - Math.PI
    // Lerp speed increases as word gets closer — faster correction near home
    const angleLerpSpeed = dist > 40 ? 0.06 : 0.12
    Body.setAngle(word.body, currentAngle + normalizedDiff * angleLerpSpeed)
    Body.setAngularVelocity(word.body, word.body.angularVelocity * 0.85)
  }

  if (allLocked) {
    recoveryActive   = false
    recoveryGranted  = false
    anyWordDetached  = false
    calmSince        = null
    recoveryComplete = true
    console.log('[recovery] Complete.')
  }
}

export function isRecoveringNow()    { return recoveryActive }
export function isRecoveryComplete() { return recoveryComplete }
export function resetRecoveryGate()  { recoveryComplete = false }

export function getRecoveryDebugState() {
  return {
    anyWordDetached,
    dialogVisible,
    recoveryGranted,
    recoveryActive,
    recoveryComplete,
    calmSince,
    si: getStabilityIndex()
  }
}

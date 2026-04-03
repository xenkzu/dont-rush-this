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
const CALM_THRESHOLD   = 0.45   // stability must exceed this
const CALM_DURATION_MS = 1500   // for this long before dialog appears
const LOCK_DISTANCE    = 3.5
const LOCK_VELOCITY    = 1.2

// ── State ──────────────────────────────────────────────────
let calmSince          = null
let dialogVisible      = false
let recoveryGranted    = false
let recoveryActive     = false
let anyWordDetached    = false  // dialog only appears if chaos actually happened
let recoveryComplete   = false  // gates new detachment after recovery

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
      const speed = Math.min(dist * 0.12, 18)
      const nx = dx / (dist || 1)
      const ny = dy / (dist || 1)

      Body.setVelocity(word.body, { x: nx * speed, y: ny * speed })
    }
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
    const pos = word.body.position
    const vel = word.body.velocity
    const dx  = targetX - pos.x
    const dy  = targetY - pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y)

    if (dist < LOCK_DISTANCE && speed < LOCK_VELOCITY) {
      World.remove(world, word.body)
      word.body      = null
      word.isPhysics = false
      word.locked    = true
      word.pruned    = false // allow re-detach
      continue
    }

    const forceMag = Math.min(dist * 0.00018, 0.012)
    const nx = dx / (dist || 1)
    const ny = dy / (dist || 1)

    Body.applyForce(word.body, pos, { x: nx * forceMag, y: ny * forceMag })

    Body.setVelocity(word.body, { x: vel.x * 0.75, y: vel.y * 0.75 })
    Body.setAngularVelocity(word.body, word.body.angularVelocity * 0.70)
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

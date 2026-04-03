// ── Config (Tune these to change the feel) ───────────────────
const CONFIG = {
  SCROLL_SENSITIVITY: 250,    // Higher = less sensitive to scroll (try 100 or 150)
  ATTACK_STRENGTH: 0.04,  // How fast it drops into chaos (0.01 to 0.2)
  DECAY_STRENGTH: 0.005,  // How fast it recovers to calm (0.005 to 0.05)
  SIGNAL_FALLOFF: 0.97   // How fast the raw signals fade (0.90 to 0.99)
}

// ── Sarcastic label map ─────────────────────────────────────
const LABELS = [
  { threshold: 0.95, label: 'dead body' },
  { threshold: 0.80, label: 'deep meditation' },
  { threshold: 0.65, label: 'sunday morning' },
  { threshold: 0.50, label: 'sleep-deprived intern' },
  { threshold: 0.35, label: 'too much coffee' },
  { threshold: 0.20, label: 'toddler on sugar' },
  { threshold: 0.08, label: 'house fire' },
  { threshold: 0.00, label: 'full system failure' },
]

// ── State ───────────────────────────────────────────────────
let stabilityIndex = 1.0
let lastScrollY = window.scrollY || 0
let scrollVelocity = 0
let scrollDecayTimer = null
let inputDelta = 0
let motionMagnitude = 0
let lastInputTime = 0

// ── Signal Recording ─────────────────────────────────────────

export function recordScroll() {
  const currentY = window.scrollY || window.pageYOffset || document.documentElement?.scrollTop || 0
  const dy = Math.abs(currentY - lastScrollY)

  if (dy > 0) {
    // Accumulate scroll signal based on sensitivity config
    scrollVelocity = Math.min(1.0, scrollVelocity + (dy / CONFIG.SCROLL_SENSITIVITY))
  }

  lastScrollY = currentY
  clearTimeout(scrollDecayTimer)
  scrollDecayTimer = setTimeout(() => { scrollVelocity = 0 }, 150)
}

export function recordInput() {
  const now = performance.now()
  const gap = now - lastInputTime
  inputDelta = Math.min(1.0, 200 / Math.max(gap, 1))
  lastInputTime = now
}

export function recordMotion(x, y, z) {
  motionMagnitude = Math.min(Math.sqrt(x * x + y * y + z * z) / 20, 1.0)
}

// ── Engine Update ────────────────────────────────────────────

export function updateStability() {
  const rawInstability = Math.max(scrollVelocity, inputDelta, motionMagnitude)
  const targetStability = 1.0 - rawInstability

  if (targetStability < stabilityIndex) {
    // Degrading (Becoming chaotic)
    stabilityIndex += (targetStability - stabilityIndex) * CONFIG.ATTACK_STRENGTH
  } else {
    // Recovering (Becoming calm)
    stabilityIndex += (targetStability - stabilityIndex) * CONFIG.DECAY_STRENGTH
  }

  stabilityIndex = Math.max(0, Math.min(1, stabilityIndex))

  // Decay signals
  scrollVelocity *= CONFIG.SIGNAL_FALLOFF
  inputDelta *= CONFIG.SIGNAL_FALLOFF
  motionMagnitude *= CONFIG.SIGNAL_FALLOFF

  return stabilityIndex
}

export function getStabilityLabel() {
  for (const entry of LABELS) {
    if (stabilityIndex >= entry.threshold) return entry.label
  }
  return 'full system failure'
}

export function getStabilityIndex() { return stabilityIndex }

// Globally expose debugging for you to check values in F12 console
window.__stabilityDebug = () => ({
  stabilityIndex: +(+stabilityIndex).toFixed(3),
  activityLevel: Math.max(scrollVelocity, inputDelta, motionMagnitude).toFixed(3),
  config: CONFIG
})

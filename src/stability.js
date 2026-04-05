// ── Config (Tune these to change the feel) ───────────────────
const CONFIG = {
  SCROLL_SENSITIVITY: 150,    // Higher = less sensitive to scroll
  ATTACK_STRENGTH: 0.025,     // Slower drop into chaos (lets you read intermediate labels)
  DECAY_STRENGTH: 0.002,      // Slower recovery (makes states feel more permanent)
  SIGNAL_FALLOFF: 0.98        // Makes chaos linger (prevents 'flickering' back to calm)
}

// ── Sarcastic label map ─────────────────────────────────────
const LABELS = [
  { threshold: 0.95, label: 'unbothered. moisturized.' },
  { threshold: 0.80, label: 'you reading, question?' },
  { threshold: 0.65, label: 'locked in' },
  { threshold: 0.50, label: 'amaze amaze amaze' },
  { threshold: 0.35, label: 'tweaking' },
  { threshold: 0.20, label: 'crashing out' },
  { threshold: 0.08, label: 'break stuff' },
  { threshold: 0.00, label: 'damn, fumbled it' },
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

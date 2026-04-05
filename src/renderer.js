import { getLineRegistry, getWordRegistry } from './pretext-bridge.js'
import { stepPhysics, getBodyScreenPos, pruneOffscreenBodies, applyCursorForce, setRecoveryMode } from './physics.js'
import { updateRecovery, isRecoveringNow } from './recovery.js'

let canvas, ctx, dpr, width, height
let registry = []
let rafId = null
let isRunning = false
let lastTime = performance.now()
let frameCount = 0

export function initRenderer() {
  canvas = document.getElementById('main-canvas')
  if (!canvas) throw new Error('[renderer] Canvas element not found')

  resize()
  ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  // Fetch registry once — loop reads from module-level variable only
  registry = getLineRegistry()

  // Hide UI elements handled by canvas
  document.querySelectorAll('.canvas-managed').forEach(el => {
    el.style.opacity = '0'
    el.style.pointerEvents = 'none'
  })

  // Position canvas correctly
  canvas.style.position = 'fixed'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '1'

  window.addEventListener('resize', onResize)

  console.log('[renderer] Initialized.')
  isRunning = true
  rafId = requestAnimationFrame(renderLoop)
}

function resize() {
  // Cap DPR at 2 — above 2 gives no visible benefit but doubles pixel count
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = window.innerWidth
  height = window.innerHeight

  // Physical pixel dimensions
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)

  // CSS dimensions stay logical
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
}

function onResize() {
  cancelAnimationFrame(rafId)
  resize()
  ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  isRunning = true
  rafId = requestAnimationFrame(renderLoop)
}

function renderLoop(timestamp) {
  if (!isRunning) return
  drawFrame(timestamp)
  rafId = requestAnimationFrame(renderLoop)
}

function drawFrame(timestamp) {
  const delta = Math.min(timestamp - lastTime, 50) || 16// cap at 50ms fallback to 60fps
  lastTime = timestamp
  frameCount++

  stepPhysics(delta)
  setRecoveryMode(isRecoveringNow())
  applyCursorForce(getWordRegistry())
  updateRecovery(timestamp, window.scrollY)

  // Crisp subpixel rendering
  ctx.clearRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = false
  ctx.textRendering = 'geometricPrecision'
  const scrollY = window.scrollY
  const words = getWordRegistry()

  // 1. Draw all locked words in one pass — no save/restore per word
  ctx.textBaseline = 'alphabetic'
  for (const word of words) {
    if (word.isPhysics) continue
    const screenY = word.y - scrollY
    if (screenY + word.lineHeight < -100 || screenY > height + 100) continue
    ctx.font = word.fontString
    ctx.fillStyle = word.color
    // 0.76 multiplier aligns 'Instrument Serif' and 'Syne' with DOM baseline
    ctx.fillText(word.text, word.x, screenY + word.lineHeight * 0.6)
  }

  // 2. Draw physics words separately with transforms
  for (const word of words) {
    if (!word.isPhysics) continue
    const pos = getBodyScreenPos(word, 0)
    if (!pos) continue

    // Skip sleeping bodies that are settled or off screen
    const isSleeping = word.body?.isSleeping
    if (isSleeping) {
      // Culling: off screen or at the bottom floor
      if (pos.y > height - 10 || pos.y < -20) continue
    } else {
      // General cull: off screen
      if (pos.y > height + 100 || pos.y < -100) continue
    }

    ctx.save()
    ctx.translate(pos.x + word.width / 2, pos.y + word.height / 2)
    ctx.rotate(pos.angle || 0)
    ctx.font = word.fontString
    ctx.fillStyle = word.color
    ctx.textBaseline = 'alphabetic'
    // Draw relative to body center — 0.33 offset matches the 0.76 global baseline
    ctx.fillText(word.text, -word.width / 2, word.height * 0.33)
    ctx.restore()
  }
}

export function stopRenderer() {
  isRunning = false
  cancelAnimationFrame(rafId)
}

export function getCanvas() { return canvas }
export function getCtx() { return ctx }
export function getDpr() { return dpr }

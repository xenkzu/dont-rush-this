// renderer.js — canvas rendering engine
import { getLineRegistry, getWordRegistry } from './pretext-bridge.js'
import { stepPhysics, getBodyScreenPos, pruneOffscreenBodies } from './physics.js'
import { updateRecovery } from './recovery.js'

let canvas, ctx, dpr, width, height
let registry = []
let rafId = null
let isRunning = false
let lastTime = performance.now()
let frameCount = 0

export function initRenderer() {
  canvas = document.getElementById('main-canvas')
  if (!canvas) throw new Error('[renderer] Canvas element not found')

  dpr = window.devicePixelRatio || 1
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
  width = window.innerWidth
  height = window.innerHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
}

function onResize() {
  cancelAnimationFrame(rafId)
  ctx = null
  resize()
  ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
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

  // Step physics
  stepPhysics(delta)
  updateRecovery(timestamp, window.scrollY)

  // Prune fallen bodies every 60 frames (approx 1s)
  if (frameCount % 60 === 0) {
    pruneOffscreenBodies(getWordRegistry())
  }

  ctx.clearRect(0, 0, width, height)
  const scrollY = window.scrollY
  const words = getWordRegistry()

  for (const word of words) {
    if (word.isPhysics) {
      // Draw at physics body position
      const pos = getBodyScreenPos(word, 0) // physics is in screen space
      if (!pos) continue

      // Cull bottom only
      if (pos.y > height + 100) continue

      ctx.save()
      ctx.translate(
        pos.x + word.width / 2,
        pos.y + word.height / 2
      )
      ctx.rotate(pos.angle || 0)
      ctx.font = word.fontString
      ctx.fillStyle = word.color
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(word.text, -word.width / 2, word.height * 0.6)
      ctx.restore()

    } else {
      // Locked word — draw at layout position
      const screenY = word.y - scrollY
      if (screenY + word.lineHeight < -100 || screenY > height + 100) continue

      ctx.save()
      ctx.font = word.fontString
      ctx.fillStyle = word.color
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(word.text, word.x, screenY + word.lineHeight * 0.8)
      ctx.restore()
    }
  }
}

export function stopRenderer() {
  isRunning = false
  cancelAnimationFrame(rafId)
}

export function getCanvas() { return canvas }
export function getCtx() { return ctx }
export function getDpr() { return dpr }

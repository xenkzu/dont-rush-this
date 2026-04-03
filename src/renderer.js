// renderer.js — canvas rendering engine
import { getLineRegistry } from './pretext-bridge.js'

let canvas, ctx, dpr, width, height
let registry = []
let rafId = null
let isRunning = false

export function initRenderer() {
  canvas = document.getElementById('main-canvas')
  if (!canvas) throw new Error('[renderer] Canvas element not found')

  dpr = window.devicePixelRatio || 1
  resize()

  ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  // Fetch registry once — loop reads from module-level variable only
  registry = getLineRegistry()
  if (!registry.length) throw new Error('[renderer] Line registry is empty')

  // Hide DOM prose elements — renderer is now in control
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

  console.log('[renderer] Initialized.', registry.length, 'lines to render')
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

// ── SECTION 2 — Render loop ──────────────────────────────────────────────────

function renderLoop() {
  if (!isRunning) return
  drawFrame()
  rafId = requestAnimationFrame(renderLoop)
}

function drawFrame() {
  ctx.clearRect(0, 0, width, height)

  const scrollY = window.scrollY

  for (const line of registry) {
    if (line.isPhysics) continue // physics lines handled by physics.js later

    const screenY = line.y - scrollY

    // Cull lines outside viewport with buffer
    if (screenY + line.lineHeight < -100 || screenY > height + 100) continue

    ctx.save()
    ctx.font = line.fontString
    ctx.fillStyle = line.color
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(line.text, line.x, screenY + line.lineHeight * 0.8)
    ctx.restore()
  }
}

// ── SECTION 3 — Public API ───────────────────────────────────────────────────

export function stopRenderer() {
  isRunning = false
  cancelAnimationFrame(rafId)
}

export function getCanvas() { return canvas }
export function getCtx() { return ctx }
export function getDpr() { return dpr }

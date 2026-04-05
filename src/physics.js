// physics.js — Matter.js word physics

const { Engine, Render: MRender, Runner, Bodies, Body, World, Events, Vector } = Matter

let engine, world
let isReady = false

// Boundary bodies (floor + walls)
let floor, wallL, wallR

export function initPhysics() {
  engine = Engine.create({
    gravity: { x: 0, y: 1.2 },  // was 1.2 — slower fall = fewer collision spikes
    enableSleeping: true,       // bodies that stop moving go dormant
    positionIterations: 4,
    velocityIterations: 3,
    constraintIterations: 1
  })
  world = engine.world

  rebuildBoundaries()
  window.addEventListener('resize', rebuildBoundaries)

  isReady = true
  console.log('[physics] Engine ready')
}

export function setRecoveryFloor(active) {
  if (!floor) return
  const W = window.innerWidth
  const T = 60
  if (active) {
    // Move floor far below — words can travel thru it to off-screen homes
    Body.setPosition(floor, { x: W / 2, y: 99999 })
  } else {
    // Restore floor to viewport bottom
    Body.setPosition(floor, { x: W / 2, y: window.innerHeight + T / 2 })
  }
}

function rebuildBoundaries() {
  if (floor) World.remove(world, [floor, wallL, wallR])

  const W = window.innerWidth
  const H = window.innerHeight
  const T = 60  // thickness

  const boundaryFilter = {
    collisionFilter: {
      category: 0x0002,
      mask: 0x0001 | 0x0004   // collides with both WORD and GHOST
    }
  }

  floor = Bodies.rectangle(W / 2, H + T / 2, W * 3, T,
    { isStatic: true, label: 'floor', ...boundaryFilter })
  wallL = Bodies.rectangle(-T / 2, H / 2, T, H * 3,
    { isStatic: true, label: 'wall', ...boundaryFilter })
  wallR = Bodies.rectangle(W + T / 2, H / 2, T, H * 3,
    { isStatic: true, label: 'wall', ...boundaryFilter })

  World.add(world, [floor, wallL, wallR])
}

// Detach a word — give it a physics body
export function detachWord(word, scrollY, inheritVelocity = { x: 0, y: 0 }) {
  if (!isReady || word.isPhysics) return

  const screenX = word.x + word.width / 2
  const screenY = word.y - scrollY + word.height / 2

  const body = Bodies.rectangle(screenX, screenY, word.width, word.height, {
    restitution: 0.0,       // was 0.3 — zero bounce, words thud and stay
    friction: 0.8,          // was 0.6 — more friction, settle faster
    frictionAir: 0.04,      // was 0.01 — more air resistance, slower fall
    frictionStatic: 0.9,    // high static friction — stacked words don't slide
    density: 0.003,         // slightly heavier — less affected by collisions
    sleepThreshold: 30,    // frames of low velocity before sleeping
    label: word.id,
    collisionFilter: {
      category: 0x0001,
      mask: 0x0001 | 0x0002
    }
  })

  // Inherit scroll velocity so words don't just drop — they fly
  Body.setVelocity(body, {
    x: inheritVelocity.x + (Math.random() - 0.5) * 2,
    y: inheritVelocity.y - 2
  })

  World.add(world, body)
  word.body = body
  word.isPhysics = true
  word.locked = false

  return body
}

// Step physics engine — call once per RAF frame
export function stepPhysics(delta) {
  if (!isReady) return
  Engine.update(engine, delta)
}

// Get screen position of a physics word
export function getBodyScreenPos(word, scrollY) {
  if (!word.body) return null
  return {
    x: word.body.position.x - word.width / 2,
    y: word.body.position.y - word.height / 2,
    angle: word.body.angle
  }
}

// Cursor state
let cursorX = -9999
let cursorY = -9999
let lastCursorMoveTime = 0
let lastInterferenceTime = 0
let recoveryMode = false

const CURSOR_RADIUS = 80   // px — wider repulsion field radius
const CURSOR_STRENGTH = 0.5  // force magnitude

export function setRecoveryMode(active) { recoveryMode = active }
export function isCursorIdle() {
  // We've replaced 'Global Mouse Idle' with 'Local Interference Deadzone'
  // True if the cursor hasn't touched the 'aura' of a word for 400ms
  return (performance.now() - lastInterferenceTime) > 400
}

// Track cursor position globally
window.addEventListener('mousemove', e => {
  cursorX = e.clientX
  cursorY = e.clientY
  lastCursorMoveTime = performance.now()
})

window.addEventListener('mouseleave', () => {
  cursorX = -9999
  cursorY = -9999
})

export function applyCursorForce(wordRegistry) {
  if (cursorX === -9999 || recoveryMode) return

  for (const word of wordRegistry) {
    if (!word.isPhysics || !word.body) continue

    const pos = word.body.position
    const dx = pos.x - cursorX
    const dy = pos.y - cursorY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > CURSOR_RADIUS || dist < 0.1) continue

    // Wake sleeping body if cursor enters its space
    if (word.body.isSleeping) {
      Matter.Sleeping.set(word.body, false)
    }

    // Repulsion force — stronger when closer, quadratic falloff
    const normalizedDist = dist / CURSOR_RADIUS
    const strength = CURSOR_STRENGTH * Math.pow(1 - normalizedDist, 2)

    const nx = dx / dist
    const ny = dy / dist

    // User is actively interfering with this word's aura
    lastInterferenceTime = performance.now()

    Body.applyForce(word.body, pos, {
      x: nx * strength,
      y: ny * strength
    })
  }
}

export function getEngine() { return engine }
export function getWorld() { return world }
export function physicsReady() { return isReady }

export function pruneOffscreenBodies(wordRegistry) {
  const H = window.innerHeight
  for (const word of wordRegistry) {
    if (!word.isPhysics || !word.body) continue
    if (word.body.position.y > H + 200) {
      World.remove(world, word.body)
      word.body = null
      word.isPhysics = false
      word.locked = true
    }
  }
}

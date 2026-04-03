// physics.js — Matter.js word physics

const { Engine, Render: MRender, Runner, Bodies, Body, World, Events, Vector } = Matter

let engine, world
let isReady = false

// Boundary bodies (floor + walls)
let floor, wallL, wallR

export function initPhysics() {
  engine = Engine.create({
    gravity: { x: 0, y: 1.2 },
    positionIterations: 4,   // default 6 — reduce for perf
    velocityIterations: 3,   // default 4 — reduce for perf
    constraintIterations: 1  // default 2 — reduce for perf
  })
  world  = engine.world

  rebuildBoundaries()
  window.addEventListener('resize', rebuildBoundaries)

  isReady = true
  console.log('[physics] Engine ready')
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
    restitution: 0.3,
    friction: 0.6,
    frictionAir: 0.01,
    density: 0.002,
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
  word.body  = body
  word.isPhysics = true
  word.locked    = false

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

export function getEngine() { return engine }
export function getWorld()  { return world  }
export function physicsReady() { return isReady }

export function pruneOffscreenBodies(wordRegistry) {
  const H = window.innerHeight
  for (const word of wordRegistry) {
    if (!word.isPhysics || !word.body) continue
    if (word.body.position.y > H + 200) {
      World.remove(world, word.body)
      word.body      = null
      word.isPhysics = false
      word.locked    = true
    }
  }
}

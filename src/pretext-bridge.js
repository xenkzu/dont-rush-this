// pretext-bridge.js — font metric extraction & line registry
// Using @chenglou/pretext for high-performance font-agnostic text measurement
import { prepare, prepareWithSegments, layoutWithLines } from 'https://cdn.jsdelivr.net/npm/@chenglou/pretext@latest/dist/layout.js'

// Three font contexts matching design.html exactly
const FONT_CONTEXTS = [
  {
    id: 'serif-upright',
    family: 'Instrument Serif',
    size: 64,
    weight: '400',
    style: 'normal',
    letterSpacing: -0.02
  },
  {
    id: 'serif-italic',
    family: 'Instrument Serif',
    size: 64,
    weight: '400',
    style: 'italic',
    letterSpacing: -0.02
  },
  {
    id: 'sans-body',
    family: 'Syne',
    size: 64,
    weight: '400',
    style: 'normal',
    letterSpacing: 0
  }
]

let metricsCache = {}
let lineRegistry = []
let ready = false

export async function initPretext() {
  await document.fonts.ready

  for (const ctx of FONT_CONTEXTS) {
    const fontString = `${ctx.style === 'italic' ? 'italic ' : ''}${ctx.weight} ${ctx.size}px "${ctx.family}"`
    const prepared = await prepare(" ", fontString)
    metricsCache[ctx.id] = { ...ctx, metrics: prepared.font }
  }

  // STEP 2: Build the line registry after metrics are ready
  buildLineRegistry()

  ready = true
  console.log('[pretext-bridge] Font metrics ready:', Object.keys(metricsCache))
  return metricsCache
}

function resistanceFor(tagName) {
  switch (tagName.toUpperCase()) {
    case 'H1': return 0.95
    case 'H2': return 0.90
    case 'H3': return 0.85
    default: return 0.68
  }
}

function buildLineRegistry() {
  const wrapper = document.querySelector('.wrapper')
  if (!wrapper) return

  const containerWidth = wrapper.clientWidth
  const wrapperLeft = wrapper.getBoundingClientRect().left
  
  const proseElements = document.querySelectorAll('[data-prose="true"]')
  const newRegistry = []

  proseElements.forEach(el => {
    const tagName = el.tagName.toUpperCase()
    
    // Determine fontSize
    let fontSize = 16
    if (tagName === 'H1') fontSize = 57.6
    else if (tagName === 'H2') fontSize = 29.6
    else if (tagName === 'H3') fontSize = 15.2

    // Determine lineHeight
    let lineHeight = 28.8 // default for p
    if (tagName === 'H1') lineHeight = 64.5
    else if (tagName === 'H2') lineHeight = 37
    else if (tagName === 'H3') lineHeight = 24
    if (el.classList.contains('hero-lead')) lineHeight = 28

    // Determine font context & string
    let fontString = '400 16px Syne' // default
    if (tagName === 'H1' || tagName === 'H2') {
      fontString = `400 ${fontSize}px "Instrument Serif"`
    }

    // Special handling for H1 segments (EM italicization)
    let prepared
    if (tagName === 'H1') {
      const segments = []
      // Simple manual segmentation for <em> tags
      const nodes = el.childNodes
      nodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          segments.push({ text: node.textContent, font: `400 ${fontSize}px "Instrument Serif"` })
        } else if (node.tagName === 'EM') {
          segments.push({ text: node.textContent, font: `italic 400 ${fontSize}px "Instrument Serif"` })
        }
      })
      prepared = prepareWithSegments(segments)
    } else {
      prepared = prepare(el.innerText, fontString)
    }

    const lines = layoutWithLines(prepared, containerWidth, lineHeight)
    const elementTop = el.offsetTop

    lines.forEach((line, lineIndex) => {
      newRegistry.push({
        id: `${el.dataset.lineId}-L${lineIndex}`,
        text: line.text,
        width: line.width,
        x: wrapperLeft,
        y: elementTop + (lineIndex * lineHeight),
        lineHeight: lineHeight,
        fontString: fontString,
        fontSize: fontSize,
        color: getComputedStyle(el).color,
        sectionId: el.dataset.lineId,
        stabilityResistance: resistanceFor(tagName),
        isPhysics: false,
        locked: true
      })
    })
  })

  lineRegistry = newRegistry
}

export function getLineRegistry() { return lineRegistry }
export function getMetrics(contextId) { return metricsCache[contextId] }
export function isReady() { return ready }

export { layoutWithLines }

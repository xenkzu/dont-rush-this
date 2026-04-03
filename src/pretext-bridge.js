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
let wordRegistry = []
let ready = false

export async function initPretext() {
  try {
    await document.fonts.ready
    console.log('[pretext-bridge] All fonts loaded')

    for (const ctx of FONT_CONTEXTS) {
      const fontString = `${ctx.style === 'italic' ? 'italic ' : ''}${ctx.weight} ${ctx.size}px "${ctx.family}"`
      console.log('[pretext-bridge] Measuring font:', ctx.id)
      const prepared = await prepare(" ", fontString)
      
      if (prepared && prepared.font) {
        metricsCache[ctx.id] = { ...ctx, metrics: prepared.font }
      } else {
        console.warn(`[pretext-bridge] Fallback metrics for ${ctx.id}`)
        metricsCache[ctx.id] = { ...ctx, metrics: { ascent: 0.8, descent: 0.2 } }
      }
    }
  } catch (e) {
    console.error('[pretext-bridge] Metric phase failure:', e)
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

    // Determine font context & string. Avoid complex CSS fallbacks which crash the library.
    let fontString = `400 ${Math.round(fontSize)}px "Syne"`
    if (tagName === 'H1' || tagName === 'H2') {
      fontString = `400 ${Math.round(fontSize)}px "Instrument Serif"`
    }

    const textToMeasure = el.innerText || ''
    
    // Calculate EXACT bounds for this specific element, incorporating its specific grid/flex layout width
    const rect = el.getBoundingClientRect()
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0
    const elementTop = rect.top + scrollY
    const elementLeft = rect.left
    const exactWidth = el.clientWidth || rect.width

    let lines = []
    try {
      const prepared = prepare(textToMeasure, fontString)
      if (!prepared || !prepared.widths) throw new Error('Prepare failed')
      const result = layoutWithLines(prepared, exactWidth, lineHeight)
      lines = result.lines
    } catch (e) {
      console.warn('[pretext-bridge] Library layout failed, using robust Canvas tracking')
      
      // Zero-Crash Canvas Layout Engine
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      ctx.font = fontString
      
      // Basic word wrap
      const words = textToMeasure.split(/\s+/)
      let currentLine = words[0] || ''
      
      for (let i = 1; i < words.length; i++) {
        const word = words[i]
        const width = ctx.measureText(currentLine + " " + word).width
        
        // If word fits, append it
        if (width < exactWidth) {
          currentLine += " " + word
        } else {
          // Wrap to next line
          lines.push({ text: currentLine, width: ctx.measureText(currentLine).width })
          currentLine = word
        }
      }
      lines.push({ text: currentLine, width: ctx.measureText(currentLine).width })
    }

    lines.forEach((line, lineIndex) => {
      newRegistry.push({
        id: `${el.dataset.lineId}-L${lineIndex}`,
        text: line.text,
        width: line.width,
        x: elementLeft,
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
  buildWordRegistry()
}

function buildWordRegistry() {
  wordRegistry = []

  // We need a temporary offscreen canvas to measure word widths
  const measureCanvas = document.createElement('canvas')
  const mCtx = measureCanvas.getContext('2d')

  for (const line of lineRegistry) {
    const words = line.text.trim().split(/\s+/)
    let cursorX = line.x

    mCtx.font = line.fontString

    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      const wordWidth = mCtx.measureText(word).width
      const spaceWidth = i < words.length - 1
        ? mCtx.measureText(' ').width
        : 0

      // Word-level overrides (e.g., italics/color for 'rush')
      let wordFont = line.fontString
      let wordColor = line.color

      // Check for 'rush' (case insensitive, remove punctuation)
      const cleanWord = word.replace(/[.,!?;:]/g, '').toLowerCase()
      let buffer = 0
      if (cleanWord === 'rush') {
        wordColor = '#c8f060' // Green accent
        wordFont = 'italic ' + line.fontString
        buffer = 5 // Extra space for italics
      }

      wordRegistry.push({
        id: `${line.id}-W${i}`,
        text: word,
        x: cursorX,
        y: line.y,
        width: wordWidth,
        height: line.lineHeight * 0.75,
        lineHeight: line.lineHeight,
        fontString: wordFont,
        color: wordColor,
        sectionId: line.sectionId,
        stabilityResistance: line.stabilityResistance,
        isPhysics: false,
        locked: true,
        body: null
      })

      cursorX += wordWidth + spaceWidth + buffer
    }
  }

  console.log('[pretext-bridge] Word registry:', wordRegistry.length, 'words')
}

export function getWordRegistry() { return wordRegistry }

export function getLineRegistry() { return lineRegistry }
export function getMetrics(contextId) { return metricsCache[contextId] }
export function isReady() { return ready }

export { layoutWithLines }

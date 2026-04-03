import { recordScroll } from './stability.js'

export function initInput() {
  // Scroll only
  window.scrollLastTime = Date.now()
  window.addEventListener('scroll', recordScroll, { passive: true })

  console.log('[input] Scroll-only listeners attached')
}
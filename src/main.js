// main.js — boot orchestrator
import { initPretext, getLineRegistry } from './pretext-bridge.js'
import { initRenderer } from './renderer.js'

async function boot() {
  console.log('[main] Booting...')
  await initPretext()
  console.log('[main] Line registry:', getLineRegistry().length, 'lines')
  console.log('[main] Sample line:', getLineRegistry()[0])

  initRenderer()
  console.log('[main] Renderer started')
}

boot().catch(err => console.error('[main] Boot failed:', err))

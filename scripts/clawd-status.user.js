// ==UserScript==
// @name         Clawd Desktop Pet Status
// @namespace    https://github.com/yunimizxt/claude-code-desktop-pet
// @version      1.0
// @description  Animates the Claw'd desktop pet based on Claude.ai chat activity
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict'

  const PET_URL = 'http://127.0.0.1:7421/status'
  let lastStatus = null
  let doneTimer = null

  function send(status) {
    if (lastStatus === status) return
    lastStatus = status
    fetch(PET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {})
  }

  function isStopButtonVisible() {
    return !!(
      document.querySelector('button[aria-label*="Stop"]') ||
      document.querySelector('button[title*="Stop"]') ||
      document.querySelector('[data-testid="stop-button"]') ||
      // Fallback: a button containing a square/stop SVG inside the input area
      document.querySelector('fieldset button svg rect[width="10"]')
    )
  }

  function checkState() {
    if (isStopButtonVisible()) {
      clearTimeout(doneTimer)
      send('running')
    } else if (lastStatus === 'running') {
      // Streaming just ended — show done, then go idle
      doneTimer = setTimeout(() => send('idle'), 3500)
      send('done')
    }
  }

  // Show "waiting" as soon as the user submits (before streaming starts)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      const inEditor = e.target.closest('[contenteditable="true"]') ||
                       e.target.matches('textarea')
      if (inEditor) send('waiting')
    }
  }, true)

  // Also catch clicks on the send button
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button')
    if (!btn) return
    const label = btn.getAttribute('aria-label') || btn.title || ''
    if (/send/i.test(label)) send('waiting')
  }, true)

  // Poll every 300ms to track streaming state
  setInterval(checkState, 300)

  console.log('[Clawd] Status userscript loaded — pet listening on', PET_URL)
})()

'use strict'

const STATES = {
  IDLE:    'idle',
  WORKING: 'working',
  WAITING: 'waiting',
  SUCCESS: 'success',
  ERROR:   'error',
  WAVE:    'wave',
  JUMP:    'jump',
}

// States that auto-return to idle after a timeout
const TRANSIENT = {
  [STATES.SUCCESS]: 3000,
  [STATES.ERROR]:   3000,
  [STATES.WAVE]:    2000,
  [STATES.JUMP]:    1500,
}

// Maps status strings from Claude Code / pet-status.json
const STATUS_MAP = {
  idle:     STATES.IDLE,
  running:  STATES.WORKING,
  thinking: STATES.WAITING,
  waiting:  STATES.WAITING,
  success:  STATES.SUCCESS,
  done:     STATES.SUCCESS,
  error:    STATES.ERROR,
  failed:   STATES.ERROR,
}

const SPEECH = {
  [STATES.WORKING]: 'Working...',
  [STATES.WAITING]: 'Thinking...',
  [STATES.SUCCESS]: 'Done!',
  [STATES.ERROR]:   'Oops!',
  [STATES.WAVE]:    'Hi!',
  [STATES.JUMP]:    'Woo!',
}

class PetStateMachine {
  constructor(petEl, bubbleEl) {
    this.petEl = petEl
    this.bubbleEl = bubbleEl
    this.current = null
    this.returnTimer = null
    this.setState(STATES.IDLE)
  }

  setState(newState) {
    if (this.current === newState) return
    clearTimeout(this.returnTimer)

    for (const s of Object.values(STATES)) {
      this.petEl.classList.remove(`state-${s}`)
    }

    this.current = newState
    this.petEl.classList.add(`state-${newState}`)

    if (this.bubbleEl) {
      const text = SPEECH[newState]
      if (text) {
        this.bubbleEl.textContent = text
        this.bubbleEl.classList.remove('hidden')
      } else {
        this.bubbleEl.classList.add('hidden')
      }
    }

    if (TRANSIENT[newState]) {
      this.returnTimer = setTimeout(() => this.setState(STATES.IDLE), TRANSIENT[newState])
    }
  }
}

// --- Init ---

document.addEventListener('DOMContentLoaded', () => {
  const petEl = document.getElementById('pet')
  const bubbleEl = document.getElementById('speech-bubble')
  const pet = new PetStateMachine(petEl, bubbleEl)

  // --- Mouse hover: toggle click-through in main process ---

  let isMouseOver = false
  let isDragging = false

  petEl.addEventListener('mouseenter', () => {
    isMouseOver = true
    window.petAPI.mouseEnter()
  })

  petEl.addEventListener('mouseleave', () => {
    isMouseOver = false
    if (!isDragging) window.petAPI.mouseLeave()
  })

  // --- Drag ---

  let dragOffsetX = 0
  let dragOffsetY = 0
  let didMove = false

  petEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    isDragging = true
    didMove = false
    // clientX/Y is the cursor position inside this 150x150 window
    dragOffsetX = e.clientX
    dragOffsetY = e.clientY
    e.preventDefault()
  })

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    didMove = true
    // screenX/Y is absolute screen position; subtract initial offset to get window top-left
    window.petAPI.drag(e.screenX - dragOffsetX, e.screenY - dragOffsetY)
  })

  document.addEventListener('mouseup', () => {
    if (!isDragging) return
    isDragging = false
    if (!isMouseOver) window.petAPI.mouseLeave()
  })

  // --- Click interactions (debounce single vs double click) ---

  let singleClickTimer = null

  petEl.addEventListener('click', () => {
    if (didMove) return
    clearTimeout(singleClickTimer)
    singleClickTimer = setTimeout(() => pet.setState(STATES.WAVE), 180)
  })

  petEl.addEventListener('dblclick', () => {
    clearTimeout(singleClickTimer)
    pet.setState(STATES.JUMP)
  })

  // --- Status updates pushed from main process ---

  window.petAPI.onStatusUpdate((data) => {
    const mapped = STATUS_MAP[data.status]
    if (mapped) pet.setState(mapped)
  })
})

'use strict'

const STATES = {
  IDLE:    'idle',
  WORKING: 'working',
  WAITING: 'waiting',
  SUCCESS: 'success',
  ERROR:   'error',
  WAVE:    'wave',
  JUMP:    'jump',
  SLEEP:   'sleep',
}

const SPRITES = {
  [STATES.IDLE]:    '../../assets/sprites/clawd-idle.gif',
  [STATES.WORKING]: '../../assets/sprites/clawd-building.gif',
  [STATES.WAITING]: '../../assets/sprites/clawd-thinking.gif',
  [STATES.SUCCESS]: '../../assets/sprites/clawd-happy.gif',
  [STATES.ERROR]:   '../../assets/sprites/clawd-error.gif',
  [STATES.WAVE]:    '../../assets/sprites/clawd-mini-happy.gif',
  [STATES.JUMP]:    '../../assets/sprites/clawd-react-double-jump.gif',
  [STATES.SLEEP]:   '../../assets/sprites/clawd-sleeping.gif',
}

// States that auto-return to idle after a timeout
const TRANSIENT = {
  [STATES.SUCCESS]: 3000,
  [STATES.ERROR]:   3000,
  [STATES.WAVE]:    2500,
  [STATES.JUMP]:    2000,
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
  sleep:    STATES.SLEEP,
  sleeping: STATES.SLEEP,
}

const SPEECH = {
  [STATES.WORKING]: 'Working...',
  [STATES.WAITING]: 'Thinking...',
  [STATES.SUCCESS]: 'Done!',
  [STATES.ERROR]:   'Oops!',
  [STATES.WAVE]:    'Hi!',
  [STATES.JUMP]:    'Woo!',
  [STATES.SLEEP]:   'zzz...',
}

class PetStateMachine {
  constructor(imgEl, bubbleEl) {
    this.imgEl = imgEl
    this.bubbleEl = bubbleEl
    this.current = null
    this.returnTimer = null
    this.setState(STATES.IDLE)
  }

  setState(newState) {
    if (this.current === newState) return
    clearTimeout(this.returnTimer)

    this.current = newState
    this.imgEl.src = SPRITES[newState]

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
  const imgEl = document.getElementById('clawd')
  const bubbleEl = document.getElementById('speech-bubble')
  const pet = new PetStateMachine(imgEl, bubbleEl)

  // --- Mouse hover: toggle click-through in main process ---

  const petEl = document.getElementById('pet')
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
    dragOffsetX = e.clientX
    dragOffsetY = e.clientY
    e.preventDefault()
  })

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    didMove = true
    window.petAPI.drag(e.screenX - dragOffsetX, e.screenY - dragOffsetY)
  })

  document.addEventListener('mouseup', () => {
    if (!isDragging) return
    isDragging = false
    if (!isMouseOver) window.petAPI.mouseLeave()
  })

  // --- Click interactions ---

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

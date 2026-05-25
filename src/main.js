const { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const zlib = require('zlib')

// --- Inline PNG encoder for tray icon (no external deps) ---

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : (c >>> 1)
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (const b of buf) c = (c >>> 8) ^ crcTable[(c ^ b) & 0xFF]
  return (c ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.allocUnsafe(4)
  len.writeUInt32BE(data.length)
  const typeB = Buffer.from(type, 'ascii')
  const crcB = Buffer.allocUnsafe(4)
  crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])))
  return Buffer.concat([len, typeB, data, crcB])
}

function makeAsteriskPng(size, r, g, b) {
  const px = Buffer.alloc(size * size * 4, 0)
  const cx = size / 2, cy = size / 2
  const halfLen = size * 0.42
  const halfWidth = size * 0.09
  const step = 0.4

  for (let arm = 0; arm < 3; arm++) {
    const angle = (arm * Math.PI) / 3
    const cos = Math.cos(angle), sin = Math.sin(angle)
    for (let t = -halfLen; t <= halfLen; t += step) {
      for (let p = -halfWidth; p <= halfWidth; p += step) {
        const x = Math.round(cx + t * cos - p * sin)
        const y = Math.round(cy + t * sin + p * cos)
        if (x >= 0 && x < size && y >= 0 && y < size) {
          const i = (y * size + x) * 4
          px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255
        }
      }
    }
  }

  const rowStride = 1 + size * 4
  const raw = Buffer.alloc(size * rowStride)
  for (let y = 0; y < size; y++) {
    raw[y * rowStride] = 0
    px.copy(raw, y * rowStride + 1, y * size * 4, (y + 1) * size * 4)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// --- App state ---

let win, tray

// --- Window creation ---

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  win = new BrowserWindow({
    width: 200,
    height: 200,
    x: width - 200,
    y: height - 200,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const topLevel = process.platform === 'darwin' ? 'screen-saver' : 'pop-up-menu'
  win.setAlwaysOnTop(true, topLevel)

  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  win.setIgnoreMouseEvents(true, { forward: true })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

// --- System tray ---

function createTray() {
  const isMac = process.platform === 'darwin'
  const iconSize = isMac ? 22 : 32
  const [r, g, b] = isMac ? [0, 0, 0] : [204, 120, 92]
  const buf = makeAsteriskPng(iconSize, r, g, b)
  const icon = nativeImage.createFromBuffer(buf)
  if (isMac) icon.setTemplateImage(true)

  tray = new Tray(icon)
  tray.setToolTip('Claude Code Pet')

  const menu = Menu.buildFromTemplate([
    { label: 'Show Pet', click: () => win.show() },
    { label: 'Hide Pet', click: () => win.hide() },
    {
      label: 'Reset Position',
      click: () => {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize
        win.setPosition(width - 200, height - 200)
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])

  tray.setContextMenu(menu)
  tray.on('click', () => {
    if (win.isVisible()) win.hide()
    else win.show()
  })
}

// --- Claude Code status integration ---

function watchStatusFile() {
  const statusPath = path.join(os.homedir(), '.claude', 'pet-status.json')
  try {
    fs.watchFile(statusPath, { interval: 500 }, () => {
      try {
        const data = JSON.parse(fs.readFileSync(statusPath, 'utf8'))
        if (win && !win.isDestroyed()) win.webContents.send('status:update', data)
      } catch {}
    })
  } catch {}
}

// --- IPC handlers ---

ipcMain.on('pet:mouse-enter', () => {
  if (win) win.setIgnoreMouseEvents(false)
})

ipcMain.on('pet:mouse-leave', () => {
  if (win) win.setIgnoreMouseEvents(true, { forward: true })
})

ipcMain.on('pet:drag', (_, { x, y }) => {
  if (win) win.setPosition(Math.round(x), Math.round(y))
})

ipcMain.handle('window:get-position', () => {
  return win ? win.getPosition() : [0, 0]
})

// --- App lifecycle ---

app.whenReady().then(() => {
  createWindow()
  createTray()
  watchStatusFile()
})

app.on('window-all-closed', () => {
  // Stay alive in system tray; do not quit when window closes
})

app.on('activate', () => {
  if (win && !win.isVisible()) win.show()
})

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('petAPI', {
  mouseEnter: () => ipcRenderer.send('pet:mouse-enter'),
  mouseLeave: () => ipcRenderer.send('pet:mouse-leave'),
  drag: (x, y) => ipcRenderer.send('pet:drag', { x, y }),
  getPosition: () => ipcRenderer.invoke('window:get-position'),
  onStatusUpdate: (cb) => ipcRenderer.on('status:update', (_, data) => cb(data)),
})

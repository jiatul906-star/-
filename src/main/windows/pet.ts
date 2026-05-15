import { BrowserWindow } from 'electron'
import { join } from 'path'

export function createPetWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 200,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setIgnoreMouseEvents(true, { forward: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/pet`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/pet' })
  }

  return win
}

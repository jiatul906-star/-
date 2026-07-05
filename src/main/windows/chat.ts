import { BrowserWindow } from 'electron'
import { join } from 'path'

export function createChatWindow(): BrowserWindow {
  const win = new BrowserWindow({
    title: 'WITH U',
    width: 960,
    height: 680,
    minWidth: 680,
    minHeight: 480,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

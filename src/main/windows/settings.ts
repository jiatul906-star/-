import { BrowserWindow } from 'electron'
import { join } from 'path'

export function createSettingsWindow(parent?: BrowserWindow): BrowserWindow {
  const win = new BrowserWindow({
    width: 780,
    height: 560,
    frame: false,
    titleBarStyle: 'hidden',
    parent,
    modal: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/settings`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/settings' })
  }

  return win
}

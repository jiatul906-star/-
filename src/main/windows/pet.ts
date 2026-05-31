import { BrowserWindow, globalShortcut, app } from 'electron'
import { join } from 'path'

export function createPetWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 250,
    height: 350,
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

  // 默认交互模式 — 右键菜单在 React 中处理
  win.setIgnoreMouseEvents(false)

  // 全局快捷键 Ctrl+Shift+Q 退出
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    app.exit(0)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/pet`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/pet' })
  }

  return win
}

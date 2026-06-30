import { BrowserWindow, globalShortcut, app, screen } from 'electron'
import { join } from 'path'

export function createPetWindow(): BrowserWindow {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  const winW = 160
  const winH = 270

  const win = new BrowserWindow({
    width: winW,
    height: winH,
    x: Math.round((sw - winW) / 2),
    y: Math.round((sh - winH) / 3),
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

  // 锁定窗口尺寸 — 拖拽时也不可变
  win.setMinimumSize(winW, winH)
  win.setMaximumSize(winW, winH)
  win.on('will-resize', (e) => e.preventDefault())

  // 默认交互模式 — 右键菜单在 React 中处理
  win.setIgnoreMouseEvents(false)

  // 全局快捷键 Ctrl+Shift+Q 退出
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    app.exit(0)
  })

  // 确保可见
  win.show()
  win.focus()

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/pet`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/pet' })
  }

  return win
}

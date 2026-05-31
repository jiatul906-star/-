import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { createChatWindow } from './windows/chat'
import { createPetWindow } from './windows/pet'
import { createSettingsWindow } from './windows/settings'
import { registerIpc } from './ipc'
import type { PetAction } from '../common/types'
import { DEFAULT_PET_ACTIONS } from '../common/types'

let chatWindow: BrowserWindow | null = null
let petWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null

// 持久化动作配置（JSON 文件，替代 electron-store ESM 问题）
const userDataPath = app.getPath('userData')
const petActionsFile = join(userDataPath, 'pet-actions.json')

function loadPetActions(): PetAction[] {
  try {
    if (existsSync(petActionsFile)) {
      const raw = readFileSync(petActionsFile, 'utf-8')
      const data = JSON.parse(raw)
      if (Array.isArray(data.actions)) return data.actions
    }
  } catch {
    // 文件损坏 → 用默认
  }
  return DEFAULT_PET_ACTIONS
}

function savePetActions(actions: PetAction[]): void {
  try {
    if (!existsSync(userDataPath)) mkdirSync(userDataPath, { recursive: true })
    writeFileSync(petActionsFile, JSON.stringify({ actions }, null, 2), 'utf-8')
  } catch {
    // 静默失败
  }
}

function createTray(): Tray {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAMlJREFUWEftlrENwjAURc9fEjQskIGyAhuwAhMwAiMwAhswAhswAhswAhswAhswAhswAhswAhvEURLZii0niZKf4sRJ3r3v69+xLcYY/JND/qnchEAdgToCdQTqCNQREBFYr9dYrVZgZrx3gNZaiAjfQURgPp+LzWaDqqqwWCzQNA2YWWQcx6+wLQBmBkSotMIwBN57OOfgz4kxRpCMhFEBEDnn4JxD0zRgZnjv96+iWq0gHR0dQETYD/K+FOb3vgvG0yP8BmsHIkQQEX9u+QIxkC4CYp+W3wAAAABJRU5ErkJggg=='
  )

  const trayInstance = new Tray(icon)
  trayInstance.setToolTip('AI 伴侣')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏聊天',
      click: () => {
        if (chatWindow) {
          chatWindow.isVisible() ? chatWindow.hide() : chatWindow.show()
        }
      },
    },
    {
      label: '显示/隐藏桌宠',
      click: () => {
        if (petWindow) {
          petWindow.isVisible() ? petWindow.hide() : petWindow.show()
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.exit(0),
    },
  ])

  trayInstance.setContextMenu(contextMenu)
  return trayInstance
}

function getOrCreateSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return settingsWindow
  }
  settingsWindow = createSettingsWindow()
  settingsWindow.on('closed', () => { settingsWindow = null })
  return settingsWindow
}

function bootstrap() {
  chatWindow = createChatWindow()
  petWindow = createPetWindow()
  tray = createTray()

  registerIpc({
    loadPetActions,
    savePetActions,
    getPetWindow: () => petWindow,
    getChatWindow: () => chatWindow,
    getOrCreateSettingsWindow,
  })
}

app.whenReady().then(bootstrap)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) bootstrap()
})

app.on('before-quit', () => {
  // 允许正常退出
})

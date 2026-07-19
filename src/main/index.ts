import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { createChatWindow } from './windows/chat'
import { createPetWindow } from './windows/pet'
import { createSettingsWindow } from './windows/settings'
import { registerIpc } from './ipc'
import { getPythonManager } from './python-manager'
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
  // 32x32 magenta chat-bubble icon — visible on both light & dark taskbars
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAfklEQVR4nO3UQQqAIBCFYY/W/U/hPVzkSohkdN7zjQQ2tBL8P9IopX/Uk68SErWewLSAcdZJA6rDBlHHjFiArnuNfs/dZrByDrB4ATsM5oj2AYOjFwCvS+YB60OarnzmV0EbQJ0w4DpkkHUPs5r2vITAsBhN2jLE9ScTlT51KhSSYHD1ZTx3AAAAAElFTkSuQmCC'
  )

  const trayInstance = new Tray(icon)
  trayInstance.setToolTip('WITH U')

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
  chatWindow.on('closed', () => { chatWindow = null })
  petWindow = createPetWindow()
  tray = createTray()

  registerIpc({
    loadPetActions,
    savePetActions,
    getPetWindow: () => petWindow,
    getChatWindow: () => chatWindow,
    getOrCreateChatWindow: () => {
      if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.focus()
        return chatWindow
      }
      chatWindow = createChatWindow()
      chatWindow.on('closed', () => { chatWindow = null })
      return chatWindow
    },
    getOrCreateSettingsWindow,
    getAllWindows: () => [chatWindow, petWindow, settingsWindow].filter(Boolean) as BrowserWindow[],
  })
}

// 单实例锁：禁止多开
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.show()
      chatWindow.focus()
    }
  })
}

app.whenReady().then(bootstrap)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) bootstrap()
})

app.on('before-quit', async () => {
  // 优雅关闭 Python TTS 服务
  await getPythonManager().stop()
})


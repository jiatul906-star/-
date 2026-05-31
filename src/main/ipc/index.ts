import { ipcMain, BrowserWindow, app, dialog } from 'electron'
import type { PetAction } from '../../common/types'

interface IpcDeps {
  loadPetActions: () => PetAction[]
  savePetActions: (actions: PetAction[]) => void
  getPetWindow: () => BrowserWindow | null
  getChatWindow: () => BrowserWindow | null
  getOrCreateSettingsWindow: () => BrowserWindow
}

export function registerIpc(deps: IpcDeps) {
  const { loadPetActions, savePetActions, getPetWindow, getChatWindow, getOrCreateSettingsWindow } = deps

  // ===== 窗口控制 =====
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('app:quit', () => {
    app.exit(0)
  })

  // ===== 桌宠鼠标穿透 =====
  ipcMain.handle('window:togglePetPassthrough', () => {
    const win = getPetWindow()
    if (!win) return false

    const key = 'mousePassthrough' as any
    const current = (win as any)[key] ?? false
    const next = !current
    ;(win as any)[key] = next
    win.setIgnoreMouseEvents(next, { forward: next })
    return next
  })

  // ===== 动作持久化 =====
  ipcMain.handle('pet-actions:getAll', () => {
    return loadPetActions()
  })

  ipcMain.handle('pet-actions:save', (_event, actions: PetAction[]) => {
    savePetActions(actions)
  })

  // ===== 打开窗口 =====
  ipcMain.handle('window:openChat', () => {
    const win = getChatWindow()
    if (win) {
      win.show()
      win.focus()
    }
  })

  ipcMain.handle('window:openSettings', () => {
    getOrCreateSettingsWindow()
  })

  // ===== 拖拽移动桌宠窗口 =====
  ipcMain.handle('window:movePet', (_event, dx: number, dy: number) => {
    const win = getPetWindow()
    if (!win) return
    const [x, y] = win.getPosition()
    win.setPosition(x + dx, y + dy)
  })

  // ===== 文件对话框 =====
  ipcMain.handle('dialog:openVideo', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: '视频文件', extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'] }],
    })
    return result.canceled ? null : result.filePaths[0]
  })
}

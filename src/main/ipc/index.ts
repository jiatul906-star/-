import { ipcMain, BrowserWindow, app, dialog } from 'electron'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { PetAction, CharacterConfig, CharactersData } from '../../common/types'
import { DEFAULT_CHARACTERS } from '../../common/types'

interface IpcDeps {
  loadPetActions: () => PetAction[]
  savePetActions: (actions: PetAction[]) => void
  getPetWindow: () => BrowserWindow | null
  getChatWindow: () => BrowserWindow | null
  getOrCreateSettingsWindow: () => BrowserWindow
  getAllWindows: () => BrowserWindow[]
}

export function registerIpc(deps: IpcDeps) {
  const { loadPetActions, savePetActions, getPetWindow, getChatWindow, getOrCreateSettingsWindow, getAllWindows } = deps

  // ===== window controls =====
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

  // ===== pet mouse passthrough =====
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

  // ===== action persistence =====
  ipcMain.handle('pet-actions:getAll', () => {
    return loadPetActions()
  })

  ipcMain.handle('pet-actions:save', (_event, actions: PetAction[]) => {
    savePetActions(actions)
  })

  // ===== open windows =====
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

  // ===== drag move pet window =====
  ipcMain.handle('window:movePet', (_event, dx: number, dy: number) => {
    const win = getPetWindow()
    if (!win) return
    const [x, y] = win.getPosition()
    win.setPosition(x + dx, y + dy)
  })

  // ===== file dialog: video =====
  ipcMain.handle('dialog:openVideo', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'video', extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'] }],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ===== character persistence =====
  const charactersFile = join(app.getPath('userData'), 'characters.json')

  function loadCharactersData(): CharactersData {
    try {
      if (existsSync(charactersFile)) {
        const raw = readFileSync(charactersFile, 'utf-8')
        const data = JSON.parse(raw)
        if (Array.isArray(data.characters) && data.characters.length > 0 && typeof data.activeId === 'string') {
          return data as CharactersData
        }
      }
    } catch {
      // corrupted → use defaults
    }
    // first launch: write defaults
    const def: CharactersData = {
      characters: DEFAULT_CHARACTERS,
      activeId: 'char_1',
    }
    try { writeFileSync(charactersFile, JSON.stringify(def, null, 2), 'utf-8') } catch {}
    return def
  }

  ipcMain.handle('character:getAll', () => {
    return loadCharactersData()
  })

  ipcMain.handle('character:saveAll', (_event, data: CharactersData) => {
    try {
      writeFileSync(charactersFile, JSON.stringify(data, null, 2), 'utf-8')
    } catch {
      return
    }
    // broadcast to all windows
    for (const win of getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('characters:updated', data)
      }
    }
  })

  // ===== pet custom image (per character) =====
  const userDataPath = app.getPath('userData')

  /** Detect MIME from file magic bytes */
  function detectMime(buf: Buffer): string {
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif'
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'image/webp'
    if (buf[0] === 0x42 && buf[1] === 0x4d) return 'image/bmp'
    return 'image/png'
  }

  /** Convert image file to base64 data URL */
  function imageToDataUrl(path: string): string | null {
    try {
      const buf = readFileSync(path)
      const mime = detectMime(buf)
      const base64 = buf.toString('base64')
      return `data:${mime};base64,${base64}`
    } catch {
      return null
    }
  }

  function petImagePath(charId: string): string {
    return join(userDataPath, `pet-image-${charId}.png`)
  }

  ipcMain.handle('dialog:openImage', async (_event, charId: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'image', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const srcPath = result.filePaths[0]
    try {
      copyFileSync(srcPath, petImagePath(charId))
    } catch {
      return null
    }

    const dataUrl = imageToDataUrl(petImagePath(charId))
    const payload = { charId, dataUrl }
    // notify all windows
    for (const win of getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('pet-image:updated', payload)
      }
    }
    return dataUrl
  })

  ipcMain.handle('pet-image:getCurrent', (_event, charId: string) => {
    const p = petImagePath(charId)
    if (existsSync(p)) {
      return imageToDataUrl(p)
    }
    return null
  })
}

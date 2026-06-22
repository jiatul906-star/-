import { ipcMain, BrowserWindow, app, dialog } from 'electron'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type {
  PetAction,
  CharacterConfig,
  CharactersData,
  ApiProfile,
  ApiProfilesData,
  ChatMessage,
  MemoryEntry,
} from '../../common/types'
import { DEFAULT_CHARACTERS, PRESET_API_PROFILES } from '../../common/types'

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
  // 当前正确尺寸（DWM 可能改写 getBounds 返回值，所以自己维护）
  let petW = 160
  let petH = 270
  ipcMain.handle('window:movePet', (_event, dx: number, dy: number) => {
    const win = getPetWindow()
    if (!win) return
    const [x, y] = win.getPosition()
    win.setBounds({ x: x + dx, y: y + dy, width: petW, height: petH })
  })

  // ===== resize pet window (expand/shrink for context menu) =====
  const SMALL = { w: 160, h: 270, charTop: 45, charH: 180 }
  const LARGE = { w: 320, h: 310, charTop: 45, charH: 180 }
  let blurShrink: (() => void) | null = null

  ipcMain.handle('window:resizePet', (_event, expand: boolean, charWinX: number, charWinY: number) => {
    const win = getPetWindow()
    if (!win) return

    // 移除旧的 blur 监听
    if (blurShrink) {
      win.off('blur', blurShrink)
      blurShrink = null
    }

    const b = win.getBounds()
    const charScreenX = b.x + charWinX
    const charScreenY = b.y + charWinY
    const sz = expand ? LARGE : SMALL
    petW = sz.w
    petH = sz.h
    const charCenterX = sz.w / 2
    const charCenterY = sz.charTop + sz.charH / 2
    win.setMinimumSize(sz.w, sz.h)
    win.setMaximumSize(sz.w, sz.h)
    win.setBounds({
      x: Math.round(charScreenX - charCenterX),
      y: Math.round(charScreenY - charCenterY),
      width: sz.w,
      height: sz.h,
    })

    // 扩大时注册 blur 监听 — 点窗口外自动缩窗
    if (expand) {
      blurShrink = () => {
        if (win.isDestroyed()) return
        const b2 = win.getBounds()
        const cx = b2.x + b2.width / 2
        const cy = b2.y + sz.charTop + sz.charH / 2
        petW = SMALL.w
        petH = SMALL.h
        win.setMinimumSize(SMALL.w, SMALL.h)
        win.setMaximumSize(SMALL.w, SMALL.h)
        win.setBounds({
          x: Math.round(cx - SMALL.w / 2),
          y: Math.round(cy - SMALL.charTop - SMALL.charH / 2),
          width: SMALL.w,
          height: SMALL.h,
        })
        win.webContents.send('pet:menuClose')
        win.off('blur', blurShrink!)
        blurShrink = null
      }
      win.on('blur', blurShrink)
    }
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

  // ===== API Profiles persistence =====
  const apiProfilesFile = join(app.getPath('userData'), 'api-profiles.json')

  function generateId(): string {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9)
  }

  function loadApiProfilesData(): ApiProfilesData {
    try {
      if (existsSync(apiProfilesFile)) {
        const raw = readFileSync(apiProfilesFile, 'utf-8')
        const data = JSON.parse(raw)
        if (Array.isArray(data.profiles)) {
          return data as ApiProfilesData
        }
      }
    } catch {
      // corrupted → use presets
    }
    // first launch: seed with presets
    const now = Date.now()
    const profiles: ApiProfile[] = PRESET_API_PROFILES.map((p, i) => ({
      ...p,
      id: `preset_${i}`,
      apiKey: '',
      isActive: i === 0,
      createdAt: now,
      updatedAt: now,
    }))
    const def: ApiProfilesData = { profiles, activeProfileId: profiles[0]?.id ?? '' }
    try { writeFileSync(apiProfilesFile, JSON.stringify(def, null, 2), 'utf-8') } catch {}
    return def
  }

  ipcMain.handle('api-profiles:getAll', () => {
    return loadApiProfilesData()
  })

  ipcMain.handle('api-profiles:saveAll', (_event, data: ApiProfilesData) => {
    try {
      writeFileSync(apiProfilesFile, JSON.stringify(data, null, 2), 'utf-8')
    } catch {
      return
    }
    for (const win of getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('api-profiles:updated', data)
      }
    }
  })

  ipcMain.handle('api-profiles:test', async (_event, profile: ApiProfile) => {
    try {
      const url = profile.baseUrl.replace(/\/+$/, '')
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const resp = await fetch(`${url}/models`, {
        headers: { Authorization: `Bearer ${profile.apiKey}` },
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return { ok: resp.ok, status: resp.status }
    } catch (e: any) {
      return { ok: false, status: 0, error: e.message || 'Unknown error' }
    }
  })

  // ===== Chat history persistence =====
  const chatHistoryFile = join(app.getPath('userData'), 'chat-history.json')

  function loadChatHistory(): Record<string, ChatMessage[]> {
    try {
      if (existsSync(chatHistoryFile)) {
        const raw = readFileSync(chatHistoryFile, 'utf-8')
        return JSON.parse(raw)
      }
    } catch {}
    return {}
  }

  function saveChatHistory(data: Record<string, ChatMessage[]>): void {
    try { writeFileSync(chatHistoryFile, JSON.stringify(data, null, 2), 'utf-8') } catch {}
  }

  ipcMain.handle('chat-history:get', (_event, characterId: string) => {
    const all = loadChatHistory()
    return all[characterId] ?? []
  })

  ipcMain.handle('chat-history:add', (_event, characterId: string, message: ChatMessage) => {
    const all = loadChatHistory()
    const list = all[characterId] ?? []
    list.push(message)
    // trim: keep last 1000
    if (list.length > 1000) {
      list.splice(0, list.length - 800)
    }
    all[characterId] = list
    saveChatHistory(all)
  })

  ipcMain.handle('chat-history:clear', (_event, characterId: string) => {
    const all = loadChatHistory()
    delete all[characterId]
    saveChatHistory(all)
  })

  // ===== Agent memory persistence =====
  const agentMemoryFile = join(app.getPath('userData'), 'agent-memory.json')

  function loadAgentMemory(): Record<string, MemoryEntry[]> {
    try {
      if (existsSync(agentMemoryFile)) {
        const raw = readFileSync(agentMemoryFile, 'utf-8')
        return JSON.parse(raw)
      }
    } catch {}
    return {}
  }

  function saveAgentMemory(data: Record<string, MemoryEntry[]>): void {
    try { writeFileSync(agentMemoryFile, JSON.stringify(data, null, 2), 'utf-8') } catch {}
  }

  ipcMain.handle('agent-memory:getAll', (_event, characterId: string) => {
    const all = loadAgentMemory()
    return all[characterId] ?? []
  })

  ipcMain.handle('agent-memory:add', (_event, characterId: string, entry: MemoryEntry) => {
    const all = loadAgentMemory()
    const list = all[characterId] ?? []
    list.push(entry)
    all[characterId] = list
    saveAgentMemory(all)
  })

  ipcMain.handle('agent-memory:delete', (_event, characterId: string, id: string) => {
    const all = loadAgentMemory()
    const list = all[characterId]
    if (list) {
      all[characterId] = list.filter((e) => e.id !== id)
      saveAgentMemory(all)
    }
  })

  ipcMain.handle('agent-memory:update', (_event, characterId: string, id: string, content: string) => {
    const all = loadAgentMemory()
    const list = all[characterId]
    if (list) {
      const entry = list.find((e) => e.id === id)
      if (entry) {
        entry.content = content
        entry.updatedAt = Date.now()
        saveAgentMemory(all)
      }
    }
  })
}

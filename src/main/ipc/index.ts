import { ipcMain, BrowserWindow, app, dialog, shell } from 'electron'
import { copyFileSync, existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync, statSync, unlinkSync, rmdirSync } from 'fs'
import { join } from 'path'
import type {
  PetAction,
  CharacterConfig,
  CharactersData,
  CharacterIndex,
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
  getOrCreateChatWindow: () => BrowserWindow
  getOrCreateSettingsWindow: () => BrowserWindow
  getAllWindows: () => BrowserWindow[]
}

// ===== 辅助函数 =====

const userDataPath = app.getPath('userData')
const characterBase = join(userDataPath, 'character')
const indexFile = join(characterBase, '_index.json')

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim()
}

function charDir(folderName: string): string {
  return join(characterBase, folderName)
}

function charVideoDir(folderName: string): string {
  return join(charDir(folderName), 'video')
}

// _index.json 读写
function loadIndex(): CharacterIndex {
  try {
    if (existsSync(indexFile)) {
      const raw = readFileSync(indexFile, 'utf-8')
      const data = JSON.parse(raw)
      if (data && typeof data.activeId === 'string' && data.entries) {
        return data as CharacterIndex
      }
    }
  } catch {}
  return { activeId: '', entries: {} }
}

function saveIndex(index: CharacterIndex): void {
  ensureDir(characterBase)
  writeFileSync(indexFile, JSON.stringify(index, null, 2), 'utf-8')
}

// 单角色 config.json 读写
function loadCharacterConfig(folderName: string): CharacterConfig | null {
  const configPath = join(charDir(folderName), 'config.json')
  try {
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, 'utf-8')) as CharacterConfig
    }
  } catch {}
  return null
}

function saveCharacterConfig(folderName: string, config: CharacterConfig): void {
  const dir = charDir(folderName)
  ensureDir(dir)
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8')
}

// 通过 charId 查找 folderName
function folderNameById(charId: string): string | null {
  const index = loadIndex()
  return index.entries[charId]?.folderName ?? null
}

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

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:.*?;base64,(.+)$/)
  if (!match) return null
  return Buffer.from(match[1], 'base64')
}

// 图片文件操作
function loadImageAsDataUrl(folderName: string, imageType: 'portrait' | 'avatar'): string | null {
  const fileName = imageType === 'portrait' ? 'portrait.png' : 'avatar.png'
  const p = join(charDir(folderName), fileName)
  if (existsSync(p)) return imageToDataUrl(p)
  return null
}

function saveImageToChar(folderName: string, imageType: 'portrait' | 'avatar', sourcePath: string): void {
  const dir = charDir(folderName)
  ensureDir(dir)
  const fileName = imageType === 'portrait' ? 'portrait.png' : 'avatar.png'
  copyFileSync(sourcePath, join(dir, fileName))
}

// 视频文件操作
function copyVideoToChar(folderName: string, sourcePath: string, targetName: string): string {
  const vDir = charVideoDir(folderName)
  ensureDir(vDir)
  const ext = sourcePath.split('.').pop() || 'mp4'
  const destName = `${targetName}.${ext}`
  copyFileSync(sourcePath, join(vDir, destName))
  return destName
}

// 文件夹操作
function deleteCharacterDir(folderName: string): void {
  const dir = charDir(folderName)
  if (existsSync(dir)) {
    rmDirRecursive(dir)
  }
}

function rmDirRecursive(dir: string): void {
  if (!existsSync(dir)) return
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      rmDirRecursive(full)
    } else {
      unlinkSync(full)
    }
  }
  rmdirSync(dir)
}

function renameCharacterDir(oldName: string, newName: string): boolean {
  try {
    const oldDir = charDir(oldName)
    const newDir = charDir(newName)
    if (existsSync(oldDir) && !existsSync(newDir)) {
      renameSync(oldDir, newDir)
      return true
    }
  } catch {}
  return false
}

// 角色文件夹 chat-history 读写
function loadCharChatHistory(folderName: string): ChatMessage[] {
  const p = join(charDir(folderName), 'chat-history.json')
  try {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf-8')) as ChatMessage[]
    }
  } catch {}
  return []
}

function saveCharChatHistory(folderName: string, messages: ChatMessage[]): void {
  const dir = charDir(folderName)
  ensureDir(dir)
  writeFileSync(join(dir, 'chat-history.json'), JSON.stringify(messages, null, 2), 'utf-8')
}

// 角色文件夹 agent-memory 读写
function loadCharAgentMemory(folderName: string): MemoryEntry[] {
  const p = join(charDir(folderName), 'agent-memory.json')
  try {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf-8')) as MemoryEntry[]
    }
  } catch {}
  return []
}

function saveCharAgentMemory(folderName: string, memories: MemoryEntry[]): void {
  const dir = charDir(folderName)
  ensureDir(dir)
  writeFileSync(join(dir, 'agent-memory.json'), JSON.stringify(memories, null, 2), 'utf-8')
}

// ===== 迁移逻辑 =====

function migrateOldStructure(): boolean {
  const oldCharsFile = join(userDataPath, 'characters.json')
  if (!existsSync(oldCharsFile)) return false

  try {
    // 1. 读旧数据
    const oldCharsRaw = readFileSync(oldCharsFile, 'utf-8')
    const oldCharsData = JSON.parse(oldCharsRaw) as CharactersData

    // 2. 读旧 pet-actions
    const petActionsFile = join(userDataPath, 'pet-actions.json')
    let oldActions: PetAction[] = []
    if (existsSync(petActionsFile)) {
      try {
        const raw = readFileSync(petActionsFile, 'utf-8')
        const data = JSON.parse(raw)
        if (Array.isArray(data.actions)) oldActions = data.actions
      } catch {}
    }

    // 3. 读旧 chat-history
    const oldChatFile = join(userDataPath, 'chat-history.json')
    let oldChatHistory: Record<string, ChatMessage[]> = {}
    if (existsSync(oldChatFile)) {
      try { oldChatHistory = JSON.parse(readFileSync(oldChatFile, 'utf-8')) } catch {}
    }

    // 4. 读旧 agent-memory
    const oldMemoryFile = join(userDataPath, 'agent-memory.json')
    let oldAgentMemory: Record<string, MemoryEntry[]> = {}
    if (existsSync(oldMemoryFile)) {
      try { oldAgentMemory = JSON.parse(readFileSync(oldMemoryFile, 'utf-8')) } catch {}
    }

    // 5. 创建 character/ 和 _index.json
    ensureDir(characterBase)
    const index: CharacterIndex = { activeId: oldCharsData.activeId, entries: {} }

    // 6. 逐个角色迁移
    for (const char of oldCharsData.characters) {
      const folderName = sanitizeFolderName(char.name)
      ensureDir(charDir(folderName))
      ensureDir(charVideoDir(folderName))

      // 6a. 提取 portrait
      if ((char as any).imageDataUrl) {
        try {
          const buf = dataUrlToBuffer((char as any).imageDataUrl)
          if (buf) writeFileSync(join(charDir(folderName), 'portrait.png'), buf)
        } catch {}
      } else {
        const oldImgPath = join(userDataPath, `pet-image-${char.id}.png`)
        if (existsSync(oldImgPath)) {
          try { copyFileSync(oldImgPath, join(charDir(folderName), 'portrait.png')) } catch {}
        }
      }

      // 6b. 提取 avatar
      if ((char as any).avatarDataUrl) {
        try {
          const buf = dataUrlToBuffer((char as any).avatarDataUrl)
          if (buf) writeFileSync(join(charDir(folderName), 'avatar.png'), buf)
        } catch {}
      }

      // 6c. 写 config.json（不含图片字段）
      const { imageDataUrl, avatarDataUrl, ...cleanConfig } = char as any
      saveCharacterConfig(folderName, cleanConfig)

      // 6d. 迁移聊天记录
      const charChat = oldChatHistory[char.id]
      if (charChat && charChat.length > 0) {
        saveCharChatHistory(folderName, charChat)
      }

      // 6e. 迁移记忆
      const charMemories = oldAgentMemory[char.id]
      if (charMemories && charMemories.length > 0) {
        saveCharAgentMemory(folderName, charMemories)
      }

      // 6f. 复制视频到角色文件夹
      for (const action of oldActions) {
        if (action.videoPath && existsSync(action.videoPath)) {
          try {
            copyVideoToChar(folderName, action.videoPath, action.id)
          } catch {}
        }
      }

      index.entries[char.id] = { id: char.id, folderName }
    }

    // 7. 更新 pet-actions.json videoPath 为文件名
    const updatedActions = oldActions.map(action => {
      if (action.videoPath) {
        const ext = action.videoPath.split('.').pop() || 'mp4'
        return { ...action, videoPath: `${action.id}.${ext}` }
      }
      return action
    })
    if (updatedActions.length > 0) {
      writeFileSync(join(userDataPath, 'pet-actions.json'), JSON.stringify({ actions: updatedActions }, null, 2), 'utf-8')
    }

    // 8. 保存 _index.json
    saveIndex(index)

    // 9. 重命名旧文件为 .bak
    try { renameSync(oldCharsFile, join(userDataPath, 'characters.json.bak')) } catch {}
    if (existsSync(oldChatFile)) {
      try { renameSync(oldChatFile, join(userDataPath, 'chat-history.json.bak')) } catch {}
    }
    if (existsSync(oldMemoryFile)) {
      try { renameSync(oldMemoryFile, join(userDataPath, 'agent-memory.json.bak')) } catch {}
    }

    return true
  } catch (e) {
    console.error('Migration failed:', e)
    return false
  }
}

// 确保 character/ 目录存在（首次启动或迁移后）
function ensureCharacterStructure(): void {
  if (!existsSync(characterBase)) {
    // 尝试迁移
    if (!migrateOldStructure()) {
      // 全新安装：创建默认结构
      ensureDir(characterBase)
      const index: CharacterIndex = { activeId: 'char_1', entries: {} }
      for (const char of DEFAULT_CHARACTERS) {
        const folderName = sanitizeFolderName(char.name)
        ensureDir(charDir(folderName))
        ensureDir(charVideoDir(folderName))
        saveCharacterConfig(folderName, char)
        index.entries[char.id] = { id: char.id, folderName }
      }
      saveIndex(index)
    }
  }
}

// 组装 CharactersData（从文件夹读取所有角色）
function loadCharactersData(): CharactersData {
  ensureCharacterStructure()
  const index = loadIndex()
  const characters: CharacterConfig[] = []
  for (const entry of Object.values(index.entries)) {
    const config = loadCharacterConfig(entry.folderName)
    if (config) {
      // 保底：如果 config 中 id 与 entries key 不一致，以 entries 为准
      config.id = entry.id
      characters.push(config)
    }
  }
  // 确保有激活角色
  let activeId = index.activeId
  if (!activeId || !index.entries[activeId]) {
    activeId = characters[0]?.id ?? ''
  }
  return { characters, activeId }
}

// ===== 注册 IPC =====

export function registerIpc(deps: IpcDeps) {
  const { loadPetActions, savePetActions, getPetWindow, getChatWindow, getOrCreateChatWindow, getOrCreateSettingsWindow, getAllWindows } = deps

  // 启动时确保目录结构
  ensureCharacterStructure()

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
    for (const win of getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('pet-actions:updated', actions)
      }
    }
  })

  // ===== open windows =====
  ipcMain.handle('window:openChat', () => {
    getOrCreateChatWindow()
  })

  ipcMain.handle('window:openSettings', () => {
    getOrCreateSettingsWindow()
  })

  // ===== drag move pet window =====
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
  ipcMain.handle('dialog:openVideo', async (_event, charName: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'video', extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const srcPath = result.filePaths[0]
    const folderName = sanitizeFolderName(charName)
    const baseName = srcPath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'video'
    return copyVideoToChar(folderName, srcPath, baseName)
  })

  // 解析视频完整路径（按角色文件夹）
  ipcMain.handle('character:getVideoPath', (_event, charName: string, videoFileName: string) => {
    if (!videoFileName) return null
    const folderName = sanitizeFolderName(charName)
    const fullPath = join(charVideoDir(folderName), videoFileName)
    return existsSync(fullPath) ? fullPath : null
  })

  // 列出角色视频文件夹中的所有视频文件
  ipcMain.handle('character:listVideos', (_event, charName: string) => {
    const folderName = sanitizeFolderName(charName)
    const vDir = charVideoDir(folderName)
    if (!existsSync(vDir)) return []
    try {
      return readdirSync(vDir)
        .filter((f) => {
          try { return statSync(join(vDir, f)).isFile() } catch { return false }
        })
        .filter((f) => /\.(mp4|webm|mov|avi|mkv)$/i.test(f))
    } catch {
      return []
    }
  })

  // 打开角色视频文件夹
  ipcMain.handle('dialog:openCharacterVideoFolder', async (_event, charName: string) => {
    const folderName = sanitizeFolderName(charName)
    const vDir = charVideoDir(folderName)
    ensureDir(vDir)
    await shell.openPath(vDir)
  })

  // ===== character persistence =====

  ipcMain.handle('character:getAll', () => {
    return loadCharactersData()
  })

  ipcMain.handle('character:saveAll', (_event, data: CharactersData) => {
    const index = loadIndex()
    const oldEntries = { ...index.entries }
    const newEntries: Record<string, CharacterIndexEntry> = {}

    for (const char of data.characters) {
      const existingEntry = oldEntries[char.id]
      let folderName: string

      if (existingEntry) {
        // 已有角色：名称变化 → 重命名文件夹
        if (existingEntry.folderName !== sanitizeFolderName(char.name)) {
          const success = renameCharacterDir(existingEntry.folderName, sanitizeFolderName(char.name))
          folderName = success ? sanitizeFolderName(char.name) : existingEntry.folderName
        } else {
          folderName = existingEntry.folderName
        }
      } else {
        // 新角色
        folderName = sanitizeFolderName(char.name)
        // 名称冲突处理
        let suffix = 1
        let candidate = folderName
        while (existsSync(charDir(candidate))) {
          candidate = `${sanitizeFolderName(char.name)} (${suffix})`
          suffix++
        }
        folderName = candidate
      }

      saveCharacterConfig(folderName, char)
      newEntries[char.id] = { id: char.id, folderName }
    }

    // 移除已删除的角色
    for (const [id, entry] of Object.entries(oldEntries)) {
      if (!newEntries[id]) {
        deleteCharacterDir(entry.folderName)
      }
    }

    index.entries = newEntries
    index.activeId = data.activeId
    saveIndex(index)

    // 广播到所有窗口
    for (const win of getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('characters:updated', data)
      }
    }
  })

  // ===== pet custom image (per character) =====

  ipcMain.handle('dialog:openImage', async (_event, charName: string, imageType: string) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'image', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const srcPath = result.filePaths[0]
    const folderName = sanitizeFolderName(charName)
    saveImageToChar(folderName, imageType as 'portrait' | 'avatar', srcPath)
    const dataUrl = loadImageAsDataUrl(folderName, imageType as 'portrait' | 'avatar')

    const index = loadIndex()
    const entry = Object.values(index.entries).find(e => e.folderName === folderName)
    const payload = { charId: entry?.id ?? '', charName, imageType, dataUrl }
    for (const win of getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('pet-image:updated', payload)
      }
    }
    return dataUrl
  })

  ipcMain.handle('pet-image:getCurrent', (_event, charName: string, imageType: string) => {
    const folderName = sanitizeFolderName(charName)
    return loadImageAsDataUrl(folderName, imageType as 'portrait' | 'avatar')
  })

  // ===== API Profiles persistence =====
  const apiProfilesFile = join(userDataPath, 'api-profiles.json')

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
    } catch {}
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

  // ===== Chat history persistence (per-character folder) =====

  ipcMain.handle('chat-history:get', (_event, characterId: string) => {
    const folderName = folderNameById(characterId)
    if (!folderName) return []
    return loadCharChatHistory(folderName)
  })

  ipcMain.handle('chat-history:add', (_event, characterId: string, message: ChatMessage) => {
    const folderName = folderNameById(characterId)
    if (!folderName) return
    const list = loadCharChatHistory(folderName)
    list.push(message)
    if (list.length > 1000) {
      list.splice(0, list.length - 800)
    }
    saveCharChatHistory(folderName, list)
    for (const win of getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('chat-history:updated', { characterId, message })
      }
    }
  })

  ipcMain.handle('chat-history:clear', (_event, characterId: string) => {
    const folderName = folderNameById(characterId)
    if (!folderName) return
    saveCharChatHistory(folderName, [])
  })

  // ===== Agent memory persistence (per-character folder) =====

  ipcMain.handle('agent-memory:getAll', (_event, characterId: string) => {
    const folderName = folderNameById(characterId)
    if (!folderName) return []
    return loadCharAgentMemory(folderName)
  })

  ipcMain.handle('agent-memory:add', (_event, characterId: string, entry: MemoryEntry) => {
    const folderName = folderNameById(characterId)
    if (!folderName) return
    const list = loadCharAgentMemory(folderName)
    list.push(entry)
    saveCharAgentMemory(folderName, list)
  })

  ipcMain.handle('agent-memory:delete', (_event, characterId: string, id: string) => {
    const folderName = folderNameById(characterId)
    if (!folderName) return
    const list = loadCharAgentMemory(folderName)
    saveCharAgentMemory(folderName, list.filter((e) => e.id !== id))
  })

  ipcMain.handle('agent-memory:update', (_event, characterId: string, id: string, content: string) => {
    const folderName = folderNameById(characterId)
    if (!folderName) return
    const list = loadCharAgentMemory(folderName)
    const entry = list.find((e) => e.id === id)
    if (entry) {
      entry.content = content
      entry.updatedAt = Date.now()
      saveCharAgentMemory(folderName, list)
    }
  })

  // ===== Agent Memory Import / Export =====
  ipcMain.handle('agent-memory:export', async (_event, characterId: string, charName: string) => {
    const folderName = folderNameById(characterId)
    if (!folderName) return { success: false }
    const memories = loadCharAgentMemory(folderName)

    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const safeName = charName.replace(/[<>:"/\\|?*]/g, '_')

    const result = await dialog.showSaveDialog({
      defaultPath: `agent-memory-${safeName}-${dateStr}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) return { success: false }

    try {
      writeFileSync(result.filePath, JSON.stringify(memories, null, 2), 'utf-8')
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message || '写入文件失败' }
    }
  })

  ipcMain.handle('agent-memory:import', async (_event, characterId: string) => {
    const folderName = folderNameById(characterId)
    if (!folderName) return { success: false, reason: 'character_not_found' }

    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })

    if (result.canceled || result.filePaths.length === 0) return { success: false, reason: 'canceled' }

    try {
      const raw = readFileSync(result.filePaths[0], 'utf-8')
      const data = JSON.parse(raw)

      if (!Array.isArray(data)) {
        return { success: false, reason: 'invalid_format', error: 'JSON 文件格式错误：需要数组' }
      }

      const validEntries: MemoryEntry[] = []
      let ts = Date.now()
      for (const item of data) {
        if (item && typeof item.content === 'string') {
          const source: 'ai-extracted' | 'user-explicit' =
            item.source === 'ai-extracted' ? 'ai-extracted' : 'user-explicit'
          validEntries.push({
            id: item.id || `import_${ts}_${Math.random().toString(36).slice(2, 7)}`,
            content: item.content,
            source,
            createdAt: item.createdAt || ts,
            updatedAt: item.updatedAt || ts,
          })
          ts++
        }
      }

      if (validEntries.length === 0) {
        return { success: false, reason: 'no_valid', error: '未找到有效的记忆条目。每条必须包含 "content" 字段。' }
      }

      const existing = loadCharAgentMemory(folderName)
      saveCharAgentMemory(folderName, [...existing, ...validEntries])

      return { success: true, entries: validEntries }
    } catch (e: any) {
      return { success: false, reason: 'parse_error', error: '文件解析失败: ' + (e.message || '未知错误') }
    }
  })

  // ===== open idle videos folder (fix missing handler) =====
  ipcMain.handle('dialog:openIdleVideosFolder', async () => {
    const index = loadIndex()
    const activeCharId = index.activeId
    if (!activeCharId || !index.entries[activeCharId]) return
    const folderName = index.entries[activeCharId].folderName
    const vDir = charVideoDir(folderName)
    ensureDir(vDir)
    await shell.openPath(vDir)
  })
}

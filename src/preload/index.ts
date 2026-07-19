import { contextBridge, ipcRenderer } from 'electron'
import type { PetAction, CharactersData, ApiProfilesData, ApiProfile, ChatMessage, MemoryEntry, TtsSettings, GpuInfo, ModelDownloadProgress, PipInstallProgress } from '../common/types'

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  quit: () => ipcRenderer.invoke('app:quit'),

  // 桌宠
  togglePetPassthrough: () => ipcRenderer.invoke('window:togglePetPassthrough'),
  movePet: (dx: number, dy: number): Promise<void> =>
    ipcRenderer.invoke('window:movePet', dx, dy),
  resizePet: (expand: boolean, charWinX: number, charWinY: number): Promise<void> =>
    ipcRenderer.invoke('window:resizePet', expand, charWinX, charWinY),

  // 动作持久化
  getPetActions: (): Promise<PetAction[]> => ipcRenderer.invoke('pet-actions:getAll'),
  savePetActions: (actions: PetAction[]): Promise<void> =>
    ipcRenderer.invoke('pet-actions:save', actions),
  onPetActionsUpdated: (callback: (actions: PetAction[]) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, actions: PetAction[]) => callback(actions)
    ipcRenderer.on('pet-actions:updated', listener)
    return () => ipcRenderer.removeListener('pet-actions:updated', listener)
  },

  // 打开窗口
  openChat: () => ipcRenderer.invoke('window:openChat'),
  openSettings: () => ipcRenderer.invoke('window:openSettings'),

  // 文件对话框
  openVideoDialog: (charName: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openVideo', charName),
  openIdleVideosFolder: (): Promise<void> => ipcRenderer.invoke('dialog:openIdleVideosFolder'),

  // 视频路径解析
  getVideoPath: (charName: string, videoFileName: string): Promise<string | null> =>
    ipcRenderer.invoke('character:getVideoPath', charName, videoFileName),

  // 打开角色视频文件夹
  openCharacterVideoFolder: (charName: string): Promise<void> =>
    ipcRenderer.invoke('dialog:openCharacterVideoFolder', charName),

  // 列出角色视频文件夹中的文件
  listIdleVideos: (charName: string): Promise<string[]> =>
    ipcRenderer.invoke('character:listVideos', charName),

  // 角色持久化
  getCharacters: (): Promise<CharactersData> => ipcRenderer.invoke('character:getAll'),
  saveCharacters: (data: CharactersData): Promise<void> => ipcRenderer.invoke('character:saveAll', data),
  onCharactersUpdated: (callback: (data: CharactersData) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: CharactersData) => callback(data)
    ipcRenderer.on('characters:updated', listener)
    return () => ipcRenderer.removeListener('characters:updated', listener)
  },

  // 桌宠形象图片（按角色名 + 图片类型）
  openImageDialog: (charName: string, imageType: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openImage', charName, imageType),
  getPetImage: (charName: string, imageType: string): Promise<string | null> =>
    ipcRenderer.invoke('pet-image:getCurrent', charName, imageType),
  onPetImageUpdated: (callback: (payload: { charId: string; charName: string; imageType: string; dataUrl: string | null }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { charId: string; charName: string; imageType: string; dataUrl: string | null }) =>
      callback(payload)
    ipcRenderer.on('pet-image:updated', listener)
    return () => ipcRenderer.removeListener('pet-image:updated', listener)
  },

  // 窗口失去焦点
  onPetMenuClose: (callback: () => void): (() => void) => {
    const listener = () => callback()
    ipcRenderer.on('pet:menuClose', listener)
    return () => ipcRenderer.removeListener('pet:menuClose', listener)
  },

  // ===== API Profiles =====
  getApiProfiles: (): Promise<ApiProfilesData> => ipcRenderer.invoke('api-profiles:getAll'),
  saveApiProfiles: (data: ApiProfilesData): Promise<void> => ipcRenderer.invoke('api-profiles:saveAll', data),
  testApiConnection: (profile: ApiProfile): Promise<{ ok: boolean; status: number; error?: string }> =>
    ipcRenderer.invoke('api-profiles:test', profile),
  onApiProfilesUpdated: (callback: (data: ApiProfilesData) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: ApiProfilesData) => callback(data)
    ipcRenderer.on('api-profiles:updated', listener)
    return () => ipcRenderer.removeListener('api-profiles:updated', listener)
  },

  // ===== Chat History =====
  getChatHistory: (characterId: string): Promise<ChatMessage[]> =>
    ipcRenderer.invoke('chat-history:get', characterId),
  addChatMessage: (characterId: string, message: ChatMessage): Promise<void> =>
    ipcRenderer.invoke('chat-history:add', characterId, message),
  clearChatHistory: (characterId: string): Promise<void> =>
    ipcRenderer.invoke('chat-history:clear', characterId),
  onChatHistoryUpdated: (callback: (payload: { characterId: string; message?: ChatMessage; cleared?: boolean }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { characterId: string; message?: ChatMessage; cleared?: boolean }) => callback(payload)
    ipcRenderer.on('chat-history:updated', listener)
    return () => ipcRenderer.removeListener('chat-history:updated', listener)
  },

  getAgentMemory: (characterId: string): Promise<MemoryEntry[]> =>
    ipcRenderer.invoke('agent-memory:getAll', characterId),
  addAgentMemory: (characterId: string, entry: MemoryEntry): Promise<void> =>
    ipcRenderer.invoke('agent-memory:add', characterId, entry),
  deleteAgentMemory: (characterId: string, id: string): Promise<void> =>
    ipcRenderer.invoke('agent-memory:delete', characterId, id),
  updateAgentMemory: (characterId: string, id: string, content: string): Promise<void> =>
    ipcRenderer.invoke('agent-memory:update', characterId, id, content),
  // Agent Memory Import / Export
  exportAgentMemory: (characterId: string, charName: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('agent-memory:export', characterId, charName),
  importAgentMemory: (characterId: string): Promise<{ success: boolean; entries?: MemoryEntry[]; error?: string; reason?: string }> =>
    ipcRenderer.invoke('agent-memory:import', characterId),

  // ===== TTS =====
  synthesizeTTS: (charName: string, text: string): Promise<string | null> =>
    ipcRenderer.invoke('tts:synthesize', charName, text),
  checkTtsHealth: (): Promise<boolean> =>
    ipcRenderer.invoke('tts:checkHealth'),
  getTtsStatus: (): Promise<{ status: string; port: number }> =>
    ipcRenderer.invoke('tts:getStatus'),
  getGpuInfo: (): Promise<GpuInfo> =>
    ipcRenderer.invoke('tts:getGpuInfo'),
  getTtsSettings: (): Promise<TtsSettings> =>
    ipcRenderer.invoke('tts:getSettings'),
  saveTtsSettings: (settings: TtsSettings): Promise<void> =>
    ipcRenderer.invoke('tts:saveSettings', settings),
  onTtsSettingsUpdated: (callback: (settings: TtsSettings) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, settings: TtsSettings) => callback(settings)
    ipcRenderer.on('tts-settings:updated', listener)
    return () => ipcRenderer.removeListener('tts-settings:updated', listener)
  },
  saveReferenceAudio: (charName: string): Promise<string | null> =>
    ipcRenderer.invoke('character:saveReferenceAudio', charName),
  getReferenceAudio: (charName: string): Promise<string | null> =>
    ipcRenderer.invoke('character:getReferenceAudio', charName),
  downloadModel: (): Promise<boolean> =>
    ipcRenderer.invoke('tts:downloadModel'),
  getModelStatus: (): Promise<{ ready: boolean; dir: string }> =>
    ipcRenderer.invoke('tts:getModelStatus'),
  onModelDownloadProgress: (callback: (progress: ModelDownloadProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ModelDownloadProgress) => callback(progress)
    ipcRenderer.on('tts:modelDownloadProgress', listener)
    return () => ipcRenderer.removeListener('tts:modelDownloadProgress', listener)
  },
  // Python 环境
  checkPythonEnv: (): Promise<{ status: string; pythonPath: string; pythonVersion: string; pipVersion: string; error?: string }> =>
    ipcRenderer.invoke('tts:checkPythonEnv'),
  installDeps: (): Promise<boolean> =>
    ipcRenderer.invoke('tts:installDeps'),
  onPipInstallProgress: (callback: (progress: PipInstallProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: PipInstallProgress) => callback(progress)
    ipcRenderer.on('tts:pipInstallProgress', listener)
    return () => ipcRenderer.removeListener('tts:pipInstallProgress', listener)
  },
})

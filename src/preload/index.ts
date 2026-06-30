import { contextBridge, ipcRenderer } from 'electron'
import type { PetAction, CharactersData, ApiProfilesData, ApiProfile, ChatMessage, MemoryEntry } from '../common/types'

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
  openVideoDialog: (): Promise<string | null> => ipcRenderer.invoke('dialog:openVideo'),

  // 角色持久化
  getCharacters: (): Promise<CharactersData> => ipcRenderer.invoke('character:getAll'),
  saveCharacters: (data: CharactersData): Promise<void> => ipcRenderer.invoke('character:saveAll', data),
  onCharactersUpdated: (callback: (data: CharactersData) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: CharactersData) => callback(data)
    ipcRenderer.on('characters:updated', listener)
    return () => ipcRenderer.removeListener('characters:updated', listener)
  },

  // 桌宠形象图片（按角色ID）
  openImageDialog: (charId: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openImage', charId),
  getPetImage: (charId: string): Promise<string | null> =>
    ipcRenderer.invoke('pet-image:getCurrent', charId),
  onPetImageUpdated: (callback: (payload: { charId: string; dataUrl: string | null }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { charId: string; dataUrl: string | null }) =>
      callback(payload)
    ipcRenderer.on('pet-image:updated', listener)
    return () => ipcRenderer.removeListener('pet-image:updated', listener)
  },

  // 窗口失去焦点（主进程已缩窗，渲染进程只需关菜单状态）
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
})


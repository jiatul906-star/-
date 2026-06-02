import { contextBridge, ipcRenderer } from 'electron'
import type { PetAction, CharactersData } from '../common/types'

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

  // 动作持久化
  getPetActions: (): Promise<PetAction[]> => ipcRenderer.invoke('pet-actions:getAll'),
  savePetActions: (actions: PetAction[]): Promise<void> =>
    ipcRenderer.invoke('pet-actions:save', actions),

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
})

import { contextBridge, ipcRenderer } from 'electron'
import type { PetAction } from '../common/types'

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
})

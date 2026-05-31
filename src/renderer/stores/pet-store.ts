import { create } from 'zustand'
import type { PetAction } from '../../common/types'

interface PetState {
  // 径向菜单
  menuVisible: boolean
  menuOriginX: number
  menuOriginY: number

  // 动作列表
  actions: PetAction[]

  // 视频播放
  currentVideo: string | null
  videoVisible: boolean

  // 反馈（无视频时）
  feedbackEmoji: string | null
  feedbackLabel: string | null

  // 操作
  setActions: (actions: PetAction[]) => void
  openMenu: (originX: number, originY: number) => void
  closeMenu: () => void
  triggerAction: (action: PetAction) => void
  clearVideo: () => void
}

export const usePetStore = create<PetState>((set, get) => ({
  menuVisible: false,
  menuOriginX: 0,
  menuOriginY: 0,
  actions: [],
  currentVideo: null,
  videoVisible: false,
  feedbackEmoji: null,
  feedbackLabel: null,

  setActions: (actions) => set({ actions }),

  openMenu: (originX, originY) => {
    const { menuVisible } = get()
    // 已打开则先关再开（新位置）
    if (menuVisible) {
      set({ menuVisible: false })
      setTimeout(() => set({ menuVisible: true, menuOriginX: originX, menuOriginY: originY }), 150)
    } else {
      set({ menuVisible: true, menuOriginX: originX, menuOriginY: originY })
    }
  },

  closeMenu: () => set({ menuVisible: false }),

  triggerAction: (action) => {
    if (action.type === 'chat') {
      window.electronAPI.openChat()
      set({ menuVisible: false })
      return
    }
    if (action.type === 'settings') {
      window.electronAPI.openSettings()
      set({ menuVisible: false })
      return
    }

    // 有视频 → 播放
    if (action.videoPath) {
      set({
        currentVideo: `file:///${action.videoPath.replace(/\\/g, '/')}`,
        videoVisible: true,
        menuVisible: false,
      })
    } else {
      // 无视频 → emoji 反馈
      set({
        feedbackEmoji: action.emoji,
        feedbackLabel: action.label,
        menuVisible: false,
      })
      setTimeout(() => set({ feedbackEmoji: null, feedbackLabel: null }), 1500)
    }
  },

  clearVideo: () => set({ videoVisible: false, currentVideo: null }),
}))

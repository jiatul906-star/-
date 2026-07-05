import { create } from 'zustand'
import type { PetAction, CharacterConfig, CharactersData } from '../../common/types'

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

  // 当前播放动作的元数据（裁切/色度键）
  currentActionMeta: Partial<PetAction> | null

  // 反馈（无视频时）
  feedbackEmoji: string | null
  feedbackLabel: string | null

  // 角色系统
  characters: CharacterConfig[]
  activeCharacterId: string

  // 操作 — 动作
  setActions: (actions: PetAction[]) => void
  openMenu: (originX: number, originY: number) => void
  closeMenu: () => void
  triggerAction: (action: PetAction) => void
  clearVideo: () => void

  // 操作 — 角色
  setCharactersData: (data: CharactersData) => void
  setActiveCharacterId: (id: string) => void
  updateCharacter: (char: CharacterConfig) => void
  addCharacter: (char: CharacterConfig) => void
  removeCharacter: (id: string) => void
  setCharacterImage: (charId: string, dataUrl: string | null) => void
  setCharacterAvatar: (charId: string, dataUrl: string | null) => void
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
  characters: [],
  activeCharacterId: '',

  setActions: (actions) => set({ actions }),

  openMenu: (originX, originY) => {
    const { menuVisible } = get()
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

    if (action.videoPath) {
      set({
        currentVideo: `file:///${action.videoPath.replace(/\\/g, '/')}`,
        currentActionMeta: {
          trimStart: action.trimStart,
          trimEnd: action.trimEnd,
          chromaKey: action.chromaKey,
          chromaKeyTolerance: action.chromaKeyTolerance,
          cropX: action.cropX,
          cropY: action.cropY,
          cropW: action.cropW,
          cropH: action.cropH,
        },
        videoVisible: true,
        menuVisible: false,
      })
    } else {
      set({
        feedbackEmoji: action.emoji,
        feedbackLabel: action.label,
        menuVisible: false,
      })
      setTimeout(() => set({ feedbackEmoji: null, feedbackLabel: null }), 1500)
    }
  },

  clearVideo: () => set({ videoVisible: false, currentVideo: null, currentActionMeta: null }),

  // ===== 角色操作 =====
  setCharactersData: (data) =>
    set({ characters: data.characters, activeCharacterId: data.activeId }),

  setActiveCharacterId: (id) => set({ activeCharacterId: id }),

  updateCharacter: (char) =>
    set((s) => ({
      characters: s.characters.map((c) => (c.id === char.id ? char : c)),
    })),

  addCharacter: (char) =>
    set((s) => ({
      characters: [...s.characters, char],
      activeCharacterId: char.id,
    })),

  removeCharacter: (id) =>
    set((s) => {
      const next = s.characters.filter((c) => c.id !== id)
      const activeId = id === s.activeCharacterId
        ? (next[0]?.id ?? '')
        : s.activeCharacterId
      return { characters: next, activeCharacterId: activeId }
    }),

  setCharacterAvatar: (charId, dataUrl) =>
    set((s) => ({
      characters: s.characters.map((c) =>
        c.id === charId ? { ...c, avatarDataUrl: dataUrl } : c,
      ),
    })),

  setCharacterImage: (charId, dataUrl) =>
    set((s) => ({
      characters: s.characters.map((c) =>
        c.id === charId ? { ...c, imageDataUrl: dataUrl } : c,
      ),
    })),
}))


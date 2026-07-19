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

  // 运行时图片缓存（按 charId，从文件加载为 data URL）
  characterPortraits: Record<string, string | null>
  characterAvatars: Record<string, string | null>

  // 空闲视频播放
  idleVideos: string[]
  isIdlePlaying: boolean

  // ===== TTS =====
  ttsEnabled: boolean          // 全局 TTS 开关
  ttsPlaying: boolean          // 是否正在播放 TTS
  ttsPlayingCharId: string | null  // 当前正在播放的角色
  ttsPlayState: 'idle' | 'loading' | 'playing' | 'stopped'
  ttsCurrentSentence: { index: number; total: number } | null  // 当前播放句子进度
  autoPlayTTS: boolean         // AI 回复后自动播放

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

  // 操作 — 图片缓存
  setCharacterPortrait: (charId: string, dataUrl: string | null) => void
  setCharacterAvatar: (charId: string, dataUrl: string | null) => void
  loadCharacterImages: (charId: string, charName: string) => Promise<void>
  loadAllCharacterAvatars: (chars: CharacterConfig[]) => Promise<void>

  // 操作 — 空闲视频
  setIdleVideos: (videos: string[]) => void
  setIdlePlaying: (playing: boolean) => void

  // 操作 — TTS
  setTtsEnabled: (enabled: boolean) => void
  setTtsPlaying: (playing: boolean, charId?: string | null) => void
  setTtsPlayState: (state: 'idle' | 'loading' | 'playing' | 'stopped') => void
  setTtsCurrentSentence: (sentence: { index: number; total: number } | null) => void
  setAutoPlayTTS: (auto: boolean) => void
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
  characterPortraits: {},
  characterAvatars: {},
  idleVideos: [],
  isIdlePlaying: false,

  // ===== TTS 初始值 =====
  ttsEnabled: false,
  ttsPlaying: false,
  ttsPlayingCharId: null,
  ttsPlayState: 'idle',
  ttsCurrentSentence: null,
  autoPlayTTS: false,

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

  triggerAction: async (action) => {
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
      // 通过 IPC 解析视频完整路径
      const { characters, activeCharacterId } = get()
      const activeChar = characters.find(c => c.id === activeCharacterId)
      const charName = activeChar?.name ?? ''
      let fullPath: string | null = null
      if (charName) {
        fullPath = await window.electronAPI.getVideoPath(charName, action.videoPath)
      }

      if (fullPath) {
        set({
          currentVideo: `file:///${fullPath.replace(/\\/g, '/')}`,
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
        // 视频不存在 → fallback 到 emoji 反馈
        set({
          feedbackEmoji: action.emoji,
          feedbackLabel: action.label,
          menuVisible: false,
        })
        setTimeout(() => set({ feedbackEmoji: null, feedbackLabel: null }), 1500)
      }
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

  // ===== 图片缓存 =====
  setCharacterPortrait: (charId, dataUrl) =>
    set((s) => ({
      characterPortraits: { ...s.characterPortraits, [charId]: dataUrl },
    })),

  setCharacterAvatar: (charId, dataUrl) =>
    set((s) => ({
      characterAvatars: { ...s.characterAvatars, [charId]: dataUrl },
    })),

  loadCharacterImages: async (charId, charName) => {
    const portrait = await window.electronAPI.getPetImage(charName, 'portrait')
    const avatar = await window.electronAPI.getPetImage(charName, 'avatar')
    set((s) => ({
      characterPortraits: { ...s.characterPortraits, [charId]: portrait },
      characterAvatars: { ...s.characterAvatars, [charId]: avatar },
    }))
  },

  loadAllCharacterAvatars: async (chars) => {
    const avatars: Record<string, string | null> = { ...get().characterAvatars }
    for (const c of chars) {
      if (avatars[c.id] === undefined) {
        avatars[c.id] = await window.electronAPI.getPetImage(c.name, 'avatar')
      }
    }
    set((s) => ({
      characterAvatars: { ...s.characterAvatars, ...avatars },
    }))
  },

  // ===== 空闲视频 =====
  setIdleVideos: (videos) => set({ idleVideos: videos }),
  setIdlePlaying: (playing) => set({ isIdlePlaying: playing }),

  // ===== TTS =====
  setTtsEnabled: (enabled) => set({ ttsEnabled: enabled }),
  setTtsPlaying: (playing, charId) => set({
    ttsPlaying: playing,
    ttsPlayingCharId: charId !== undefined ? charId : (playing ? get().ttsPlayingCharId : null),
  }),
  setTtsPlayState: (state) => set({ ttsPlayState: state }),
  setTtsCurrentSentence: (sentence) => set({ ttsCurrentSentence: sentence }),
  setAutoPlayTTS: (auto) => set({ autoPlayTTS: auto }),
}))

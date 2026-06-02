// 公共类型，主进程和渲染进程共享

export interface CharacterConfig {
  id: string
  name: string
  gradient: string        // CSS gradient 色值，用于 CSS 身体 + 侧边栏圆点
  imageDataUrl: string | null // base64 自定义形象，null = 使用 CSS 默认形象
  personality: string
  voiceId: string
  speechStyle: string
}

export interface CharactersData {
  characters: CharacterConfig[]
  activeId: string
}

export const DEFAULT_CHARACTERS: CharacterConfig[] = [
  {
    id: 'char_1',
    name: '小桃',
    gradient: 'linear-gradient(175deg, #FDD9C4 0%, #F2B8A0 40%, #E8A38B 100%)',
    imageDataUrl: null,
    personality: '',
    voiceId: '',
    speechStyle: '',
  },
  {
    id: 'char_2',
    name: '小蓝',
    gradient: 'linear-gradient(175deg, #C8DCF5 0%, #B0C8E8 40%, #A8C8E8 100%)',
    imageDataUrl: null,
    personality: '',
    voiceId: '',
    speechStyle: '',
  },
]

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface AppSettings {
  theme: 'warm-peach' | 'mint' | 'lavender' | 'milk-coffee' | 'sakura'
  density: 'comfortable' | 'compact'
  apiUrl: string
  apiKey: string
  model: string
}

// ===== 桌宠动作系统 =====

export interface PetAction {
  id: string
  label: string
  emoji: string
  videoPath: string // 空字符串表示未配置视频
  order: number
  type: 'normal' | 'chat' | 'settings'
}

export const DEFAULT_PET_ACTIONS: PetAction[] = [
  { id: 'pat_head', label: '摸摸头', emoji: '👋', videoPath: '', order: 0, type: 'normal' },
  { id: 'feed', label: '喂食', emoji: '🍪', videoPath: '', order: 1, type: 'normal' },
  { id: 'open_chat', label: '展开聊天', emoji: '💬', videoPath: '', order: 2, type: 'chat' },
]

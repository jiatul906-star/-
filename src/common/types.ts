// 公共类型，主进程和渲染进程共享

export interface CharacterConfig {
  id: string
  name: string
  avatar: string
  personality: string
  voiceId: string
  speechStyle: string
}

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

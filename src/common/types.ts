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

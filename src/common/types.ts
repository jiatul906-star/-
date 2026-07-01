// 公共类型，主进程和渲染进程共享

export interface CharacterConfig {
  id: string
  name: string
  gradient: string        // CSS gradient 色值，用于 CSS 身体 + 侧边栏圆点
  imageDataUrl: string | null // base64 自定义形象，null = 使用 CSS 默认形象
  personality: string
  voiceId: string
  speechStyle: string
  apiProfileId?: string    // 角色专属 API Profile ID，未设置则使用全局激活的 Profile
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

// ===== 聊天消息 =====

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  characterId: string  // 归属角色
}

// ===== API Profile（ccswitch 风格多配置） =====

export interface ApiProfile {
  id: string
  name: string            // 显示名
  baseUrl: string         // API endpoint
  apiKey: string          // API Key
  model: string           // 模型名
  isActive: boolean       // 当前激活
  maxTokens?: number
  temperature?: number
  createdAt: number
  updatedAt: number
}

export interface ApiProfilesData {
  profiles: ApiProfile[]
  activeProfileId: string
}

/** 预置 API 模板（首次启动注入） */
export const PRESET_API_PROFILES: Omit<ApiProfile, 'id' | 'apiKey' | 'isActive' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'OpenAI 官方',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    maxTokens: 4096,
    temperature: 0.7,
  },
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    maxTokens: 4096,
    temperature: 0.7,
  },
  {
    name: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    maxTokens: 4096,
    temperature: 0.7,
  },
  {
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    maxTokens: 4096,
    temperature: 0.7,
  },
  {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    maxTokens: 4096,
    temperature: 0.7,
  },
]

// ===== 智能体记忆 =====

export interface MemoryEntry {
  id: string
  content: string         // 记忆内容
  source: 'ai-extracted' | 'user-explicit'
  createdAt: number
  updatedAt: number
}

// ===== 应用设置 =====

export interface AppSettings {
  theme: 'warm-peach' | 'mint' | 'lavender' | 'milk-coffee' | 'sakura'
  density: 'comfortable' | 'compact'
}

// ===== 桌宠动作系统 =====

export interface PetAction {
  id: string
  label: string
  emoji: string
  videoPath: string // 空字符串表示未配置视频
  order: number
  type: 'normal' | 'chat' | 'settings'
  trimStart?: number       // 视频裁切起始时间（秒），可选
  trimEnd?: number         // 视频裁切结束时间（秒），可选
  chromaKey?: string       // 色度键去底颜色（如 '#00FF00'），空=不启用
  chromaKeyTolerance?: number // 色度键容差 0-255，默认 100
  cropX?: number            // 画面裁切 X%（0-100），可选
  cropY?: number            // 画面裁切 Y%（0-100），可选
  cropW?: number            // 画面裁切宽度%（0-100），可选
  cropH?: number            // 画面裁切高度%（0-100），可选
}

export const DEFAULT_PET_ACTIONS: PetAction[] = [
  { id: 'pat_head', label: '摸摸头', emoji: '👋', videoPath: '', order: 0, type: 'normal' },
  { id: 'feed', label: '喂食', emoji: '🍪', videoPath: '', order: 1, type: 'normal' },
  { id: 'open_chat', label: '展开聊天', emoji: '💬', videoPath: '', order: 2, type: 'chat' },
]

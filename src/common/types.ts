// 公共类型，主进程和渲染进程共享

export interface CharacterConfig {
  id: string
  name: string
  gradient: string        // CSS gradient 色值，用于 CSS 身体 + 侧边栏圆点
  personality: string
  /** @deprecated 由 referenceAudio 替代，保留用于向后兼容 */
  voiceId: string
  /** @deprecated 由 referenceAudio 替代，保留用于向后兼容 */
  speechStyle: string
  apiProfileId?: string    // 角色专属 API Profile ID，未设置则使用全局激活的 Profile
  // ===== TTS 字段（v0.2.0） =====
  referenceAudio: string   // 参考音频文件名（如 "ref_voice.wav"），空字符串表示未设置
  ttsEnabled: boolean      // 该角色是否启用 TTS
  ttsSpeed: number         // 语速 0.5-2.0，默认 1.0
  ttsPitch: number         // 音调 -12 ~ +12，默认 0
  customSystemPrompt?: string  // 自定义 System Prompt，设置后优先于自动构建的提示词
  // ===== 待机视频去底 =====
  idleVideoChromaKey?: string            // 待机视频去底色（如 '#00FF00'），空=不启用
  idleVideoChromaKeyTolerance?: number   // 容差 0-255，默认 100
}

export interface CharactersData {
  characters: CharacterConfig[]
  activeId: string
}

// 角色文件夹索引
export interface CharacterIndexEntry {
  id: string
  folderName: string
}

export interface CharacterIndex {
  activeId: string
  entries: Record<string, CharacterIndexEntry> // keyed by character ID
}

export const DEFAULT_CHARACTERS: CharacterConfig[] = [
  {
    id: 'char_1',
    name: '小桃',
    gradient: 'linear-gradient(175deg, #FDD9C4 0%, #F2B8A0 40%, #E8A38B 100%)',
    personality: '',
    voiceId: '',
    speechStyle: '',
    referenceAudio: '',
    ttsEnabled: false,
    ttsSpeed: 1.0,
    ttsPitch: 0,
  },
  {
    id: 'char_2',
    name: '小蓝',
    gradient: 'linear-gradient(175deg, #C8DCF5 0%, #B0C8E8 40%, #A8C8E8 100%)',
    personality: '',
    voiceId: '',
    speechStyle: '',
    referenceAudio: '',
    ttsEnabled: false,
    ttsSpeed: 1.0,
    ttsPitch: 0,
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

// ===== TTS 设置（v0.2.0） =====

export interface TtsSettings {
  enabled: boolean           // 全局 TTS 开关
  volume: number             // 全局音量 0-1，默认 0.8
  autoPlay: boolean          // AI 回复后自动播放，默认 false
}

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  enabled: false,
  volume: 0.8,
  autoPlay: false,
}

// ===== GPU 信息 =====

export interface GpuInfo {
  available: boolean         // 是否有可用的 NVIDIA GPU
  vramMB: number             // 显存大小（MB），0 表示未知/无
  model: string              // GPU 型号，如 "NVIDIA GeForce RTX 3060"
  ttsSupported: boolean      // 显存 >= 4GB → true
  ttsLevel: 'full' | 'limited' | 'unavailable'
  // full: >= 8GB, limited: 4-7GB, unavailable: <4GB 或无 NVIDIA
}

// ===== 模型下载状态 =====

export interface ModelDownloadProgress {
  stage: 'checking' | 'downloading' | 'done' | 'error'
  percent: number            // 0-100
  downloadedMB: number
  totalMB: number
  speedMBps: number          // 下载速度
  error?: string
}

// ===== Python 环境安装状态 =====

export interface PipInstallProgress {
  stage: 'preparing' | 'installing' | 'installing_indextts' | 'downloading_indextts' | 'done' | 'error'
  percent: number            // 0-100
  currentPackage: string     // 当前正在安装的包名
  output: string             // 最近一行 pip 输出
  error?: string
}

// ===== 桌宠动作系统 =====

export interface PetAction {
  id: string
  label: string
  emoji: string
  videoPath: string // 纯文件名（如 "pat_head.mp4"），空字符串表示未配置视频。运行时按角色文件夹解析完整路径
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

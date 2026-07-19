// TTS 语音插件 — 文字转语音播放
//
// 公开 API：
//   playbackManager  — 播放队列管理器
//   synthesize        — 单句合成
//   splitSentences    — 分句工具
//   checkAvailable    — 检查 TTS 是否可用
//   setVolume         — 设置音量
//   stop / isPlaying  — 音频控制

export { playbackManager } from './playback-manager'
export { synthesize, splitSentences, checkAvailable } from './synthesize'
export { setVolume, stop, isPlaying } from './audio-context'

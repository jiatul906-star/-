/**
 * PlaybackManager — TTS 播放队列管理器
 *
 * 特性：
 * - 按句分段合成+播放（流式体验）
 * - 支持打断（新消息到达→停止当前播放+清空队列）
 * - 逐句排队，上一句放完自动播放下一句
 * - 回调通知播放状态变化
 */

import { synthesize, splitSentences } from './synthesize'
import { decodeBase64, playBuffer, stop as stopAudio, isPlaying, setVolume } from './audio-context'

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'stopped'

export interface PlaybackCallbacks {
  onStateChange?: (state: PlaybackState) => void
  onSentenceStart?: (index: number, total: number) => void
  onError?: (message: string) => void
}

class PlaybackManager {
  private queue: Array<{ text: string; index: number }> = []
  private state: PlaybackState = 'idle'
  private callbacks: PlaybackCallbacks = {}
  private activeCharName: string = ''
  private processing = false
  private cancelled = false

  /** 配置回调 */
  setCallbacks(cb: PlaybackCallbacks): void {
    this.callbacks = cb
  }

  /** 获取当前播放状态 */
  getState(): PlaybackState {
    return this.state
  }

  /** 设置音量 */
  setVolume(vol: number): void {
    setVolume(vol)
  }

  /**
   * 播放完整文本 — 自动分句后逐句合成+播放
   * @param charName 角色名
   * @param text 完整文本
   */
  async play(charName: string, text: string): Promise<void> {
    // 打断当前播放
    this.stop()

    this.activeCharName = charName
    this.cancelled = false

    const sentences = splitSentences(text)
    if (sentences.length === 0) return

    // 构建播放队列
    this.queue = sentences.map((s, i) => ({ text: s, index: i }))
    this.processing = true

    await this.processQueue()
  }

  /** 停止播放并清空队列 */
  stop(): void {
    this.cancelled = true
    this.queue = []
    stopAudio()
    this.setState('stopped')
    this.processing = false
  }

  /**
   * 使用共享 AudioContext 播放队列中的下一句
   * 利用 audio-context.ts 的全局单例，确保 stop() 和音量控制正常工作
   */
  private async processQueue(): Promise<void> {
    if (this.cancelled || this.queue.length === 0) {
      this.processing = false
      if (!this.cancelled) {
        this.setState('idle')
      }
      return
    }

    const { text, index } = this.queue.shift()!
    const total = this.queue.length + 1 + index

    this.callbacks.onSentenceStart?.(index, index + this.queue.length + 1)
    this.setState('loading')

    try {
      const base64 = await synthesize(this.activeCharName, text)
      if (this.cancelled) return

      if (!base64) {
        console.warn(`[PlaybackManager] 合成失败: "${text.slice(0, 20)}..."`)
        this.callbacks.onError?.(`合成失败: ${text.slice(0, 20)}...`)
        await this.processQueue()
        return
      }

      this.setState('playing')

      // 使用共享 AudioContext 解码并播放
      // decodeBase64 和 playBuffer 来自 audio-context.ts 的全局单例
      // 这确保：1) stop() 能立即停止播放 2) 音量设置全局生效 3) 不重复创建 AudioContext
      await playBuffer(await decodeBase64(base64))

      if (this.cancelled) {
        return
      }

      // 播放下一句
      await this.processQueue()
    } catch (err: any) {
      console.error('[PlaybackManager] 播放异常:', err.message)
      this.callbacks.onError?.(err.message)
      if (!this.cancelled) {
        await this.processQueue()
      }
    }
  }

  private setState(state: PlaybackState): void {
    this.state = state
    this.callbacks.onStateChange?.(state)
  }
}

/** 全局单例 */
export const playbackManager = new PlaybackManager()

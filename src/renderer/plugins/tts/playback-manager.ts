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
import { playBuffer, stop as stopAudio, isPlaying, setVolume } from './audio-context'

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

  /** 播放队列中的下一句 */
  private async processQueue(): Promise<void> {
    if (this.cancelled || this.queue.length === 0) {
      this.processing = false
      if (!this.cancelled) {
        this.setState('idle')
      }
      return
    }

    const { text, index } = this.queue.shift()!
    const total = this.queue.length + 1 + index // 原始总数

    this.callbacks.onSentenceStart?.(index, index + this.queue.length + 1)
    this.setState('loading')

    try {
      const base64 = await synthesize(this.activeCharName, text)
      if (this.cancelled) return

      if (!base64) {
        // 合成失败 → 跳过当前句，继续下一句
        console.warn(`[PlaybackManager] 合成失败: "${text.slice(0, 20)}..."`)
        this.callbacks.onError?.(`合成失败: ${text.slice(0, 20)}...`)
        await this.processQueue()
        return
      }

      this.setState('playing')

      // 解码并播放
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }

      const ctx = new AudioContext()
      let buffer: AudioBuffer
      try {
        buffer = await ctx.decodeAudioData(bytes.buffer)
      } catch {
        // 解码失败
        ctx.close()
        this.callbacks.onError?.(`解码失败: ${text.slice(0, 20)}...`)
        await this.processQueue()
        return
      }

      // 创建播放源（不走 audio-context 的全局单例模式，因为需要独立控制）
      const source = ctx.createBufferSource()
      source.buffer = buffer

      // 通过 audio-context 的 gainNode 控制音量
      const gainNode = ctx.createGain()
      // 从 settings 读取音量...
      gainNode.gain.value = 0.8
      source.connect(gainNode)
      gainNode.connect(ctx.destination)

      await new Promise<void>((resolve) => {
        source.onended = () => {
          ctx.close()
          resolve()
        }
        source.start(0)
      })

      if (this.cancelled) {
        try { ctx.close() } catch {}
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

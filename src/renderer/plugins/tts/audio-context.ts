/**
 * AudioContext 封装 — Web Audio API 播放管理
 *
 * 职责：base64 → AudioBuffer → AudioBufferSourceNode → 播放
 * 单例模式，全局共享一个 AudioContext
 */

let ctx: AudioContext | null = null
let gainNode: GainNode | null = null
let currentSource: AudioBufferSourceNode | null = null

/** 获取或创建全局 AudioContext */
function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    gainNode = ctx.createGain()
    gainNode.connect(ctx.destination)
  }
  // 恢复被浏览器暂停的 context（需要用户手势后才能播放）
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  return ctx
}

/** 获取全局 GainNode */
function getGain(): GainNode {
  const c = getCtx()
  if (!gainNode) {
    gainNode = c.createGain()
    gainNode.connect(c.destination)
  }
  return gainNode
}

/** 设置全局音量 0-1 */
export function setVolume(vol: number): void {
  const gain = getGain()
  gain.gain.value = Math.max(0, Math.min(1, vol))
}

/**
 * 解码 base64 音频数据为 AudioBuffer
 * 使用全局唯一的 AudioContext，解码前自动 resume()
 */
export async function decodeBase64(base64: string): Promise<AudioBuffer> {
  const c = getCtx()
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return c.decodeAudioData(bytes.buffer)
}

/** 播放 AudioBuffer，返回 Promise 在播放完成时 resolve */
export function playBuffer(buffer: AudioBuffer): Promise<void> {
  stop()
  const c = getCtx()
  const source = c.createBufferSource()
  source.buffer = buffer
  source.connect(getGain())
  currentSource = source

  return new Promise<void>((resolve) => {
    source.onended = () => {
      if (currentSource === source) {
        currentSource = null
      }
      resolve()
    }
    source.start(0)
  })
}

/**
 * 从 base64 直接播放音频（解码 + 播放一步完成）
 * 调用时会自动停止当前正在播放的音频
 */
export async function playBase64(base64: string): Promise<void> {
  const buffer = await decodeBase64(base64)
  return playBuffer(buffer)
}

/** 停止当前播放 */
export function stop(): void {
  if (currentSource) {
    try {
      currentSource.stop(0)
    } catch {
      // 可能已经停止了
    }
    currentSource = null
  }
}

/** 是否正在播放 */
export function isPlaying(): boolean {
  return currentSource !== null
}

/** 获取全局 AudioContext（供外部直接使用 context 能力） */
export function getAudioContext(): AudioContext | null {
  return ctx
}

/** 销毁 AudioContext（应用退出时调用） */
export function destroy(): void {
  stop()
  if (ctx) {
    ctx.close()
    ctx = null
    gainNode = null
  }
}

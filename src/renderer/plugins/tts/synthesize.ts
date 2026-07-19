/**
 * TTS 合成 — 通过 IPC 调用主进程 → Python IndexTTS 服务
 *
 * 职责：将文本发送到 TTS 服务，返回 base64 编码的 WAV 音频
 */

/**
 * 合成单句语音
 * @param charName 角色名（用于查找参考音频）
 * @param text 待合成的文本
 * @returns base64 编码的 WAV 音频，失败返回 null
 */
export async function synthesize(charName: string, text: string): Promise<string | null> {
  if (!text.trim()) return null
  try {
    return window.electronAPI.synthesizeTTS(charName, text)
  } catch (err: any) {
    console.error('[TTS] synthesize IPC 失败:', err.message)
    return null
  }
}

/**
 * 按标点分句
 * 分割规则：遇到 。！？\n 时分句，保留标点符号
 */
export function splitSentences(text: string): string[] {
  const sentences: string[] = []
  // 在标点后分割，保留标点
  const parts = text.split(/(?<=[。！？\n])/g)
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.length > 0) {
      sentences.push(trimmed)
    }
  }
  // 如果没有任何标点 → 整段作为一个句子
  if (sentences.length === 0 && text.trim()) {
    sentences.push(text.trim())
  }
  return sentences
}

/**
 * 检查 TTS 是否可用
 */
export async function checkAvailable(): Promise<boolean> {
  try {
    return window.electronAPI.checkTtsHealth()
  } catch {
    return false
  }
}

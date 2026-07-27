// AI API 调用 — OpenAI 兼容流式接口
// 职责：封装 API 调用，处理流式响应

import type { ChatMessage, MemoryEntry, ApiProfile, CharacterConfig } from '../../../common/types'

/** 构建 System Prompt */
export function buildSystemPrompt(char: CharacterConfig, memory: MemoryEntry[]): string {
  // 如果设置了自定义 System Prompt，直接返回
  if (char.customSystemPrompt) {
    return char.customSystemPrompt
  }

  const parts: string[] = []

  parts.push(`你的名字是${char.name}。`)

  if (char.personality) {
    parts.push(`\n你的性格：${char.personality}`)
  }
  if (char.speechStyle) {
    parts.push(`\n你的说话风格：${char.speechStyle}`)
  }

  if (memory.length > 0) {
    const memoryLines = memory.map((m) => `- ${m.content}`).join('\n')
    parts.push(`\n关于与你对话的人，你记得：\n${memoryLines}`)
  }

  parts.push('\n请用自然、拟人化的方式回复。保持与你的角色性格一致。回复简洁，不要过长。')

  return parts.join('\n')
}

/** 流式调用 AI API */
export async function* streamChat(
  messages: ChatMessage[],
  profile: ApiProfile,
  systemPrompt: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const url = `${profile.baseUrl.replace(/\/+$/, '')}/chat/completions`

  const body: Record<string, unknown> = {
    model: profile.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    stream: true,
    max_tokens: profile.maxTokens || 4096,
    temperature: profile.temperature ?? 0.7,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${profile.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let msg = `HTTP ${response.status}`
    if (response.status === 401 || response.status === 403) {
      msg = 'API Key 无效，请检查设置'
    } else if (response.status === 404) {
      msg = 'API 地址不正确，请检查 Base URL 和模型名称'
    } else if (response.status === 429) {
      msg = '请求过于频繁，请稍后重试'
    } else if (response.status === 400) {
      // Bad request — often model name or parameters
      try {
        const err = JSON.parse(text)
        msg = err.error?.message || '请求参数错误，请检查模型名称和 API 地址'
      } catch {
        msg = '请求参数错误 (400)，请检查模型名称和 API 地址'
      }
    } else if (response.status >= 500) {
      msg = '服务器错误，请稍后重试'
    } else if (text) {
      try {
        const err = JSON.parse(text)
        msg = err.error?.message || msg
      } catch {}
    }
    throw new Error(msg)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('无法读取响应流')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) yield delta
        } catch {
          // 跳过无法解析的行
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/** 非流式调用 AI API（用于记忆提取等后台任务） */
export async function chatOnce(
  userMessage: string,
  profile: ApiProfile,
  systemPrompt: string,
): Promise<string> {
  const url = `${profile.baseUrl.replace(/\/+$/, '')}/chat/completions`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${profile.apiKey}`,
    },
    body: JSON.stringify({
      model: profile.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      stream: false,
      max_tokens: profile.maxTokens || 1024,
      temperature: 0.3, // 低温度，更确定性的输出
    }),
  })

  if (!response.ok) throw new Error(`API 错误 (${response.status})`)
  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

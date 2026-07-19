import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { usePetStore } from '../stores/pet-store'
import { streamChat, buildSystemPrompt } from '../plugins/chat/api'
import { playbackManager } from '../plugins/tts'
import type { ChatMessage, ApiProfile, MemoryEntry } from '../../common/types'
import './chat.css'

// 本地显示用的消息类型（扩展 ChatMessage）
interface DisplayMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'error'
  content: string
  timestamp: string
}

const WELCOME_MESSAGES: DisplayMessage[] = [
  { id: 'w1', role: 'assistant', content: '你好呀！今天想聊些什么呢？', timestamp: '' },
]

/** TTS 播放按钮 — 每条 AI 消息旁 */
function TtsPlayButton({ messageId, charName, content, charId }: {
  messageId: string
  charName: string
  content: string
  charId: string
}) {
  const { ttsEnabled, ttsPlaying, ttsPlayingCharId, ttsPlayState, setTtsPlaying, setTtsPlayState } = usePetStore()
  const [ttsHealthy, setTtsHealthy] = useState(true)

  // 定期检查 TTS 服务健康状态
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    const check = () => {
      window.electronAPI.checkTtsHealth().then(setTtsHealthy).catch(() => setTtsHealthy(false))
    }
    check()
    interval = setInterval(check, 30_000) // 每 30s 检查一次
    return () => { if (interval) clearInterval(interval) }
  }, [])

  const isThisPlaying = ttsPlaying && ttsPlayingCharId === charId
  const isLoading = isThisPlaying && ttsPlayState === 'loading'
  const canPlay = ttsEnabled && ttsHealthy

  const handlePlay = () => {
    if (isThisPlaying) {
      // 停止播放
      playbackManager.stop()
      setTtsPlaying(false, null)
      setTtsPlayState('stopped')
    } else {
      // 检查是否启用
      if (!canPlay) return
      setTtsPlaying(true, charId)
      playbackManager.play(charName, content).finally(() => {
        setTtsPlaying(false, null)
      })
    }
  }

  const getTitle = () => {
    if (!ttsEnabled) return '语音功能未启用'
    if (!ttsHealthy) return '语音服务不可用'
    if (isLoading) return '正在加载...'
    if (isThisPlaying) return '停止播放'
    return '播放语音'
  }

  return (
    <button
      className={`chat-tts-btn${isThisPlaying ? ' playing' : ''}${isLoading ? ' loading' : ''}${!ttsHealthy && ttsEnabled ? ' error' : ''}`}
      onClick={handlePlay}
      title={getTitle()}
      disabled={!canPlay}
    >
      {!ttsHealthy && ttsEnabled ? '⚠️' : isLoading ? '⏳' : isThisPlaying ? '⏹' : '🔊'}
    </button>
  )
}

export default function ChatWindow() {
  const {
    characters,
    activeCharacterId,
    characterAvatars,
    setCharactersData,
    setActiveCharacterId,
    setCharacterAvatar,
    loadAllCharacterAvatars,
    // TTS
    autoPlayTTS,
    ttsEnabled,
    ttsPlayState,
    setTtsPlaying,
    setTtsPlayState,
    setTtsCurrentSentence,
  } = usePetStore()

  const activeChar = useMemo(
    () => characters.find((c) => c.id === activeCharacterId) ?? characters[0] ?? null,
    [characters, activeCharacterId],
  )

  const [messages, setMessages] = useState<DisplayMessage[]>(WELCOME_MESSAGES)
  const [inputText, setInputText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
 const abortRef = useRef<AbortController | null>(null)
  const lastUserTextRef = useRef('')

  // API Profile 状态
  const [apiProfiles, setApiProfiles] = useState<ApiProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string>('')
  const [showApiPicker, setShowApiPicker] = useState(false)
  const [isDark, setIsDark] = useState(() => (localStorage.getItem("theme-mode") || "light") === "dark")

  // 记忆状态
  const [memories, setMemories] = useState<MemoryEntry[]>([])

  // 角色专属 API Profile 优先，否则使用全局激活的
  const effectiveProfileId = useMemo(
    () => activeChar?.apiProfileId || activeProfileId,
    [activeChar?.apiProfileId, activeProfileId],
  )
  const activeProfile = useMemo(
    () => apiProfiles.find((p) => p.id === effectiveProfileId) ?? null,
    [apiProfiles, effectiveProfileId],
  )

  // 初始化：加载角色 + API Profiles + 聊天历史 + 记忆
  useEffect(() => {
    window.electronAPI.getCharacters().then((data) => {
      setCharactersData(data)
      loadAllCharacterAvatars(data.characters)
    })

    const unsubChars = window.electronAPI.onCharactersUpdated((data) => {
      setCharactersData(data)
      loadAllCharacterAvatars(data.characters)
    })
    const unsubImage = window.electronAPI.onPetImageUpdated(({ charId, imageType, dataUrl }) => {
      if (imageType === 'portrait') return // ChatWindow 只关心 avatar
      setCharacterAvatar(charId, dataUrl)
    })

    // 加载 API Profiles
    window.electronAPI.getApiProfiles().then((data) => {
      setApiProfiles(data.profiles)
      setActiveProfileId(data.activeProfileId)
    })
    const unsubProfiles = window.electronAPI.onApiProfilesUpdated((data) => {
      setApiProfiles(data.profiles)
      setActiveProfileId(data.activeProfileId)
    })

    const unsubHistory = window.electronAPI.onChatHistoryUpdated((payload) => {
      // read latest active character from store to avoid stale closure
      const store = usePetStore.getState()
      const currentChar = store.characters.find((c) => c.id === store.activeCharacterId) ?? null
      if (payload.characterId === currentChar?.id && currentChar) {
        window.electronAPI.getChatHistory(currentChar.id).then((history) => {
          if (history.length > 0) {
            const displayMsgs = history.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: formatTime(m.timestamp),
            }))
            setMessages(displayMsgs)
          }
        })
      }
    })

    return () => {
      unsubChars()
      unsubImage()
      unsubProfiles()
      unsubHistory()
    }
  }, [setCharactersData, setCharacterAvatar, loadAllCharacterAvatars])

  // 切换角色时加载历史 + 记忆
  useEffect(() => {
    if (activeChar) {
      window.electronAPI.getChatHistory(activeChar.id).then((history) => {
        if (history.length > 0) {
          const displayMsgs: DisplayMessage[] = history.map((m) => ({
            id: m.id,
            role: m.role as DisplayMessage['role'],
            content: m.content,
            timestamp: formatTime(m.timestamp),
          }))
          setMessages(displayMsgs)
        } else {
          setMessages(WELCOME_MESSAGES)
        }
      })
      window.electronAPI.getAgentMemory(activeChar.id).then(setMemories)
    }
  }, [activeChar?.id])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // TTS: 跟踪最后一条完成的 AI 消息 ID
  const lastCompleteAiIdRef = useRef<string | null>(null)

  // 初始化 TTS 设置
  useEffect(() => {
    window.electronAPI.getTtsSettings().then((s) => {
      usePetStore.getState().setTtsEnabled(s.enabled)
      usePetStore.getState().setAutoPlayTTS(s.autoPlay)
      playbackManager.setVolume(s.volume)
    })
    const unsub = window.electronAPI.onTtsSettingsUpdated((s) => {
      usePetStore.getState().setTtsEnabled(s.enabled)
      usePetStore.getState().setAutoPlayTTS(s.autoPlay)
      playbackManager.setVolume(s.volume)
    })
    return unsub
  }, [])

  // TTS 播放回调
  useEffect(() => {
    playbackManager.setCallbacks({
      onStateChange: (state) => setTtsPlayState(state),
      onSentenceStart: (index, total) => setTtsCurrentSentence({ index: index + 1, total }),
      onError: (msg) => console.warn('[TTS]', msg),
    })
  }, [setTtsPlayState, setTtsCurrentSentence])

  // ===== 发送消息 =====
  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim()
    if (!text || isStreaming) return

    // 打断 TTS
    playbackManager.stop()
    setTtsPlaying(false, null)

    setErrorMsg(null)
    if (overrideText === undefined) {
      setInputText('')
    }
    lastUserTextRef.current = text

    const now = Date.now()
    const time = formatTime(now)

    const userMsg: DisplayMessage = {
      id: `user_${now}`,
      role: 'user',
      content: text,
      timestamp: time,
    }

    // 创建 AI 占位消息
    const aiMsgId = `ai_${now}`
    const aiPlaceholder: DisplayMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: time,
    }

    setMessages((prev) => [...prev, userMsg, aiPlaceholder])

    // 保存用户消息
    if (activeChar) {
      const msg: ChatMessage = { id: userMsg.id, role: 'user', content: text, timestamp: now, characterId: activeChar.id }
      window.electronAPI.addChatMessage(activeChar.id, msg).catch(() => {})
    }

    // 检测"记住 xxx"触发词
    const rememberMatch = text.match(/^记住[：:]?\s*(.+)/)
    if (rememberMatch && activeChar) {
      const content = rememberMatch[1].trim()
      const memoryEntry: MemoryEntry = {
        id: `mem_${Date.now()}`,
        content,
        source: 'user-explicit',
        createdAt: now,
        updatedAt: now,
      }
      window.electronAPI.addAgentMemory(activeChar.id, memoryEntry).then(() => {
        window.electronAPI.getAgentMemory(activeChar.id).then(setMemories)
      }).catch(() => {})
    }

    // 检测设定语句，自动追加到性格描述
    const settingPatterns = [
      /^你是(.+)$/,
      /^从今以后你(?:是|就是)(.+)$/,
      /^你的设定是(.+)$/,
      /^设定[：:]\s*(.+)$/,
    ]
    let extractedTrait: string | null = null
    for (const pat of settingPatterns) {
      const m = text.match(pat)
      if (m) { extractedTrait = m[1].trim(); break }
    }
    // 过滤：排除疑问句（谁/什么/哪/干/怎么），排除过长（>30字）
    const questionWords = /^(谁|什么|哪|干|怎么|干嘛|啥|做|是|不|有|可|会|能|要|想|可以|应该)/
    const isValidTrait = extractedTrait
      && extractedTrait.length >= 1
      && extractedTrait.length <= 30
      && !questionWords.test(extractedTrait)
    if (isValidTrait && activeChar) {
      const existing = (activeChar.personality || '').trim()
      const newPersonality = existing
        ? existing + '\n' + extractedTrait
        : extractedTrait
      const updated = { ...activeChar, personality: newPersonality }
      updateCharacter(updated)
      const allChars = usePetStore.getState().characters.map((c) => (c.id === activeChar.id ? updated : c))
      window.electronAPI.saveCharacters({ characters: allChars, activeId: activeCharacterId }).catch(() => {})
    }

    // 检查 API 配置
    if (!activeProfile || !activeProfile.apiKey || !activeProfile.baseUrl) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, role: 'error' as const, content: '请先配置 API Key。点击 ⚙ 进入设置 > API 配置。' }
            : m,
        ),
      )
      return
    }

    // 流式调用 AI
    setIsStreaming(true)
    const controller = new AbortController()
    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 30000)
    abortRef.current = controller

    try {
      const systemPrompt = activeChar
        ? buildSystemPrompt(activeChar, memories)
        : '你是一个友好的 AI 聊天伴侣。'

      const apiMessages: ChatMessage[] = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: now,
          characterId: activeChar?.id ?? '',
        }))

      apiMessages.push({
        id: userMsg.id,
        role: 'user',
        content: text,
        timestamp: now,
        characterId: activeChar?.id ?? '',
      })

      let fullContent = ''
      for await (const token of streamChat(apiMessages, activeProfile, systemPrompt, controller.signal)) {
        fullContent += token
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: fullContent } : m)),
        )
      }

      // 保存 AI 回复
      if (activeChar && fullContent) {
        const aiMsg: ChatMessage = {
          id: aiMsgId,
          role: 'assistant',
          content: fullContent,
          timestamp: Date.now(),
          characterId: activeChar.id,
        }
        window.electronAPI.addChatMessage(activeChar.id, aiMsg).catch(() => {})
      }

      // TTS 自动播放
      lastCompleteAiIdRef.current = aiMsgId
      const store = usePetStore.getState()
      if (activeChar && fullContent && store.autoPlayTTS && store.ttsEnabled && activeChar.ttsEnabled) {
        setTtsPlaying(true, activeChar.id)
        playbackManager.play(activeChar.name, fullContent).finally(() => {
          setTtsPlaying(false, null)
        })
      }
    } catch (err: any) {
     if (err.name === 'AbortError') {
        if (timedOut) {
          setErrorMsg('请求超时，请检查网络连接')
        } else {
          // 用户取消了
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId && !m.content
                ? { ...m, role: 'error' as const, content: '已取消发送' }
                : m,
            ),
          )
        }
      } else {
        const errText = err.message || '请求失败，请检查网络或 API 配置'
        setErrorMsg(errText)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, role: 'error' as const, content: m.content ? m.content + '\n\n[错误: ' + errText + ']' : errText }
              : m,
          ),
        )
      }
    } finally {
      clearTimeout(timeoutId)
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [inputText, isStreaming, activeChar, activeProfile, messages, memories, errorMsg])

  // 取消当前流式输出
 const cancelStream = useCallback(() => {
   abortRef.current?.abort()
 }, [])

  const handleRetry = useCallback(() => {
    const text = lastUserTextRef.current
    if (text) {
      sendMessage(text)
    }
  }, [sendMessage])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage],
  )

  const onInput = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [])

  const handleSelectChar = useCallback(
    (id: string) => {
      setActiveCharacterId(id)
    },
    [setActiveCharacterId],
  )

  const handleNewChar = useCallback(() => {
    window.electronAPI.openSettings()
  }, [])

  const handleSwitchProfile = useCallback((id: string) => {
    setActiveProfileId(id)
    setShowApiPicker(false)
  }, [])

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev
      const mode = next ? "dark" : "light"
      localStorage.setItem("theme-mode", mode)
      document.documentElement.setAttribute("data-theme", mode)
      return next
    })
  }, [])

  return (
    <div className="chat-window" style={{ pointerEvents: 'auto' }}>
      {/* 自定义标题栏 */}
      <div className="chat-titlebar">
        {/* 设置齿轮 */}
        {activeChar && (
          <>
            <div
              className="chat-titlebar-avatar"
              style={{
                background: characterAvatars[activeChar.id]
                  ? `url(${characterAvatars[activeChar.id]}) center/cover no-repeat`
                  : activeChar.gradient,
              }}
            />
            <span className="chat-titlebar-name">{activeChar.name}</span>
            <button
              className="chat-titlebar-gear"
              onClick={() => window.electronAPI.openSettings()}
              title="设置"
            >
              ⚙
            </button>
            <button
              className="chat-titlebar-theme"
              onClick={toggleTheme}
              title={isDark ? "切换到浅色模式" : "切换到深色模式"}
            >
              {isDark ? "☀️" : "🌙"}
            </button>
          </>
        )}
        {/* API 选择器 */}
        <div className="chat-api-selector">
          <button
            className="chat-api-current"
            onClick={() => setShowApiPicker(!showApiPicker)}
            title={activeProfile ? `${activeProfile.name} / ${activeProfile.model}${activeChar?.apiProfileId ? ' (角色专属)' : ''}` : '未配置 API'}
          >
            {activeProfile ? activeProfile.name : '未配置'}
            {activeChar?.apiProfileId && <span className="api-char-badge" title="角色专属 API">👤</span>}
          </button>
          {showApiPicker && (
            <div className="chat-api-dropdown">
              {apiProfiles.map((p) => (
                <button
                  key={p.id}
                  className={`chat-api-option${p.id === effectiveProfileId ? ' active' : ''}`}
                  onClick={() => handleSwitchProfile(p.id)}
                >
                  <span className="api-opt-name">{p.name}</span>
                  <span className="api-opt-model">{p.model}</span>
                </button>
              ))}
              <div className="chat-api-divider" />
              <button
                className="chat-api-option settings-link"
                onClick={() => { window.electronAPI.openSettings(); setShowApiPicker(false); }}
              >
                ⚙ 管理 API 配置
              </button>
            </div>
          )}
        </div>
        {/* 关闭选择器点击外部 */}
        {showApiPicker && <div className="chat-api-backdrop" onClick={() => setShowApiPicker(false)} />}
        <div className="chat-titlebar-actions">
          <button className="chat-titlebar-btn" onClick={() => window.electronAPI.minimize()} title="最小化">─</button>
          <button className="chat-titlebar-btn" onClick={() => window.electronAPI.maximize()} title="最大化">□</button>
          <button className="chat-titlebar-btn close" onClick={() => window.electronAPI.close()} title="关闭">✕</button>
        </div>
      </div>

      {/* 主体：左侧栏 + 聊天区 */}
      <div className="chat-body">
        {/* 角色侧边栏 */}
        <div className="chat-sidebar">
          {characters.map((c) => (
            <button
              key={c.id}
              className={`chat-char-btn${c.id === activeCharacterId ? ' active' : ''}`}
              onClick={() => handleSelectChar(c.id)}
              style={{
                background: characterAvatars[c.id]
                  ? `url(${characterAvatars[c.id]}) center/cover no-repeat`
                  : c.gradient,
              }}
              title={c.name}
            />
          ))}
          <button className="chat-char-btn add" title="新建角色" onClick={handleNewChar}>
            +
          </button>
        </div>

        {/* 消息区域 */}
        <div className="chat-area">
          {/* 错误提示条 */}
          {errorMsg && (
            <div className="chat-error-bar">
              <span>{errorMsg}</span>
              <button className="chat-error-retry" onClick={handleRetry}>↻ 重试</button>
              <button onClick={() => setErrorMsg(null)}>✕</button>
            </div>
          )}

          <div className="chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-msg ${msg.role}`}>
                {msg.role === 'assistant' && activeChar && (
                  <div className="chat-msg-avatar" style={{
                    background: activeChar.avatarDataUrl
                      ? `url(${activeChar.avatarDataUrl}) center/cover no-repeat`
                      : activeChar.gradient,
                  }} />
                )}
                {msg.role === 'error' && (
                  <div className="chat-msg-avatar chat-msg-avatar-error">!</div>
                )}
                <div>
                  <div className="chat-msg-row">
                    <div className={`chat-msg-bubble${msg.role === 'error' ? ' error' : ''}`}>
                      {msg.content || (msg.role === 'assistant' && isStreaming ? <span className="chat-cursor">▍</span> : '')}
                      {msg.role === 'assistant' && isStreaming && messages[messages.length - 1]?.id === msg.id && (
                        <span className="chat-cursor">▍</span>
                      )}
                    </div>
                    {/* TTS 播放按钮 — 仅对 AI 消息且有内容时显示 */}
                    {msg.role === 'assistant' && msg.content && activeChar && (
                      <TtsPlayButton
                        messageId={msg.id}
                        charName={activeChar.name}
                        content={msg.content}
                        charId={activeChar.id}
                      />
                    )}
                  </div>
                  {msg.timestamp && <div className="chat-msg-time">{msg.timestamp}</div>}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 */}
          <div className="chat-input-area">
            <textarea
              ref={textareaRef}
              className="chat-input"
              rows={1}
              placeholder={isStreaming ? 'AI 回复中...' : '输入消息...'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={onKeyDown}
              onInput={onInput}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <motion.button
                className="chat-btn-stop"
                onClick={cancelStream}
                whileTap={{ scale: 0.9 }}
              >
                ■
              </motion.button>
            ) : (
              <motion.button
                className="chat-btn-send"
                onClick={sendMessage}
                disabled={!inputText.trim()}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.08 }}
              >
                ↑
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

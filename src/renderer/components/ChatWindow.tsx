import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { usePetStore } from '../stores/pet-store'
import './chat.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const INITIAL_MESSAGES: Message[] = [
  { id: '1', role: 'assistant', content: '你好呀！今天想聊些什么呢？', timestamp: '10:32' },
  { id: '2', role: 'user', content: '今天天气真好', timestamp: '10:33' },
  { id: '3', role: 'assistant', content: '是呀～阳光暖暖的，心情都变好了呢 ☀️', timestamp: '10:33' },
  { id: '4', role: 'user', content: '要不要出去走走', timestamp: '10:34' },
  { id: '5', role: 'assistant', content: '好呀！不过你要带上我哦 ▍', timestamp: '10:34' },
]

export default function ChatWindow() {
  const {
    characters,
    activeCharacterId,
    setCharactersData,
    setActiveCharacterId,
    setCharacterImage,
  } = usePetStore()

  const activeChar = useMemo(
    () => characters.find((c) => c.id === activeCharacterId) ?? characters[0] ?? null,
    [characters, activeCharacterId],
  )

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 加载角色列表
  useEffect(() => {
    window.electronAPI.getCharacters().then(setCharactersData)

    const unsubChars = window.electronAPI.onCharactersUpdated(setCharactersData)
    const unsubImage = window.electronAPI.onPetImageUpdated(({ charId, dataUrl }) => {
      setCharacterImage(charId, dataUrl)
    })

    return () => {
      unsubChars()
      unsubImage()
    }
  }, [setCharactersData, setCharacterImage])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 发送消息
  const sendMessage = useCallback(() => {
    const text = inputText.trim()
    if (!text) return

    const now = new Date()
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: time,
    }

    setMessages((prev) => [...prev, userMsg])
    setInputText('')

    setTimeout(() => {
      const aiReplies = [
        '嗯嗯～我明白你的意思',
        '说得对呢！',
        '哈哈，你比我想得周到',
        '这个我还没想过呢，展开讲讲？',
        '好有道理的样子',
        '对对对！就是这样',
      ]
      const aiMsg: Message = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: aiReplies[Math.floor(Math.random() * aiReplies.length)],
        timestamp: time,
      }
      setMessages((prev) => [...prev, aiMsg])
    }, 600 + Math.random() * 800)
  }, [inputText])

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

  return (
    <div className="chat-window" style={{ pointerEvents: 'auto' }}>
      {/* 小角色骑在边框上 */}
      <div className="chat-pet-on-border" title="双击回到桌宠模式">
        <div className="chat-pet-face">
          <div className="chat-pet-eyes">
            <div className="chat-pet-eye" />
            <div className="chat-pet-eye" />
          </div>
          <div className="chat-pet-mouth" />
        </div>
      </div>

      {/* 自定义标题栏 */}
      <div className="chat-titlebar">
        {activeChar && (
          <>
            <div
              className="chat-titlebar-avatar"
              style={{ background: activeChar.gradient }}
            />
            <span className="chat-titlebar-name">{activeChar.name}</span>
          </>
        )}
        <button
          className="chat-titlebar-gear"
          onClick={() => window.electronAPI.openSettings()}
          title="设置"
        >
          ⚙
        </button>
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
              style={{ background: c.gradient }}
              title={c.name}
            />
          ))}
          <button className="chat-char-btn add" title="新建角色" onClick={handleNewChar}>
            +
          </button>
        </div>

        {/* 消息区域 */}
        <div className="chat-area">
          <div className="chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-msg ${msg.role}`}>
                {msg.role === 'assistant' && activeChar && (
                  <div className="chat-msg-avatar" style={{ background: activeChar.gradient }} />
                )}
                <div>
                  <div className="chat-msg-bubble">{msg.content}</div>
                  <div className="chat-msg-time">{msg.timestamp}</div>
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
              placeholder="输入消息..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={onKeyDown}
              onInput={onInput}
            />
            <motion.button
              className="chat-btn-send"
              onClick={sendMessage}
              disabled={!inputText.trim()}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.08 }}
            >
              ↑
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}

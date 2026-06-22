import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { PetAction } from '../../common/types'

export interface ChatBubbleMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  actions: PetAction[]
  visible: boolean
  cx: number
  cy: number
  onAction: (action: PetAction) => void
  onClose: () => void
  onSendChat?: (text: string) => void
  chatMessages?: ChatBubbleMessage[]
  isChatStreaming?: boolean
  charName?: string
}

const BTN_SIZE = 44
const RING_RADIUS = 80

export default function ContextMenu({
  actions,
  visible,
  cx,
  cy,
  onAction,
  onClose,
  onSendChat,
  chatMessages = [],
  isChatStreaming = false,
  charName = 'AI',
}: Props) {
  const [chatText, setChatText] = useState('')

  const hasMessages = chatMessages.length > 0

  // 最近2条消息的索引（最后一条user + 最后一条assistant，或仅有的2条）
  const pinnedIndices = useMemo(() => {
    if (chatMessages.length === 0) return new Set<number>()
    const set = new Set<number>()
    // 始终保留最后2条
    const len = chatMessages.length
    if (len >= 1) set.add(len - 1)
    if (len >= 2) set.add(len - 2)
    return set
  }, [chatMessages])

  const handleSend = useCallback(() => {
    const text = chatText.trim()
    if (!text) return
    onSendChat?.(text)
    setChatText('')
  }, [chatText, onSendChat])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const count = actions.length

  // 动作按钮 variants：入场用 spring，出场用快速 duration
  const btnVariant = (i: number) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    const bx = cx + RING_RADIUS * Math.cos(angle) - BTN_SIZE / 2
    const by = cy + RING_RADIUS * Math.sin(angle) - BTN_SIZE / 2
    return {
      hidden: {
        x: cx - BTN_SIZE / 2,
        y: cy - BTN_SIZE / 2,
        scale: 0,
        opacity: 0,
      },
      visible: {
        x: bx,
        y: by,
        scale: 1,
        opacity: 1,
        transition: { type: 'spring' as const, stiffness: 400, damping: 22, delay: 0.05 + i * 0.04 },
      },
      exit: {
        x: cx - BTN_SIZE / 2,
        y: cy - BTN_SIZE / 2,
        scale: 0,
        opacity: 0,
        transition: { duration: 0.1 },
      },
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* 透明遮罩 — 快速淡出 */}
          <motion.div
            className="context-backdrop"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 100,
              pointerEvents: 'auto',
              WebkitAppRegion: 'no-drag',
            }}
          />

          {/* 动作按钮 — 聊天时消失 */}
          <AnimatePresence>
            {!hasMessages && count > 0 &&
              actions.map((action, i) => {
                const v = btnVariant(i)
                return (
                  <motion.button
                    key={action.id}
                    className="ctx-action-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAction(action)
                      onClose()
                    }}
                    variants={v}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    style={{
                      position: 'absolute',
                      width: BTN_SIZE,
                      height: BTN_SIZE,
                      zIndex: 200,
                      WebkitAppRegion: 'no-drag',
                    }}
                    title={action.label}
                  >
                    <span className="ctx-action-emoji">{action.emoji}</span>
                    <span className="ctx-action-label">{action.label}</span>
                  </motion.button>
                )
              })}
          </AnimatePresence>

          {/* 聊天消息气泡区 — 历史消息淡化 */}
          <AnimatePresence>
            {chatMessages.length > 0 && (
              <motion.div
                className="ctx-chat-bubbles"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
                key="bubbles"
                style={{
                  bottom: hasMessages ? 48 : 52,
                  maxHeight: hasMessages ? 100 : 120,
                }}
              >
                {chatMessages.map((msg, i) => {
                  const isPinned = pinnedIndices.has(i)
                  const age = chatMessages.length - 1 - i // 0 = newest
                  // 最近2条不淡化，更早的按年龄降低透明度直至消失
                  const opacity = isPinned ? 1 : Math.max(0, 1 - age * 0.3)
                  return (
                    <div
                      key={i}
                      className={`ctx-bubble ${msg.role}${!isPinned ? ' fading' : ''}`}
                      style={{ opacity }}
                    >
                      <div className="ctx-bubble-role">{msg.role === 'user' ? '你' : charName}</div>
                      <div className="ctx-bubble-text">
                        {msg.content || (msg.role === 'assistant' && isChatStreaming && i === chatMessages.length - 1
                          ? <span className="ctx-bubble-typing">...</span>
                          : msg.content
                        )}
                      </div>
                    </div>
                  )
                })}
                {/* 自动滚动锚点 */}
                <div ref={(el) => { if (el) el.scrollIntoView({ behavior: 'smooth' }) }} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* 聊天输入框 — 从下浮入 */}
          <motion.div
            className="ctx-chat-bar"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26, delay: 0.15 }}
          >
            <input
              className="ctx-chat-input"
              placeholder="输入消息…"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            <button className="ctx-chat-send" onClick={handleSend}>↵</button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

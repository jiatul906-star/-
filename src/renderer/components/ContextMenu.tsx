import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { PetAction } from '../../common/types'

interface Props {
  actions: PetAction[]
  visible: boolean
  cx: number
  cy: number
  onAction: (action: PetAction) => void
  onClose: () => void
  onSendChat?: (text: string) => void
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
}: Props) {
  const [chatText, setChatText] = useState('')

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

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* 透明遮罩 */}
          <motion.div
            className="context-backdrop"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 100,
              pointerEvents: 'auto',
              WebkitAppRegion: 'no-drag',
            }}
          />

          {/* 动作按钮 — 从中心弹簧弹出，完整圆形环绕 */}
          {count > 0 &&
            actions.map((action, i) => {
              const angle = (2 * Math.PI * i) / count - Math.PI / 2
              const bx = cx + RING_RADIUS * Math.cos(angle) - BTN_SIZE / 2
              const by = cy + RING_RADIUS * Math.sin(angle) - BTN_SIZE / 2

              return (
                <motion.button
                  key={action.id}
                  className="ctx-action-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAction(action)
                    onClose()
                  }}
                  initial={{
                    x: cx - BTN_SIZE / 2,
                    y: cy - BTN_SIZE / 2,
                    scale: 0,
                    opacity: 0,
                  }}
                  animate={{
                    x: bx,
                    y: by,
                    scale: 1,
                    opacity: 1,
                  }}
                  exit={{
                    x: cx - BTN_SIZE / 2,
                    y: cy - BTN_SIZE / 2,
                    scale: 0,
                    opacity: 0,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 22,
                    delay: 0.05 + i * 0.04,
                  }}
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

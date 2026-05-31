import { motion, AnimatePresence } from 'framer-motion'
import type { PetAction } from '../../common/types'

interface Props {
  actions: PetAction[]
  visible: boolean
  originX: number
  originY: number
  onAction: (action: PetAction) => void
  onClose: () => void
}

const BTN_SIZE = 48
const LABEL_HEIGHT = 18

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi)
}

function getButtonPos(
  index: number,
  total: number,
  cx: number,
  cy: number,
  radius: number,
) {
  // 从顶部开始顺时针
  const angle = (2 * Math.PI * index) / total - Math.PI / 2
  return {
    x: cx + radius * Math.cos(angle) - BTN_SIZE / 2,
    y: cy + radius * Math.sin(angle) - BTN_SIZE / 2 - LABEL_HEIGHT / 2,
  }
}

export default function RadialMenu({
  actions,
  visible,
  originX,
  originY,
  onAction,
  onClose,
}: Props) {
  const total = actions.length
  const radius = Math.max(80, total <= 4 ? 80 : 70 + total * 6)

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* 透明遮罩 — 点击关闭 */}
          <div
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              pointerEvents: 'auto',
              zIndex: 100,
            }}
          />

          {actions.map((action, i) => {
            const { x, y } = getButtonPos(i, total, originX, originY, radius)
            // clamp 在窗口边界内
            const cx = clamp(x, 4, 250 - BTN_SIZE - 4)
            const cy = clamp(y, 4, 350 - BTN_SIZE - LABEL_HEIGHT - 4)

            return (
              <motion.button
                key={action.id}
                onClick={(e) => {
                  e.stopPropagation()
                  onAction(action)
                }}
                initial={{
                  x: originX - BTN_SIZE / 2,
                  y: originY - BTN_SIZE / 2,
                  scale: 0,
                  opacity: 0,
                }}
                animate={{
                  x: cx,
                  y: cy,
                  scale: 1,
                  opacity: 1,
                }}
                exit={{
                  x: originX - BTN_SIZE / 2,
                  y: originY - BTN_SIZE / 2,
                  scale: 0,
                  opacity: 0,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 22,
                  delay: i * 0.04,
                }}
                style={{
                  position: 'fixed',
                  width: BTN_SIZE,
                  height: BTN_SIZE,
                  border: 'none',
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.92)',
                  boxShadow:
                    '0 4px 16px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 200,
                  pointerEvents: 'auto',
                  WebkitAppRegion: 'no-drag',
                }}
                title={action.label}
              >
                <span style={{ fontSize: 20, lineHeight: 1 }}>{action.emoji}</span>
                <span
                  style={{
                    position: 'absolute',
                    top: BTN_SIZE + 2,
                    fontSize: 10,
                    color: '#fff',
                    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}
                >
                  {action.label}
                </span>
              </motion.button>
            )
          })}
        </>
      )}
    </AnimatePresence>
  )
}

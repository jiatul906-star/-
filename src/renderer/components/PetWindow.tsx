import { useEffect, useRef, useCallback, useState } from 'react'
import { usePetStore } from '../stores/pet-store'
import RadialMenu from './RadialMenu'
import './pet.css'

const DRAG_THRESHOLD = 3 // 像素，超过此值视为拖拽

export default function PetWindow() {
  const characterRef = useRef<HTMLDivElement>(null)
  const {
    actions,
    menuVisible,
    menuOriginX,
    menuOriginY,
    currentVideo,
    videoVisible,
    feedbackEmoji,
    feedbackLabel,
    setActions,
    openMenu,
    closeMenu,
    triggerAction,
    clearVideo,
  } = usePetStore()

  // 拖拽状态
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({
    active: false,           // 正在拖拽中
    confirmed: false,        // 已超过阈值，确认拖拽
    startScreenX: 0,
    startScreenY: 0,
    lastScreenX: 0,
    lastScreenY: 0,
  })

  // 加载动作
  useEffect(() => {
    window.electronAPI.getPetActions().then(setActions)
  }, [setActions])

  // 右键 → 打开径向菜单
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const char = characterRef.current
      if (!char) return
      const rect = char.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2 + 20
      openMenu(cx, cy)
    },
    [openMenu],
  )

  // 鼠标按下 → 记录起始位置，准备拖拽
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 右键不处理拖拽
      if (e.button === 2) return

      e.preventDefault()
      const d = dragRef.current
      d.active = true
      d.confirmed = false
      d.startScreenX = e.screenX
      d.startScreenY = e.screenY
      d.lastScreenX = e.screenX
      d.lastScreenY = e.screenY
    },
    [],
  )

  // 鼠标移动 → 计算 delta，移动窗口
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d.active) return

      const dx = e.screenX - d.lastScreenX
      const dy = e.screenY - d.lastScreenY

      // 检查是否超过拖拽阈值
      if (!d.confirmed) {
        const totalDx = e.screenX - d.startScreenX
        const totalDy = e.screenY - d.startScreenY
        if (Math.abs(totalDx) < DRAG_THRESHOLD && Math.abs(totalDy) < DRAG_THRESHOLD) {
          return
        }
        d.confirmed = true
        setDragging(true)
      }

      // 移动窗口
      if (dx !== 0 || dy !== 0) {
        d.lastScreenX = e.screenX
        d.lastScreenY = e.screenY
        window.electronAPI.movePet(dx, dy)
      }
    }

    const onUp = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d.active) return

      d.active = false

      // 未超过阈值 = 点击，执行原点击逻辑
      if (!d.confirmed) {
        if (videoVisible) {
          clearVideo()
        }
      }

      d.confirmed = false
      setDragging(false)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [videoVisible, clearVideo])

  return (
    <div className="pet-window">
      {/* 角色 */}
      <div
        ref={characterRef}
        className={`pet-character${dragging ? ' dragging' : ''}`}
        onContextMenu={onContextMenu}
        onMouseDown={onMouseDown}
      >
        {/* 默认形象 */}
        {!videoVisible && (
          <div className="pet-body">
            <div className="pet-face">
              <div className="pet-eyes">
                <div className="pet-eye left" />
                <div className="pet-eye right" />
              </div>
              <div className="pet-mouth" />
            </div>
            {/* emoji 反馈 */}
            {feedbackEmoji && (
              <div className="pet-feedback">
                <span className="feedback-emoji">{feedbackEmoji}</span>
                <span className="feedback-label">{feedbackLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* 视频层 */}
        {videoVisible && currentVideo && (
          <video
            className="pet-video"
            src={currentVideo}
            autoPlay
            onEnded={clearVideo}
            onError={() => {
              clearVideo()
              usePetStore.setState({
                feedbackEmoji: '❌',
                feedbackLabel: '视频加载失败',
              })
              setTimeout(
                () => usePetStore.setState({ feedbackEmoji: null, feedbackLabel: null }),
                2000,
              )
            }}
          />
        )}
      </div>

      {/* 径向菜单 */}
      <RadialMenu
        actions={actions}
        visible={menuVisible}
        originX={menuOriginX}
        originY={menuOriginY}
        onAction={triggerAction}
        onClose={closeMenu}
      />

      {/* 右键提示 */}
      {!menuVisible && actions.length === 0 && (
        <div className="hint-text">右键角色 — 动作菜单</div>
      )}
    </div>
  )
}

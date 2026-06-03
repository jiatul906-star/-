import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { usePetStore } from '../stores/pet-store'
import RadialMenu from './RadialMenu'
import './pet.css'

const DRAG_THRESHOLD = 3

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
    characters,
    activeCharacterId,
    setActions,
    setCharactersData,
    setActiveCharacterId,
    setCharacterImage,
    openMenu,
    closeMenu,
    triggerAction,
    clearVideo,
  } = usePetStore()

  // 当前角色
  const activeChar = useMemo(
    () => characters.find((c) => c.id === activeCharacterId) ?? characters[0] ?? null,
    [characters, activeCharacterId],
  )

  // 拖拽状态
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({
    active: false,
    confirmed: false,
    startScreenX: 0,
    startScreenY: 0,
    lastScreenX: 0,
    lastScreenY: 0,
  })

  // 初始化：加载动作 + 角色列表 + active 角色形象
  useEffect(() => {
    window.electronAPI.getPetActions().then(setActions)
    window.electronAPI.getCharacters().then((data) => {
      setCharactersData(data)
    })

    const unsubChars = window.electronAPI.onCharactersUpdated((data) => {
      setCharactersData(data)
    })

    const unsubImage = window.electronAPI.onPetImageUpdated(({ charId, dataUrl }) => {
      setCharacterImage(charId, dataUrl)
    })

    return () => {
      unsubChars()
      unsubImage()
    }
  }, [setActions, setCharactersData, setCharacterImage])

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

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
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

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d.active) return
      const dx = e.screenX - d.lastScreenX
      const dy = e.screenY - d.lastScreenY
      if (!d.confirmed) {
        const totalDx = e.screenX - d.startScreenX
        const totalDy = e.screenY - d.startScreenY
        if (Math.abs(totalDx) < DRAG_THRESHOLD && Math.abs(totalDy) < DRAG_THRESHOLD) return
        d.confirmed = true
        setDragging(true)
      }
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
      if (!d.confirmed && videoVisible) clearVideo()
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

  const showCustomImage = !!activeChar?.imageDataUrl

  return (
    <div className="pet-window">
      <div
        ref={characterRef}
        className={`pet-character${dragging ? ' dragging' : ''}`}
        onContextMenu={onContextMenu}
        onMouseDown={onMouseDown}
      >
        {/* 自定义形象图片 */}
        {showCustomImage && !videoVisible && (
          <img className="pet-image" src={activeChar!.imageDataUrl!} alt={activeChar!.name} />
        )}

        {/* 默认 CSS 形象 */}
        {!showCustomImage && !videoVisible && activeChar && (
          <div className="pet-body" style={{ background: activeChar.gradient }}>
            <div className="pet-face">
              <div className="pet-eyes">
                <div className="pet-eye left" />
                <div className="pet-eye right" />
              </div>
              <div className="pet-mouth" />
            </div>
          </div>
        )}

        {/* emoji 反馈 */}
        {!videoVisible && feedbackEmoji && (
          <div className="pet-feedback">
            <span className="feedback-emoji">{feedbackEmoji}</span>
            <span className="feedback-label">{feedbackLabel}</span>
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
              setTimeout(() => usePetStore.setState({ feedbackEmoji: null, feedbackLabel: null }), 2000)
            }}
          />
        )}
      </div>

      <RadialMenu
        actions={actions}
        visible={menuVisible}
        originX={menuOriginX}
        originY={menuOriginY}
        onAction={triggerAction}
        onClose={closeMenu}
      />

      {!menuVisible && actions.length === 0 && (
        <div className="hint-text">右键角色 — 动作菜单</div>
      )}
    </div>
  )
}

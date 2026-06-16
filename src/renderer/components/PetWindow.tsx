import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { usePetStore } from '../stores/pet-store'
import ContextMenu from './ContextMenu'
import './pet.css'
import './context-menu.css'

const DRAG_THRESHOLD = 4

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
    closeMenu: closeMenuStore,
    triggerAction,
    clearVideo,
  } = usePetStore()

  const activeChar = useMemo(
    () => characters.find((c) => c.id === activeCharacterId) ?? characters[0] ?? null,
    [characters, activeCharacterId],
  )

  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({
    active: false,
    confirmed: false,
    lastScreenX: 0,
    lastScreenY: 0,
  })

  // ---- 背景 + pointer-events ----
  useEffect(() => {
    document.documentElement.style.background = 'red'
    document.body.style.background = 'red'
    document.documentElement.style.pointerEvents = 'auto'
    document.body.style.pointerEvents = 'auto'
    const root = document.getElementById('root')
    if (root) root.style.pointerEvents = 'auto'
    return () => {
      document.documentElement.style.background = ''
      document.body.style.background = ''
    }
  }, [])

  // ---- 初始化 ----
  useEffect(() => {
    window.electronAPI.getPetActions().then(setActions)
    window.electronAPI.getCharacters().then((data) => setCharactersData(data))
    const unsubChars = window.electronAPI.onCharactersUpdated((data) => setCharactersData(data))
    const unsubImage = window.electronAPI.onPetImageUpdated(({ charId, dataUrl }) =>
      setCharacterImage(charId, dataUrl),
    )
    return () => { unsubChars(); unsubImage() }
  }, [setActions, setCharactersData, setCharacterImage])

  // ---- 窗口失去焦点：主进程已缩窗，只需关闭菜单状态 ----
  useEffect(() => {
    const unsub = window.electronAPI.onPetMenuClose(() => {
      closeMenuStore()
    })
    return unsub
  }, [closeMenuStore])

  // ---- 右键：先扩窗，再开菜单 ----
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const char = characterRef.current
      if (!char) return
      const charRect = char.getBoundingClientRect()
      const scrCX = charRect.left + charRect.width / 2
      const scrCY = charRect.top + charRect.height / 2
      // 先扩窗（传角色屏幕坐标以保持位置），再打开菜单
      // expanded: char centered (320/2=160), top=45, height/2=90 → center=(160,135)
      window.electronAPI.resizePet(true, scrCX, scrCY).then(() => {
        openMenu(160, 135)
      })
    },
    [openMenu],
  )

  // ---- 关闭菜单：关菜单，再缩窗 ----
  const closeMenu = useCallback(() => {
    closeMenuStore()
    const char = characterRef.current
    if (!char) return
    const charRect = char.getBoundingClientRect()
    const scrCX = charRect.left + charRect.width / 2
    const scrCY = charRect.top + charRect.height / 2
    window.electronAPI.resizePet(false, scrCX, scrCY)
  }, [closeMenuStore])

  // ---- JS 拖拽 ----
  const startDrag = useCallback(
    (screenX: number, screenY: number) => {
      if (menuVisible) return
      const d = dragRef.current
      d.active = true
      d.confirmed = false
      d.lastScreenX = screenX
      d.lastScreenY = screenY
    },
    [menuVisible],
  )

  const onMouseDownChar = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 2) return
      e.preventDefault()
      e.stopPropagation()
      startDrag(e.screenX, e.screenY)
    },
    [startDrag],
  )

  const onMouseDownDead = useCallback(
    (e: React.MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('.context-backdrop, .ctx-action-btn, .ctx-chat-bar, .ctx-canvas')) return
      startDrag(e.screenX, e.screenY)
    },
    [startDrag],
  )

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d.active) return
      const dx = e.screenX - d.lastScreenX
      const dy = e.screenY - d.lastScreenY
      if (!d.confirmed) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
        d.confirmed = true
        setDragging(true)
      }
      if (dx !== 0 || dy !== 0) {
        d.lastScreenX = e.screenX
        d.lastScreenY = e.screenY
        window.electronAPI.movePet(dx, dy)
      }
    }
    const onUp = () => {
      if (!dragRef.current.active) return
      dragRef.current.active = false
      dragRef.current.confirmed = false
      setDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const onClick = useCallback(() => {
    if (videoVisible) clearVideo()
  }, [videoVisible, clearVideo])

  const handleSendChat = useCallback(
    (_text: string) => {
      closeMenu()
      window.electronAPI.openChat()
    },
    [closeMenu],
  )

  const showCustomImage = !!activeChar?.imageDataUrl

  return (
    <div className={`pet-window${menuVisible ? ' menu-open' : ''}`} onMouseDown={onMouseDownDead}>
      <div
        ref={characterRef}
        className={`pet-character${dragging ? ' dragging' : ''}`}
        onContextMenu={onContextMenu}
        onMouseDown={onMouseDownChar}
        onClick={onClick}
      >
        {showCustomImage && !videoVisible && (
          <img className="pet-image" src={activeChar!.imageDataUrl!} alt={activeChar!.name} />
        )}
        {!showCustomImage && !videoVisible && activeChar && (
          <div className="pet-body" style={{ background: activeChar.gradient }}>
            <div className="pet-face">
              <div className="pet-eyes"><div className="pet-eye left" /><div className="pet-eye right" /></div>
              <div className="pet-mouth" />
            </div>
          </div>
        )}
        {!videoVisible && feedbackEmoji && (
          <div className="pet-feedback">
            <span className="feedback-emoji">{feedbackEmoji}</span>
            <span className="feedback-label">{feedbackLabel}</span>
          </div>
        )}
        {videoVisible && currentVideo && (
          <video className="pet-video" src={currentVideo} autoPlay
            onEnded={clearVideo}
            onError={() => {
              clearVideo()
              usePetStore.setState({ feedbackEmoji: '❌', feedbackLabel: '视频加载失败' })
              setTimeout(() => usePetStore.setState({ feedbackEmoji: null, feedbackLabel: null }), 2000)
            }}
          />
        )}
      </div>

      <ContextMenu
        actions={actions}
        visible={menuVisible}
        cx={menuOriginX}
        cy={menuOriginY}
        onAction={triggerAction}
        onClose={closeMenu}
        onSendChat={handleSendChat}
      />

      {!menuVisible && actions.length === 0 && (
        <div className="hint-text">右键角色 — 动作菜单</div>
      )}
    </div>
  )
}

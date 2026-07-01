import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { usePetStore } from '../stores/pet-store'
import ContextMenu from './ContextMenu'
import ChromaKeyVideo from './ChromaKeyVideo'
import { streamChat, buildSystemPrompt } from '../plugins/chat/api'
import type { ApiProfile, MemoryEntry } from '../../common/types'
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
    currentActionMeta,
  } = usePetStore()

  const activeChar = useMemo(
    () => characters.find((c) => c.id === activeCharacterId) ?? characters[0] ?? null,
    [characters, activeCharacterId],
  )

  // ===== 右键聊天状态 =====
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [isChatStreaming, setIsChatStreaming] = useState(false)
  const [apiProfiles, setApiProfiles] = useState<ApiProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string>('')
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const chatAbortRef = useRef<AbortController | null>(null)

  const activeProfile = useMemo(
    () => apiProfiles.find((p) => p.id === activeProfileId) ?? apiProfiles[0] ?? null,
    [apiProfiles, activeProfileId],
  )

 const [dragging, setDragging] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const dragRef = useRef({
    active: false,
    confirmed: false,
    lastScreenX: 0,
    lastScreenY: 0,
  })

  // ---- 背景 + pointer-events ----
  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
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
    const unsubActions = window.electronAPI.onPetActionsUpdated((updated) => setActions(updated))
   const unsubImage = window.electronAPI.onPetImageUpdated(({ charId, dataUrl }) =>
     setCharacterImage(charId, dataUrl),
   )
    return () => { unsubChars(); unsubActions(); unsubImage() }
  }, [setActions, setCharactersData, setCharacterImage])

  // ---- 网络状态监听 ----
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // ---- 加载 API Profiles + 记忆 ----
  useEffect(() => {
    window.electronAPI.getApiProfiles().then((data) => {
      setApiProfiles(data.profiles)
      setActiveProfileId(data.activeProfileId)
    })
    const unsub = window.electronAPI.onApiProfilesUpdated((data) => {
      setApiProfiles(data.profiles)
      setActiveProfileId(data.activeProfileId)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (activeChar) {
      window.electronAPI.getAgentMemory(activeChar.id).then(setMemories)
    }
  }, [activeChar?.id])

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
   async (text: string) => {
      setChatMessages((prev) => [...prev, { role: 'user' as const, content: text }])

      if (!activeChar) return
      const now = Date.now()
      // 保存到聊天历史
      window.electronAPI.addChatMessage(activeChar.id, {
        id: 'popup_' + now,
        role: 'user',
        content: text,
        timestamp: now,
        characterId: activeChar.id,
      }).catch(() => {})

      // 检查 API 配置
      const profile = activeChar.apiProfileId
        ? apiProfiles.find((p) => p.id === activeChar.apiProfileId) || activeProfile
        : activeProfile
      if (!profile || !profile.apiKey || !profile.baseUrl) {
        setChatMessages((prev) => [...prev, { role: 'assistant' as const, content: '请先在设置的 API 页面配置 API Key 和地址。' }])
        return
      }

      setIsChatStreaming(true)
      const controller = new AbortController()
      chatAbortRef.current = controller

      try {
        const systemPrompt = buildSystemPrompt(activeChar, memories)

        let fullContent = ''
        setChatMessages((prev) => [...prev, { role: 'assistant' as const, content: '' }])

        for await (const token of streamChat(
          [{ id: '', role: 'user', content: text, timestamp: Date.now(), characterId: activeChar.id }],
          profile,
          systemPrompt,
          controller.signal,
        )) {
          fullContent += token
          setChatMessages((prev) => {
            const copy = [...prev]
            const last = copy[copy.length - 1]
            if (last && last.role === 'assistant') {
              copy[copy.length - 1] = { ...last, content: fullContent }
            }
            return copy
          })
        }
        } catch (err: any) {
          // 保存 AI 回复到聊天历史
          if (activeChar && fullContent) {
            window.electronAPI.addChatMessage(activeChar.id, {
              id: 'popup_ai_' + now,
              role: 'assistant',
              content: fullContent,
              timestamp: Date.now(),
              characterId: activeChar.id,
            }).catch(() => {})
          }
          if (err.name === 'AbortError') return
        setChatMessages((prev) => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last && last.role === 'assistant') {
            copy[copy.length - 1] = { ...last, content: last.content || '请求失败: ' + (err.message || '网络错误') }
          }
          return copy
        })
      } finally {
        setIsChatStreaming(false)
        chatAbortRef.current = null
      }
    },
    [activeChar, activeProfile, apiProfiles, memories],
  )

  // 关闭菜单时停止流式输出 + 清空聊天状态
  const handleCloseMenu = useCallback(() => {
    chatAbortRef.current?.abort()
    setChatMessages([])
    setIsChatStreaming(false)
    closeMenu()
  }, [closeMenu])

  const clearChat = useCallback(() => {
    chatAbortRef.current?.abort()
    setChatMessages([])
    setIsChatStreaming(false)
  }, [])

  const showCustomImage = !!activeChar?.imageDataUrl

  return (
    <div className={`pet-window${menuVisible ? ' menu-open' : ''}`} onMouseDown={onMouseDownDead}>
      <div
        ref={characterRef}
        className={`pet-character${dragging ? ' dragging' : ''}`}
        data-offline={!isOnline ? 'true' : undefined}
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
              <div className={`pet-mouth${!isOnline ? ' sad' : ''}`} />
              {!isOnline && <div className="pet-tear left" />}
              {!isOnline && <div className="pet-tear right" />}
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
          (currentActionMeta?.cropX != null || currentActionMeta?.cropY != null || currentActionMeta?.cropW != null || currentActionMeta?.cropH != null || currentActionMeta?.chromaKey) ? (
            <ChromaKeyVideo
              videoPath={currentVideo?.replace(/^file:\/\/\//, '') || ''}
              chromaKey={currentActionMeta?.chromaKey}
              tolerance={currentActionMeta?.chromaKeyTolerance}
              cropX={currentActionMeta?.cropX}
              cropY={currentActionMeta?.cropY}
              cropW={currentActionMeta?.cropW}
              cropH={currentActionMeta?.cropH}
              onEnded={clearVideo}
              onError={() => {
                clearVideo()
                usePetStore.setState({ feedbackEmoji: '❌', feedbackLabel: '视频加载失败' })
                setTimeout(() => usePetStore.setState({ feedbackEmoji: null, feedbackLabel: null }), 2000)
              }}
              className="pet-video"
            />
          ) : (
            <video className="pet-video" src={currentVideo} autoPlay
              onEnded={clearVideo}
              onError={() => {
                clearVideo()
                usePetStore.setState({ feedbackEmoji: '❌', feedbackLabel: '视频加载失败' })
                setTimeout(() => usePetStore.setState({ feedbackEmoji: null, feedbackLabel: null }), 2000)
              }}
            />
          )
        )}
      </div>

      <ContextMenu
        actions={actions}
        visible={menuVisible}
        cx={menuOriginX}
        cy={menuOriginY}
        onAction={triggerAction}
        onClose={handleCloseMenu}
        onBackToActions={clearChat}
        onSendChat={handleSendChat}
        chatMessages={chatMessages}
        isChatStreaming={isChatStreaming}
        charName={activeChar?.name ?? 'AI'}
      />

      {!menuVisible && actions.length === 0 && (
        <div className="hint-text">右键角色 — 动作菜单</div>
      )}
    </div>
  )
}

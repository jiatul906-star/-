import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { usePetStore } from '../stores/pet-store'
import ContextMenu from './ContextMenu'
import ChromaKeyVideo from './ChromaKeyVideo'
import { streamChat, buildSystemPrompt } from '../plugins/chat/api'
import type { ApiProfile, MemoryEntry } from '../../common/types'
import './pet.css'
import './context-menu.css'

const DRAG_THRESHOLD = 4

// 空闲视频间隔（毫秒）
const IDLE_MIN_INTERVAL = 5000   // 最短 5 秒
const IDLE_MAX_INTERVAL = 10000  // 最长 10 秒
const IDLE_FIRST_DELAY = 3000    // 首次播放延迟 3 秒

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
    characterPortraits,
    idleVideos,
    isIdlePlaying,
    ttsPlaying,
    ttsPlayingCharId,
    setActions,
    setCharactersData,
    setActiveCharacterId,
    setCharacterPortrait,
    loadCharacterImages,
    openMenu,
    closeMenu: closeMenuStore,
    triggerAction,
    clearVideo,
    currentActionMeta,
    setIdleVideos,
    setIdlePlaying,
  } = usePetStore()

  // TTS 嘴型同步：当前角色正在说话时显示 talking 状态
  const isTalking = ttsPlaying && ttsPlayingCharId === activeCharacterId

  const activeChar = useMemo(
    () => characters.find((c) => c.id === activeCharacterId) ?? characters[0] ?? null,
    [characters, activeCharacterId],
  )

  // 空闲视频是否启用 chroma key 去底（角色级配置）
  const idleChromaKey = activeChar?.idleVideoChromaKey
  const idleChromaKeyTolerance = activeChar?.idleVideoChromaKeyTolerance ?? 100
  const idleUseChromaKey = !!idleChromaKey
  // 空闲视频裁切（角色级配置）
  const idleHasCrop = activeChar?.idleVideoCropX != null || activeChar?.idleVideoCropY != null || activeChar?.idleVideoCropW != null || activeChar?.idleVideoCropH != null

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

 // ===== 空闲定时器 refs =====
 const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoEndedCleanlyRef = useRef(false)
 const idleGuardRef = useRef({
    videoVisible: false,
    menuVisible: false,
    dragging: false,
    isChatStreaming: false,
  })
  // 保持 guard ref 同步
  idleGuardRef.current.videoVisible = videoVisible
  idleGuardRef.current.menuVisible = menuVisible
  idleGuardRef.current.dragging = dragging
  idleGuardRef.current.isChatStreaming = isChatStreaming

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
   window.electronAPI.getCharacters().then((data) => {
     setCharactersData(data)
     for (const c of data.characters) {
       loadCharacterImages(c.id, c.name)
     }
     // 首次加载完成后，按活跃角色加载其动作
     const active = data.characters.find(c => c.id === data.activeId) ?? data.characters[0]
     if (active) {
       window.electronAPI.getPetActions(active.name).then(setActions)
     }
   })
   const unsubChars = window.electronAPI.onCharactersUpdated((data) => {
     setCharactersData(data)
     for (const c of data.characters) {
       loadCharacterImages(c.id, c.name)
     }
   })
    const unsubActions = window.electronAPI.onPetActionsUpdated((payload) => {

      // 仅更新当前活跃角色的动作

      const store = usePetStore.getState()

      const active = store.characters.find(c => c.id === store.activeCharacterId)

      if (active && payload.charName === active.name) {

        setActions(payload.actions)

      }

    })
   const unsubImage = window.electronAPI.onPetImageUpdated(({ charId, imageType, dataUrl }) => {
     if (imageType === 'portrait') {
       setCharacterPortrait(charId, dataUrl)
     } else if (imageType === 'avatar') {
       usePetStore.getState().setCharacterAvatar(charId, dataUrl)
     }
   })
    return () => { unsubChars(); unsubActions(); unsubImage() }
  }, [setActions, setCharactersData, setCharacterPortrait, loadCharacterImages])

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

  // 当前空闲视频是否为 Alpha WebM（需要 WebGL 管线播放）
  const [currentIdleIsAlpha, setCurrentIdleIsAlpha] = useState(false)

  // ---- 角色切换时加载空闲视频列表 ----
  useEffect(() => {
    if (activeChar) {
      window.electronAPI.listIdleVideos(activeChar.name).then((videos) => {
        setIdleVideos(videos)
      })
    } else {
      setIdleVideos([])
    }
  }, [activeChar?.name, setIdleVideos])

  // ---- 判断视频文件是否为 Alpha WebM ----
  const isAlphaVideoFile = useCallback((fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    return ext === 'webm'
  }, [])

  // ---- 空闲视频自动播放 ----
  const scheduleIdleVideo = useCallback(() => {
    // 清除旧定时器
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }

    const delay = IDLE_MIN_INTERVAL + Math.random() * (IDLE_MAX_INTERVAL - IDLE_MIN_INTERVAL)

    idleTimerRef.current = setTimeout(async () => {
      const g = idleGuardRef.current
      const store = usePetStore.getState()

      // 防护检查
      if (g.videoVisible || g.menuVisible || g.dragging || g.isChatStreaming) {
        scheduleIdleVideo() // 推迟到下一轮
        return
      }

      const videos = store.idleVideos
      if (!videos || videos.length === 0) {
        scheduleIdleVideo()
        return
      }

      const char = store.characters.find(c => c.id === store.activeCharacterId)
      if (!char) {
        scheduleIdleVideo()
        return
      }

      // 随机选一个视频
      const idx = Math.floor(Math.random() * videos.length)
      const fileName = videos[idx]
      const fullPath = await window.electronAPI.getVideoPath(char.name, fileName)

      if (fullPath) {
        const isWebM = fileName.toLowerCase().endsWith('.webm')
        setCurrentIdleIsAlpha(isWebM)
        usePetStore.setState({
          currentVideo: `file:///${fullPath.replace(/\\/g, '/')}`,
          videoVisible: true,
          isIdlePlaying: true,
          currentActionMeta: null,
        })
      } else {
        scheduleIdleVideo()
      }
    }, delay)
  }, [])

  // 首次启动 + idleVideos 变化时开始调度
  useEffect(() => {
    // 先首次延迟启动
    const firstTimer = setTimeout(() => {
      scheduleIdleVideo()
    }, IDLE_FIRST_DELAY)

    return () => {
      clearTimeout(firstTimer)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [idleVideos, scheduleIdleVideo])

 // ---- 视频播放完毕后恢复空闲调度 ----
 const handleVideoEnded = useCallback(() => {
    videoEndedCleanlyRef.current = true
   clearVideo()
   usePetStore.setState({ isIdlePlaying: false })
   // 调度下一轮
   scheduleIdleVideo()
 }, [clearVideo, scheduleIdleVideo])

 const handleVideoError = useCallback(() => {
    // 如果视频刚刚正常播完，可能触发了清理过程中的假性 error 事件
    if (videoEndedCleanlyRef.current) {
      videoEndedCleanlyRef.current = false
      return
    }
   clearVideo()
   usePetStore.setState({ isIdlePlaying: false, feedbackEmoji: '❌', feedbackLabel: '视频加载失败' })
   setTimeout(() => usePetStore.setState({ feedbackEmoji: null, feedbackLabel: null }), 2000)
   scheduleIdleVideo()
 }, [clearVideo, scheduleIdleVideo])

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
    if (videoVisible) {
      // 空闲视频：点击停止并跳过；动作视频同理
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      clearVideo()
      usePetStore.setState({ isIdlePlaying: false })
      // 重新调度
      scheduleIdleVideo()
    }
  }, [videoVisible, clearVideo, scheduleIdleVideo])

  const handleSendChat = useCallback(
   async (text: string) => {
      setChatMessages((prev) => [...prev, { role: 'user' as const, content: text }])

      if (!activeChar) return
      const now = Date.now()
      window.electronAPI.addChatMessage(activeChar.id, {
        id: 'popup_' + now,
        role: 'user',
        content: text,
        timestamp: now,
        characterId: activeChar.id,
      }).catch(() => {})

      const profile = activeChar.apiProfileId
        ? apiProfiles.find((p) => p.id === activeChar.apiProfileId) || activeProfile
        : activeProfile
      if (!profile || !profile.apiKey || !profile.baseUrl) {
        setChatMessages((prev) => [...prev, { role: 'assistant' as const, content: '请先在设置的 API 页面配置 API Key 和地址。' }])
        return
      }

      // 如果 model 为空，提示并修复
      if (!profile.model) {
        setChatMessages((prev) => [...prev, { role: 'assistant' as const, content: 'API 配置中未设置模型名称 (model)，请在设置中完善。' }])
        setIsChatStreaming(true)
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

        // 流式完成后保存 AI 回复 → IPC 广播 → ChatWindow 同步
        if (activeChar && fullContent) {
          window.electronAPI.addChatMessage(activeChar.id, {
            id: 'popup_ai_' + now,
            role: 'assistant',
            content: fullContent,
            timestamp: Date.now(),
            characterId: activeChar.id,
          }).catch(() => {})
        }
        } catch (err: any) {
          // 异常时也尝试保存已收到的部分内容
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

  const showCustomImage = !!(activeChar && characterPortraits[activeChar.id])

  return (
    <div className={`pet-window${menuVisible ? ' menu-open' : ''}`} onMouseDown={onMouseDownDead}>
      <div
        ref={characterRef}
        className={`pet-character${dragging ? ' dragging' : ''}${isTalking ? ' is-talking' : ''}`}
        onContextMenu={onContextMenu}
        onMouseDown={onMouseDownChar}
        onClick={onClick}
      >
        {showCustomImage && !videoVisible && (
          <img className="pet-image" src={characterPortraits[activeChar!.id]!} alt={activeChar!.name} />
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
          (currentActionMeta?.cropX != null || currentActionMeta?.cropY != null || currentActionMeta?.cropW != null || currentActionMeta?.cropH != null || currentActionMeta?.chromaKey || isIdlePlaying && (currentIdleIsAlpha || idleUseChromaKey || idleHasCrop)) ? (
            <ChromaKeyVideo
              videoPath={currentVideo?.replace(/^file:\/\/\//, '') || ''}
              chromaKey={(isIdlePlaying ? currentActionMeta?.chromaKey || idleChromaKey : currentActionMeta?.chromaKey) ?? undefined}
              tolerance={isIdlePlaying ? (currentActionMeta?.chromaKeyTolerance ?? idleChromaKeyTolerance) : (currentActionMeta?.chromaKeyTolerance ?? 100)}
              cropX={isIdlePlaying ? (currentActionMeta?.cropX ?? activeChar?.idleVideoCropX) : currentActionMeta?.cropX}
              cropY={isIdlePlaying ? (currentActionMeta?.cropY ?? activeChar?.idleVideoCropY) : currentActionMeta?.cropY}
              cropW={isIdlePlaying ? (currentActionMeta?.cropW ?? activeChar?.idleVideoCropW) : currentActionMeta?.cropW}
              cropH={isIdlePlaying ? (currentActionMeta?.cropH ?? activeChar?.idleVideoCropH) : currentActionMeta?.cropH}
              useAlpha={isIdlePlaying && currentIdleIsAlpha}
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              className="pet-video"
              style={!isIdlePlaying ? { transform: 'rotate(180deg)' } : undefined}
            />
          ) : (
            <video className="pet-video" src={currentVideo} autoPlay
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              style={!isIdlePlaying ? { transform: 'rotate(180deg)' } : undefined}
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

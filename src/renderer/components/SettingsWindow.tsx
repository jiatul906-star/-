import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import type { PetAction, CharacterConfig, ApiProfile, ApiProfilesData, MemoryEntry, TtsSettings, GpuInfo, ModelDownloadProgress, PipInstallProgress } from '../../common/types'
import { DEFAULT_PET_ACTIONS } from '../../common/types'
import { usePetStore } from '../stores/pet-store'
import { buildSystemPrompt } from '../plugins/chat/api'
import ActionEditor from './ActionEditor'
import ImageCropper from './ImageCropper'
import BackgroundRemover from './BackgroundRemover'
import './settings.css'

type NavKey = 'appearance' | 'actions' | 'about' | 'api'

function genId(): string {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9)
}

// 新建角色的随机渐变色板
const GRADIENT_PALETTE = [
  'linear-gradient(175deg, #FDD9C4 0%, #F2B8A0 40%, #E8A38B 100%)', // 桃粉
  'linear-gradient(175deg, #C8DCF5 0%, #B0C8E8 40%, #A8C8E8 100%)', // 天蓝
  'linear-gradient(175deg, #D4E8D0 0%, #B8D8B4 40%, #A0C898 100%)', // 薄荷绿
  'linear-gradient(175deg, #F8E0D0 0%, #F0CCB8 40%, #E8B898 100%)', // 奶茶
  'linear-gradient(175deg, #E8D8F0 0%, #D0C0E0 40%, #C0A8D8 100%)', // 薰衣草
  'linear-gradient(175deg, #F8F0C8 0%, #F0E8B0 40%, #E8D898 100%)', // 奶油黄
  'linear-gradient(175deg, #F8D0D8 0%, #F0B8C4 40%, #E8A0B0 100%)', // 樱花粉
]

function generateId(): string {
  return 'char_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)
}

function randomName(): string {
  const names = ['小桃', '小蓝', '小绿', '小茶', '小紫', '小黄', '小樱', '小白', '小灰', '未命名']
  return names[Math.floor(Math.random() * names.length)]
}

// ===== TTS 子组件 =====

/** GPU 状态指示器 */
function TtsGpuStatus() {
  const [gpu, setGpu] = useState<GpuInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.electronAPI.getGpuInfo().then((info) => {
      setGpu(info)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="tts-status-banner tts-status-checking">⏳ 正在检测 GPU ...</div>
  }

  if (!gpu) {
    return <div className="tts-status-banner tts-status-error">⚠️ 无法检测 GPU 状态</div>
  }

  if (!gpu.available) {
    return (
      <div className="tts-status-banner tts-status-unavailable">
        ❌ 未检测到 NVIDIA 显卡，语音功能不可用
        <div className="hint">语音合成需要 NVIDIA 显卡（≥6GB 显存）。没有独立显卡时，聊天功能不受影响。</div>
      </div>
    )
  }

  const levelLabel: Record<string, string> = {
    full: `✅ ${gpu.model}（${(gpu.vramMB / 1024).toFixed(1)}GB）— 完全支持`,
    limited: `⚠️ ${gpu.model}（${(gpu.vramMB / 1024).toFixed(1)}GB）— 性能有限，合成可能较慢`,
    unavailable: `❌ ${gpu.model}（${(gpu.vramMB / 1024).toFixed(1)}GB）— 显存不足`,
  }

  const levelClass: Record<string, string> = {
    full: 'tts-status-ok',
    limited: 'tts-status-limited',
    unavailable: 'tts-status-unavailable',
  }

  return (
    <div className={`tts-status-banner ${levelClass[gpu.ttsLevel] || ''}`}>
      {levelLabel[gpu.ttsLevel] || levelLabel.unavailable}
    </div>
  )
}

/** Python 环境检测 + pip install */
function TtsPythonEnv() {
  const [envStatus, setEnvStatus] = useState<string>('not_checked')
  const [envInfo, setEnvInfo] = useState<{ pythonVersion: string; pipVersion: string; error?: string }>({ pythonVersion: '', pipVersion: '' })
  const [pipProgress, setPipProgress] = useState<PipInstallProgress | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    window.electronAPI.checkPythonEnv().then((result) => {
      setEnvStatus(result.status)
      setEnvInfo({ pythonVersion: result.pythonVersion, pipVersion: result.pipVersion, error: result.error })
    }).catch(() => setEnvStatus('error'))
  }, [])

  // 注册 pip 安装进度监听
  useEffect(() => {
    const unsub = window.electronAPI.onPipInstallProgress((p) => {
      setPipProgress(p)
      if (p.stage === 'done' || p.stage === 'error') {
        setInstalling(false)
        // 重新检测环境
        window.electronAPI.checkPythonEnv().then((result) => {
          setEnvStatus(result.status)
        })
      }
    })
    return unsub
  }, [])

  const handleInstall = async () => {
    setInstalling(true)
    await window.electronAPI.installDeps()
  }

  // 准备中 / 安装中
  if (installing && pipProgress) {
    const stageLabel: Record<string, string> = {
      preparing: '准备安装...',
      installing: '安装基础依赖...',
      installing_indextts: '安装 index-tts...',
      downloading_indextts: '下载 index-tts 源码...',
      done: '完成！',
      error: '安装失败',
    }
    return (
      <div className="tts-status-banner tts-status-checking">
        <div className="tts-download-label">
          📦 {stageLabel[pipProgress.stage] || pipProgress.stage} {pipProgress.percent}%
        </div>
        {(pipProgress.stage !== 'error' && pipProgress.stage !== 'done') && (
          <div className="tts-download-bar-track" style={{ marginTop: 4 }}>
            <div
              className="tts-download-bar-fill"
              style={{ width: `${Math.min(100, pipProgress.percent)}%` }}
            />
          </div>
        )}
        <div className="hint" style={{ fontSize: 11, fontFamily: 'monospace', maxHeight: 36, overflow: 'hidden' }}>
          {pipProgress.output || (pipProgress.currentPackage ? `正在安装 ${pipProgress.currentPackage}...` : '')}
        </div>
      </div>
    )
  }

  // 错误
  if (pipProgress?.stage === 'error' && !installing) {
    return (
      <div className="tts-status-banner tts-status-error">
        ❌ 安装失败: {pipProgress.error || '未知错误'}
        <button className="small-btn" onClick={handleInstall} style={{ marginLeft: 8 }}>重试</button>
      </div>
    )
  }

  // Python 缺失
  if (envStatus === 'python_missing') {
    return (
      <div className="tts-status-banner tts-status-unavailable">
        ⚠️ Python 环境未检测到
        <div className="hint">{envInfo.error || '嵌入式 Python 未安装。打包安装包后会自动包含。'}</div>
      </div>
    )
  }

  // 依赖未安装
  if (envStatus === 'deps_missing') {
    return (
      <div className="tts-status-banner tts-status-limited">
        📦 Python 依赖未安装（{envInfo.pythonVersion || '未知版本'}）
        <div className="hint">首次使用语音功能需要安装 Python 依赖包（torch, index-tts 等，约 3GB）。国内用户自动使用清华镜像源。</div>
        <button
          className="small-btn"
          onClick={handleInstall}
          disabled={installing}
          style={{ marginTop: 8 }}
        >
          {installing ? '安装中...' : '安装依赖'}
        </button>
      </div>
    )
  }

  // 就绪
  if (envStatus === 'ready') {
    return (
      <div className="tts-status-banner tts-status-ok">
        ✅ Python 环境就绪（{envInfo.pythonVersion} · pip {envInfo.pipVersion}）
      </div>
    )
  }

  // 未检测
  return (
    <div className="tts-status-banner tts-status-checking">
      ⏳ 正在检测 Python 环境...
    </div>
  )
}

/** 模型下载管理器 */
function TtsModelManager() {
  const [modelStatus, setModelStatus] = useState<{ ready: boolean; dir: string } | null>(null)
  const [progress, setProgress] = useState<ModelDownloadProgress | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    window.electronAPI.getModelStatus().then(setModelStatus)
    const unsub = window.electronAPI.onModelDownloadProgress((p) => setProgress(p))
    return unsub
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await window.electronAPI.downloadModel()
      const status = await window.electronAPI.getModelStatus()
      setModelStatus(status)
    } catch (err: any) {
      console.error('模型下载失败:', err)
    } finally {
      setDownloading(false)
    }
  }

  if (modelStatus?.ready) {
    return (
      <div className="tts-status-banner tts-status-ok">
        ✅ 语音模型已就绪
        <div className="hint">模型位置: {modelStatus.dir}</div>
      </div>
    )
  }

  if (progress?.stage === 'checking' || downloading) {
    return (
      <div className="tts-download-progress">
        <div className="tts-download-label">
          ⏳ 正在准备下载...
        </div>
        <div className="tts-download-bar-track">
          <div className="tts-download-bar-fill" style={{ width: '2%' }} />
        </div>
        <div className="hint">正在获取文件列表，请稍候...</div>
      </div>
    )
  }

  if (progress && progress.stage === 'downloading') {
    return (
      <div className="tts-download-progress">
        <div className="tts-download-label">
          📥 正在下载语音模型... {progress.percent}%
        </div>
        <div className="tts-download-bar-track">
          <div
            className="tts-download-bar-fill"
            style={{ width: `${Math.min(100, progress.percent)}%` }}
          />
        </div>
        <div className="hint">
          {progress.downloadedMB.toFixed(0)} / {progress.totalMB.toFixed(0)} MB
          {progress.speedMBps > 0 && ` · ${progress.speedMBps.toFixed(1)} MB/s`}
        </div>
      </div>
    )
  }

  if (progress?.stage === 'error') {
    return (
      <div className="tts-status-banner tts-status-error">
        ❌ 下载失败: {progress.error || '未知错误'}
        <button className="small-btn" onClick={handleDownload} style={{ marginLeft: 8 }}>
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="tts-status-banner tts-status-checking">
      📦 语音模型未下载（约 2.3GB）
      <div className="hint">首次启用语音功能需要下载模型文件。建议在 Wi-Fi 环境下进行。</div>
      <button
        className="small-btn"
        onClick={handleDownload}
        disabled={downloading}
        style={{ marginTop: 8 }}
      >
        {downloading ? '下载中...' : '下载模型'}
      </button>
    </div>
  )
}

/** 参考音频上传 + 播放 */
function TtsReferenceAudio({ charName }: { charName: string }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 初始化：加载已保存的参考音频
  useEffect(() => {
    if (!charName) return
    window.electronAPI.getReferenceAudio(charName).then((url) => {
      if (url) {
        setAudioUrl(url)
        setFileName('ref_voice.wav')
      }
    })
  }, [charName])

  const handleUpload = async () => {
    if (!charName) return
    setUploading(true)
    try {
      const result = await window.electronAPI.saveReferenceAudio(charName)
      if (result) {
        setFileName(result)
        const url = await window.electronAPI.getReferenceAudio(charName)
        setAudioUrl(url)
      }
    } catch (err: any) {
      console.error('上传参考音频失败:', err)
    } finally {
      setUploading(false)
    }
  }

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    }
  }

  if (!audioUrl) {
    return (
      <div className="tts-ref-audio-empty">
        <span style={{ color: 'var(--text-secondary, #999)' }}>未上传参考音频</span>
        <button className="small-btn" onClick={handleUpload} disabled={uploading} style={{ marginLeft: 8 }}>
          {uploading ? '上传中...' : '上传音频'}
        </button>
      </div>
    )
  }

  return (
    <div className="tts-ref-audio">
      <span>✅ {fileName || '已设置'}</span>
      <button className="small-btn" onClick={handlePlay} style={{ marginLeft: 8 }}>▶ 试听</button>
      <button className="small-btn" onClick={handleUpload} disabled={uploading} style={{ marginLeft: 4 }}>
        🔄 更换
      </button>
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}
    </div>
  )
}

/** 全局 TTS 设置 */
function TtsGlobalSettings() {
  const { autoPlayTTS, setAutoPlayTTS, ttsEnabled, setTtsEnabled } = usePetStore()
  const [volume, setVolume] = useState(0.8)

  useEffect(() => {
    window.electronAPI.getTtsSettings().then((s) => {
      setTtsEnabled(s.enabled)
      setAutoPlayTTS(s.autoPlay)
      setVolume(s.volume)
    })
  }, [])

  const save = useCallback(
    (patch: Partial<TtsSettings>) => {
      window.electronAPI.getTtsSettings().then((current) => {
        const updated: TtsSettings = { ...current, ...patch }
        window.electronAPI.saveTtsSettings(updated)
      })
    },
    [],
  )

  return (
    <>
      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={ttsEnabled}
            onChange={(e) => {
              setTtsEnabled(e.currentTarget.checked)
              save({ enabled: e.currentTarget.checked })
            }}
          />
          <span>启用全局语音功能</span>
        </label>
        <div className="hint">关闭后所有角色都不再播放语音</div>
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={autoPlayTTS}
            onChange={(e) => {
              setAutoPlayTTS(e.currentTarget.checked)
              save({ autoPlay: e.currentTarget.checked })
            }}
            disabled={!ttsEnabled}
          />
          <span>AI 回复后自动播放语音</span>
        </label>
        <div className="hint">开启后每条 AI 回复会自动朗读；关闭后需手动点击 🔊 按钮播放</div>
      </div>

      <div className="form-group">
        <label>全局音量: {Math.round(volume * 100)}%</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => {
            const v = parseFloat(e.currentTarget.value)
            setVolume(v)
            save({ volume: v })
          }}
          disabled={!ttsEnabled}
        />
      </div>
    </>
  )
}

export default function SettingsWindow() {
  const {
    characters,
    activeCharacterId,
    characterPortraits,
    characterAvatars,
    setCharactersData,
    setActiveCharacterId,
    addCharacter,
    updateCharacter,
    removeCharacter,
    setCharacterPortrait,
    setCharacterAvatar,
    loadCharacterImages,
  } = usePetStore()

  const [activeTab, setActiveTab] = useState<'look' | 'soul' | 'voice'>('look')
  const [nav, setNav] = useState<NavKey>('appearance')
  const [actions, setActions] = useState<PetAction[]>([])
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState('')
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null)
  const [petImagePreview, setPetImagePreview] = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [bgRemoverOpen, setBgRemoverOpen] = useState(false)
  const [cropTarget, setCropTarget] = useState<'portrait' | 'avatar'>('portrait')
  const [personality, setPersonality] = useState('')
  const [speechStyle, setSpeechStyle] = useState('')
  const [charApiProfileId, setCharApiProfileId] = useState('')
  const [idleVideoChromaKey, setIdleVideoChromaKey] = useState('')
  const [idleVideoChromaKeyTolerance, setIdleVideoChromaKeyTolerance] = useState(100)

  // ===== 主题状态 =====
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('theme-mode') as 'light' | 'dark') || 'light'
  )

  // ===== API Profile 状态 =====
  const [apiProfiles, setApiProfiles] = useState<ApiProfile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string>('')
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState({ name: '', baseUrl: '', apiKey: '', model: '' })
  const [testResult, setTestResult] = useState<string | null>(null)
  const [profileSaved, setProfileSaved] = useState(false)

  // ===== 记忆状态 =====
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [newMemoryText, setNewMemoryText] = useState('')
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [editingMemoryText, setEditingMemoryText] = useState('')

  // 可编辑的 System Prompt
  const [promptText, setPromptText] = useState('')

  // 锁定状态，防止误触编辑
  const [locked, setLocked] = useState(true)

  // ===== 性格标签折叠 =====
  const [traitCollapsed, setTraitCollapsed] = useState(false)
  const COLLAPSE_THRESHOLD = 3

  const activeChar = useMemo(
    () => characters.find((c) => c.id === activeCharacterId) ?? characters[0] ?? null,
    [characters, activeCharacterId],
  )

  // 将 personality 文本解析为独立条目列表
  const personalityTraits = useMemo(() => {
    const raw = (personality || '').trim()
    if (!raw) return []
    return raw.split(/\n+/).filter((t) => t.trim().length > 0).map((t) => t.trim())
  }, [personality])

  // 根据当前表单状态计算 System Prompt 预览（性格描述 + 说话风格 + 记忆）
  const systemPromptPreview = useMemo(() => {
    if (!activeChar) return ''
    const charPreview: CharacterConfig = {
      ...activeChar,
      personality,
      speechStyle,
    }
    return buildSystemPrompt(charPreview, memories)
  }, [activeChar, personality, speechStyle, memories])

  // 同步 promptText：当 activeChar 变化或内置提示词更新时更新编辑框
  useEffect(() => {
    if (activeChar) {
      if (activeChar.customSystemPrompt) {
        setPromptText(activeChar.customSystemPrompt)
      } else {
        setPromptText(systemPromptPreview)
      }
    }
  }, [activeChar?.id, personality, speechStyle, memories])

  // 初始化：加载角色
  useEffect(() => {
    window.electronAPI.getCharacters().then((data) => {
      setCharactersData(data)
      for (const c of data.characters) {
        loadCharacterImages(c.id, c.name)
      }
    })

    const unsubChars = window.electronAPI.onCharactersUpdated((data) => {
      setCharactersData(data)
      for (const c of data.characters) {
        loadCharacterImages(c.id, c.name)
      }
    })
    const unsubImage = window.electronAPI.onPetImageUpdated(({ charId, imageType, dataUrl }) => {
      if (imageType === 'portrait') {
        setCharacterPortrait(charId, dataUrl)
      } else if (imageType === 'avatar') {
        setCharacterAvatar(charId, dataUrl)
      }
    })

    return () => {
      unsubChars()
      unsubImage()
    }
  }, [setCharactersData, setCharacterPortrait, setCharacterAvatar, loadCharacterImages])

  // 初始化：加载 API Profiles
  useEffect(() => {
    window.electronAPI.getApiProfiles().then((data) => {
      setApiProfiles(data.profiles)
      setActiveProfileId(data.activeProfileId)
    })
    const unsubProfiles = window.electronAPI.onApiProfilesUpdated((data) => {
      setApiProfiles(data.profiles)
      setActiveProfileId(data.activeProfileId)
    })
    return () => unsubProfiles()
  }, [])

  // 切换角色时加载记忆 + 动作
  useEffect(() => {
    if (activeChar) {
      window.electronAPI.getAgentMemory(activeChar.id).then(setMemories)
      window.electronAPI.getPetActions(activeChar.name).then((list) => {
        setActions(list.length > 0 ? list : DEFAULT_PET_ACTIONS)
      })
    }
  }, [activeChar?.name])
  // ????????????? storage ??
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'theme-mode' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setThemeMode(e.newValue)
        document.documentElement.setAttribute('data-theme', e.newValue)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])


  // 切换角色时更新表单
  useEffect(() => {
    if (activeChar) {
      setName(activeChar.name)
      setPetImagePreview(characterPortraits[activeChar.id] ?? null)
      setAvatarPreview(characterAvatars[activeChar.id] ?? null)
      setPersonality(activeChar.personality || '')
      setSpeechStyle(activeChar.speechStyle || '')
      setCharApiProfileId(activeChar.apiProfileId || '')
      setIdleVideoChromaKey(activeChar.idleVideoChromaKey || '')
      setIdleVideoChromaKeyTolerance(activeChar.idleVideoChromaKeyTolerance ?? 100)
    }
  }, [activeChar?.id, characterPortraits, characterAvatars])

  // ===== 保存到磁盘 =====
  const persist = useCallback(
    (chars: CharacterConfig[], activeId: string) => {
      window.electronAPI.saveCharacters({ characters: chars, activeId })
    },
    [],
  )

  /** 保存单个角色的修改（不改变激活角色） */
  const saveSingleChar = useCallback(
    (char: CharacterConfig) => {
      const updated = characters.map(c => c.id === char.id ? char : c)
      window.electronAPI.saveCharacters({ characters: updated, activeId: activeCharacterId })
    },
    [characters, activeCharacterId],
  )

  // ===== 角色操作 =====
  const handleSelectChar = useCallback(
    (id: string) => {
      setActiveCharacterId(id)
      const { characters } = usePetStore.getState()
      window.electronAPI.saveCharacters({ characters, activeId: id })
    },
    [setActiveCharacterId],
  )

  const handleNewChar = useCallback(() => {
    const g = GRADIENT_PALETTE[Math.floor(Math.random() * GRADIENT_PALETTE.length)]
    const newChar: CharacterConfig = {
      id: generateId(),
      name: randomName(),
      gradient: g,
      personality: '',
      voiceId: '',
      speechStyle: '',
      referenceAudio: '',
      ttsEnabled: false,
      ttsSpeed: 1.0,
      ttsPitch: 0,
    }
    addCharacter(newChar)
    const all = [...characters, newChar]
    persist(all, newChar.id)
  }, [characters, addCharacter, persist])

  const handleDeleteChar = useCallback(() => {
    if (!activeChar || characters.length <= 1) return
    removeCharacter(activeChar.id)
    const next = characters.filter((c) => c.id !== activeChar.id)
    persist(next, next[0]?.id ?? '')
  }, [activeChar, characters, removeCharacter, persist])

  const handleNameChange = useCallback(
    (newName: string) => {
      setName(newName)
      if (!activeChar) return
      const updated = { ...activeChar, name: newName }
      updateCharacter(updated)
      const all = characters.map((c) => (c.id === activeChar.id ? updated : c))
      persist(all, activeCharacterId)
    },
    [activeChar, characters, activeCharacterId, updateCharacter, persist],
  )

  const handleUploadImage = useCallback(async () => {
    if (!activeChar) return
    const dataUrl = await window.electronAPI.openImageDialog(activeChar.name, 'portrait')
    if (dataUrl) {
      setCropTarget('portrait')
      setCropImageUrl(dataUrl)
    }
  }, [activeChar])

  const handleCropConfirm = useCallback((croppedDataUrl: string) => {
    if (!activeChar) return
    setCropImageUrl(null)
    if (cropTarget === "avatar") {
      setCharacterAvatar(activeChar.id, croppedDataUrl)
      setAvatarPreview(croppedDataUrl)
    } else {
      setCharacterPortrait(activeChar.id, croppedDataUrl)
      setPetImagePreview(croppedDataUrl)
    }
    // persist 只写 config（不含图片），图片文件已在 openImageDialog 时写入磁盘
  }, [activeChar, cropTarget, setCharacterPortrait, setCharacterAvatar])

  const handleCropCancel = useCallback(() => {
    setCropImageUrl(null)
  }, [])

  const handleBgRemoveConfirm = useCallback((resultDataUrl: string) => {
    if (!activeChar) return
    setBgRemoverOpen(false)
    setCharacterPortrait(activeChar.id, resultDataUrl)
    setPetImagePreview(resultDataUrl)
    // 持久化：将去底后的图片写入磁盘，否则刷新后显示原图
    const updatedChar = { ...activeChar, imageDataUrl: resultDataUrl }
    saveSingleChar(updatedChar)
  }, [activeChar, setCharacterPortrait, saveSingleChar])

  const [userDataPath, setUserDataPath] = useState('')

  // 获取数据目录路径
  useEffect(() => {
    window.electronAPI.getDataPath().then((p) => setUserDataPath(p))
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => {
      const next = prev === "light" ? "dark" : "light"
      localStorage.setItem("theme-mode", next)
      document.documentElement.setAttribute("data-theme", next)
      return next
    })
  }, [])

  const handleClearImage = useCallback(() => {
    if (!activeChar) return
    setCharacterPortrait(activeChar.id, null)
    setPetImagePreview(null)
  }, [activeChar, setCharacterPortrait])

  const handleUploadAvatar = useCallback(async () => {
    if (!activeChar) return
    const dataUrl = await window.electronAPI.openImageDialog(activeChar.name, 'avatar')
    if (dataUrl) {
      setCropTarget("avatar")
      setCropImageUrl(dataUrl)
    }
  }, [activeChar])

  const handleClearAvatar = useCallback(() => {
    if (!activeChar) return
    setCharacterAvatar(activeChar.id, null)
    setAvatarPreview(null)
  }, [activeChar, setCharacterAvatar])

  // ===== API Profile 操作 =====
  const persistProfiles = useCallback(
    (profiles: ApiProfile[], activeId: string) => {
      window.electronAPI.saveApiProfiles({ profiles, activeProfileId: activeId })
    },
    [],
  )

  const handleSelectProfile = useCallback((id: string) => {
    setEditingProfileId(id)
    setTestResult(null)
    setProfileSaved(false)
    const p = apiProfiles.find((x) => x.id === id)
    if (p) {
      setProfileForm({ name: p.name, baseUrl: p.baseUrl, apiKey: p.apiKey, model: p.model })
    }
  }, [apiProfiles])

  const handleNewProfile = useCallback(() => {
    const now = Date.now()
    const prof: ApiProfile = {
      id: genId(),
      name: '新配置',
      baseUrl: '',
      apiKey: '',
      model: '',
      isActive: false,
      maxTokens: 4096,
      temperature: 0.7,
      createdAt: now,
      updatedAt: now,
    }
    const next = [...apiProfiles, prof]
    setApiProfiles(next)
    setEditingProfileId(prof.id)
    setProfileForm({ name: prof.name, baseUrl: prof.baseUrl, apiKey: prof.apiKey, model: prof.model })
    setTestResult(null)
    setProfileSaved(false)
    persistProfiles(next, activeProfileId)
  }, [apiProfiles, activeProfileId, persistProfiles])

  const handleDeleteProfile = useCallback((id: string) => {
    if (apiProfiles.length <= 1) return
    const next = apiProfiles.filter((p) => p.id !== id)
    const nextActive = id === activeProfileId ? (next[0]?.id ?? '') : activeProfileId
    setApiProfiles(next)
    setActiveProfileId(nextActive)
    if (editingProfileId === id) setEditingProfileId(null)
    persistProfiles(next, nextActive)
  }, [apiProfiles, activeProfileId, editingProfileId, persistProfiles])

  const handleProfileFormChange = useCallback((field: string, value: string) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleSaveProfile = useCallback(() => {
    if (!editingProfileId) return
    const now = Date.now()
    const next = apiProfiles.map((p) =>
      p.id === editingProfileId
        ? { ...p, ...profileForm, updatedAt: now }
        : p,
    )
    setApiProfiles(next)
    persistProfiles(next, activeProfileId)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2000)
  }, [editingProfileId, apiProfiles, profileForm, activeProfileId, persistProfiles])

  const handleSetActiveProfile = useCallback((id: string) => {
    const now = Date.now()
    const next = apiProfiles.map((p) => ({
      ...p,
      isActive: p.id === id,
      updatedAt: p.id === id ? now : p.updatedAt,
    }))
    setApiProfiles(next)
    setActiveProfileId(id)
    persistProfiles(next, id)
  }, [apiProfiles, persistProfiles])

  const handleTestConnection = useCallback(async () => {
    if (!editingProfileId) return
    setTestResult('测试中...')
    const p = apiProfiles.find((x) => x.id === editingProfileId)
    if (!p) return
    const testProfile: ApiProfile = { ...p, ...profileForm }
    const result = await window.electronAPI.testApiConnection(testProfile)
    if (result.ok) {
      setTestResult('✅ 连接成功')
    } else if (result.status === 401 || result.status === 403) {
      setTestResult('❌ API Key 无效')
    } else if (result.status === 0) {
      setTestResult('❌ 连接失败: ' + (result.error || '网络错误'))
    } else {
      setTestResult('❌ 服务器错误 (HTTP ' + result.status + ')')
    }
  }, [editingProfileId, apiProfiles, profileForm])

  // ===== 记忆操作 =====
  const handleAddMemory = useCallback(async () => {
    if (!newMemoryText.trim() || !activeChar) return
    const now = Date.now()
    const entry: MemoryEntry = {
      id: genId(),
      content: newMemoryText.trim(),
      source: 'user-explicit',
      createdAt: now,
      updatedAt: now,
    }
    await window.electronAPI.addAgentMemory(activeChar.id, entry)
    setMemories((prev) => [...prev, entry])
    setNewMemoryText('')
  }, [newMemoryText, activeChar])

  const handleDeleteMemory = useCallback(async (id: string) => {
    if (!activeChar) return
    await window.electronAPI.deleteAgentMemory(activeChar.id, id)
    setMemories((prev) => prev.filter((m) => m.id !== id))
  }, [activeChar])

  const handleStartEditMemory = useCallback((id: string, content: string) => {
    setEditingMemoryId(id)
    setEditingMemoryText(content)
  }, [])

  const handleSaveMemory = useCallback(async () => {
    if (!activeChar || !editingMemoryId) return
    await window.electronAPI.updateAgentMemory(activeChar.id, editingMemoryId, editingMemoryText)
    setMemories((prev) =>
      prev.map((m) => (m.id === editingMemoryId ? { ...m, content: editingMemoryText, updatedAt: Date.now() } : m)),
    )
    setEditingMemoryId(null)
    setEditingMemoryText('')
  }, [activeChar, editingMemoryId, editingMemoryText])

  const handleCancelEditMemory = useCallback(() => {
    setEditingMemoryId(null)
    setEditingMemoryText('')
  }, [])

  // 删除单条性格标签（从 personality 中移除对应行）
  const handleDeleteTrait = useCallback((index: number) => {
    if (!activeChar) return
    const next = personalityTraits.filter((_, i) => i !== index).join('\n')
    setPersonality(next)
    const updated = { ...activeChar, personality: next }
    updateCharacter(updated)
    const all = characters.map((c) => (c.id === activeChar.id ? updated : c))
    persist(all, activeCharacterId)
  }, [activeChar, personalityTraits, characters, activeCharacterId, updateCharacter, persist])

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setPromptText(text)
    if (activeChar) {
      const updated = { ...activeChar, customSystemPrompt: text || undefined }
      updateCharacter(updated)
      const all = characters.map((c) => (c.id === activeChar.id ? updated : c))
      persist(all, activeCharacterId)
    }
  }, [activeChar, characters, updateCharacter, persist, activeCharacterId])
  const handleSaveActions = async (updated: PetAction[]) => {
    if (!activeChar) return
    setActions(updated)
    await window.electronAPI.savePetActions(activeChar.name, updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="settings-window">
      <div className="settings-titlebar">
        设置
        <button className="close-btn" onClick={() => window.electronAPI.close()} title="关闭">✕</button>
      </div>

      <div className="settings-body">
        {/* 左侧栏 */}
        <div className="settings-sidebar">
          <div className="section-label">角色</div>
          {characters.map((c) => (
            <button
              key={c.id}
              className={`char-item${c.id === activeCharacterId ? ' active' : ''}`}
              onClick={() => handleSelectChar(c.id)}
            >
              <div className="dot" style={{ background: characterAvatars[c.id] ? `url(${characterAvatars[c.id]}) center/cover no-repeat` : c.gradient }} />
              <span className="char-item-name">{c.name}</span>
              {characters.length > 1 && c.id === activeCharacterId && (
                <button
                  className="char-delete-btn"
                  onClick={(e) => { e.stopPropagation(); handleDeleteChar() }}
                  title="删除角色"
                >
                  ×
                </button>
              )}
            </button>
          ))}
          <button className="char-item add-new" onClick={handleNewChar}>
            <div className="dot">+</div>
            新建角色
          </button>

          <div className="divider" />

          {([
            ['appearance', '🎨 外观'],
            ['actions', '⚡ 动作'],
            ['api', '🔌 API'],
            ['about', 'ℹ️ 关于'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              className={`nav-item${nav === key ? ' active' : ''}`}
              onClick={() => setNav(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 右侧内容 */}
        <div className="settings-content">
          {nav === 'appearance' && activeChar && (
            <>
              <h3>编辑角色 · {activeChar.name}</h3>
              <p className="subtitle">自定义角色的外观、性格和声音</p>

              <div className="step-tabs">
                {(['look', 'soul', 'voice'] as const).map((t) => (
                  <button
                    key={t}
                    className={`step-tab${activeTab === t ? ' active' : ''}`}
                    onClick={() => setActiveTab(t)}
                  >
                    {{ look: '外表', soul: '灵魂', voice: '声音' }[t]}
                  </button>
                ))}
              </div>

              {activeTab === 'look' && (
                <>
                  <div className="form-group">
                    <label>角色名称</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>角色立绘 <span className="look-hint-inline">点击按钮后的窗口在下方</span></label>
                    {petImagePreview ? (
                      <div className="pet-image-preview-area">
                        <img className="pet-image-preview" src={petImagePreview} alt="角色立绘预览" />
                        <div className="pet-image-actions">
                          <button className="pet-image-change-btn" onClick={handleUploadImage}>更换图片</button>
                          <button className="pet-image-reset-btn" onClick={() => setBgRemoverOpen(true)}>移除背景</button>
                          <button className="pet-image-reset-btn" onClick={handleClearImage}>使用默认</button>
                        </div>
                      </div>
                    ) : (
                      <button className="avatar-upload-btn" onClick={handleUploadImage}>点击上传立绘</button>
                    )}
                    <div className="hint">用于桌宠形象显示，建议 1:1 比例</div>
                  </div>
                  <div className="form-group">
                    <label>角色头像</label>
                    {avatarPreview ? (
                      <div className="pet-image-preview-area">
                        <div className="avatar-preview-circle">
                          <img className="avatar-preview-img" src={avatarPreview} alt="角色头像预览" />
                        </div>
                        <div className="pet-image-actions">
                          <button className="pet-image-change-btn" onClick={handleUploadAvatar}>更换头像</button>
                          <button className="pet-image-reset-btn" onClick={handleClearAvatar}>清除头像</button>
                        </div>
                      </div>
                    ) : (
                      <button className="avatar-upload-btn" onClick={handleUploadAvatar}>点击上传头像</button>
                    )}
                    <div className="hint">用于侧边栏和标题栏，建议正方形图片</div>
                  </div>
                  <div className="form-group">
                    <label>待机视频去底色</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={idleVideoChromaKey}
                        onChange={(e) => {
                          const val = e.target.value
                          setIdleVideoChromaKey(val)
                          if (!activeChar) return
                          const updated = {
                            ...activeChar,
                            idleVideoChromaKey: val || undefined,
                            idleVideoChromaKeyTolerance: idleVideoChromaKeyTolerance,
                          }
                          updateCharacter(updated)
                          const all = characters.map((c) => (c.id === activeChar.id ? updated : c))
                          persist(all, activeCharacterId)
                        }}
                        placeholder="#00FF00 或留空=不启用"
                        style={{ width: 200, padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontFamily: 'monospace', fontSize: 13 }}
                      />
                      {['#00FF00', '#0000FF', '#FF00FF', '#00FFFF'].map((color) => (
                        <button
                          key={color}
                          onClick={() => {
                            setIdleVideoChromaKey(color)
                            if (!activeChar) return
                            const updated = {
                              ...activeChar,
                              idleVideoChromaKey: color,
                              idleVideoChromaKeyTolerance: idleVideoChromaKeyTolerance,
                            }
                            updateCharacter(updated)
                            const all = characters.map((c) => (c.id === activeChar.id ? updated : c))
                            persist(all, activeCharacterId)
                          }}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            border: idleVideoChromaKey === color ? '3px solid #E8927C' : '2px solid #ddd',
                            background: color,
                            cursor: 'pointer',
                          }}
                          title={color === '#00FF00' ? '绿色（绿幕）' : color === '#0000FF' ? '蓝色（蓝幕）' : color === '#FF00FF' ? '品红' : '青色'}
                        />
                      ))}
                      {idleVideoChromaKey && (
                        <button
                          onClick={() => {
                            setIdleVideoChromaKey('')
                            if (!activeChar) return
                            const updated = {
                              ...activeChar,
                              idleVideoChromaKey: undefined,
                              idleVideoChromaKeyTolerance: undefined,
                            }
                            updateCharacter(updated)
                            const all = characters.map((c) => (c.id === activeChar.id ? updated : c))
                            persist(all, activeCharacterId)
                          }}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E8927C', background: 'transparent', color: '#E8927C', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
                        >
                          清除
                        </button>
                      )}
                    </div>
                    {idleVideoChromaKey && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#999' }}>容差</span>
                        <input
                          type="range"
                          min={10}
                          max={255}
                          value={idleVideoChromaKeyTolerance}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10)
                            setIdleVideoChromaKeyTolerance(val)
                            if (!activeChar) return
                            const updated = { ...activeChar, idleVideoChromaKeyTolerance: val }
                            updateCharacter(updated)
                            const all = characters.map((c) => (c.id === activeChar.id ? updated : c))
                            persist(all, activeCharacterId)
                          }}
                          style={{ flex: 1, maxWidth: 200 }}
                        />
                        <span style={{ fontSize: 12, color: '#999', width: 30 }}>{idleVideoChromaKeyTolerance}</span>
                      </div>
                    )}
                    <div className="hint">为空闲视频去底，输入视频背景色（#00FF00 绿幕 #0000FF 蓝幕）。仅对非透明格式（mp4/mov）生效。</div>
                  </div>
                  <div className="char-preview-card">
                    <div className="char-preview-header">
                      <div
                        className="char-preview-avatar"
                        style={{
                          background: avatarPreview
                            ? `url("${avatarPreview}") center/cover no-repeat`
                            : activeChar.gradient,
                        }}
                      />
                      <div className="char-preview-info">
                        <span className="char-preview-name">{name || activeChar.name}</span>
                      </div>
                    </div>
                  </div>
                {bgRemoverOpen && petImagePreview && (
                  <BackgroundRemover
                    imageUrl={petImagePreview}
                    onConfirm={handleBgRemoveConfirm}
                    onCancel={() => setBgRemoverOpen(false)}
                  />
                )}
                {cropImageUrl && (
                  <ImageCropper
                    imageUrl={cropImageUrl}
                    onCrop={handleCropConfirm}
                    onCancel={handleCropCancel}
                  />
                )}
                </>
              )}

              {activeTab === 'soul' && (
                <>
                  <div className="form-group">
                    <label>性格描述</label>
                    {personalityTraits.length > 0 && (
                      <div className="trait-tags-area">
                        <div className={`trait-tags-list${traitCollapsed ? ' collapsed' : ''}`}>
                          {personalityTraits.map((trait, i) => (
                            <div key={i} className="trait-tag">
                              <span className="trait-tag-text">{trait}</span>
                              <button
                                className="trait-tag-remove"
                                onClick={() => handleDeleteTrait(i)}
                                title="移除此设定"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        {personalityTraits.length > COLLAPSE_THRESHOLD && (
                          <button
                            className="trait-collapse-toggle"
                            onClick={() => setTraitCollapsed(!traitCollapsed)}
                          >
                            {traitCollapsed
                              ? `展开全部 (${personalityTraits.length} 条)`
                              : '收起'}
                          </button>
                        )}
                      </div>
                    )}
                    <textarea
                      value={personality}
                      onChange={(e) => {
                        const v = e.target.value
                        setPersonality(v)
                        if (!activeChar) return
                        const updated = { ...activeChar, personality: v }
                        updateCharacter(updated)
                        const all = characters.map((c) => (c.id === activeChar.id ? updated : c))
                        persist(all, activeCharacterId)
                      }}
                      placeholder="用自然语言描述角色性格，AI 会自动理解。例如：温柔体贴、偶尔毒舌、喜欢吐槽天气..."
                    />
                    <div className="hint">在聊天中发送"你是xxx"可自动追加到此处。每条设定会作为 AI System Prompt 的一部分</div>
                  </div>
                  <div className="form-group">
                    <label>说话风格</label>
                    <textarea
                      value={speechStyle}
                      onChange={(e) => {
                        const v = e.target.value
                        setSpeechStyle(v)
                        if (!activeChar) return
                        const updated = { ...activeChar, speechStyle: v }
                        updateCharacter(updated)
                        const all = characters.map((c) => (c.id === activeChar.id ? updated : c))
                        persist(all, activeCharacterId)
                      }}
                      placeholder={'描述角色的说话方式，如：喜欢用颜文字、每句话后面加“喵”、说话带京腔...'}
                    />
                    <div className="hint">控制角色的语言风格，与性格描述配合使用</div>
                  </div>
                  <div className="form-group">
                    <label>🔌 角色专属 API</label>
                    <select
                      value={charApiProfileId}
                      onChange={(e) => {
                        const v = e.target.value
                        setCharApiProfileId(v)
                        if (!activeChar) return
                        const updated = { ...activeChar, apiProfileId: v || undefined }
                        updateCharacter(updated)
                        const all = characters.map((c) => (c.id === activeChar.id ? updated : c))
                        persist(all, activeCharacterId)
                      }}
                    >
                      <option value="">跟随全局设置 ({apiProfiles.find(p => p.id === activeProfileId)?.name || '未选择'})</option>
                      {apiProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.model})
                        </option>
                      ))}
                    </select>
                    <div className="hint">为该角色选择专用的 API 配置；选择"跟随全局"则使用顶部全局 API 设置</div>
                  </div>
                  {/* 记忆管理 */}
                  <div className="form-group" style={{ borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: 14, marginTop: 8 }}>
                    <label>🧠 智能体记忆</label>
                    <div className="hint" style={{ marginBottom: 8 }}>AI 会记住这些信息，在对话中引用。聊天时发送"记住 xxx"也可以自动添加。</div>
                    {memories.length > 0 && (
                      <div className="memory-list">
                        {memories.map((m) => (
                          <div key={m.id} className="memory-item">
                            {editingMemoryId === m.id ? (
                              <div className="memory-edit-row">
                                <input
                                  type="text"
                                  value={editingMemoryText}
                                  onChange={(e) => setEditingMemoryText(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveMemory(); if (e.key === 'Escape') handleCancelEditMemory(); }}
                                  autoFocus
                                />
                                <button className="memory-btn save" onClick={handleSaveMemory}>✓</button>
                                <button className="memory-btn cancel" onClick={handleCancelEditMemory}>✕</button>
                              </div>
                            ) : (
                              <div className="memory-row">
                                <span className="memory-text">{m.content}</span>
                                <div className="memory-row-actions">
                                  <button className="memory-action" onClick={() => handleStartEditMemory(m.id, m.content)} title="编辑">✎</button>
                                  <button className="memory-action danger" onClick={() => handleDeleteMemory(m.id)} title="删除">✕</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="memory-add-row">
                      <input
                        type="text"
                        value={newMemoryText}
                        onChange={(e) => setNewMemoryText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddMemory(); }}
                        placeholder="添加新记忆，如: 用户喜欢吃火锅"
                      />
                      <button className="memory-btn add" onClick={handleAddMemory} disabled={!newMemoryText.trim()}>添加</button>
                    </div>
                  </div>

                  {/* System Prompt 实时预览 */}
                  <div className="form-group" style={{ borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: 14, marginTop: 8 }}>
                    <label>🤖 AI 视角预览</label>
                    <div className="hint" style={{ marginBottom: 8 }}>以下内容会作为 System Prompt 发送给 AI，实时反映上方设置</div>
                    <div className={"system-prompt-preview" + (locked ? " locked" : "")}>
                      <div className="system-prompt-toolbar">
                        <span className="system-prompt-label">🤖 AI 视角提示词</span>
                        <button
                          className="system-prompt-lock-btn"
                          onClick={() => setLocked(!locked)}
                          title={locked ? "解锁编辑" : "锁定防止误触"}
                        >
                          {locked ? "🔒" : "🔓"}
                        </button>
                      </div>
                      <textarea
                        className="system-prompt-textarea"
                        value={promptText}
                        onChange={handlePromptChange}
                        readOnly={locked}
                        placeholder="尚未设置性格描述、说话风格或记忆。填写上方字段后这里会显示 AI 将收到的完整提示词。"
                        rows={10}
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'voice' && (
                <>
                  {/* GPU 状态 */}
                  <TtsGpuStatus />

                  {/* Python 环境 */}
                  <TtsPythonEnv />

                  {/* 模型管理 */}
                  <TtsModelManager />

                  {/* 参考音频 */}
                  <div className="form-group">
                    <label>🔊 参考音频</label>
                    <div className="hint">上传 3-5 秒的 WAV/MP3 音频作为角色音色参考。要求安静环境，自然说话。</div>
                    <TtsReferenceAudio charName={activeChar?.name ?? ''} />
                  </div>

                  {/* 角色 TTS 设置 */}
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={activeChar?.ttsEnabled ?? false}
                        onChange={(e) => {
                          if (!activeChar) return
                          const updated = { ...activeChar, ttsEnabled: e.currentTarget.checked }
                          updateCharacter(updated)
                          saveSingleChar(updated)
                        }}
                      />
                      <span>为该角色启用语音播放</span>
                    </label>
                  </div>

                  {(activeChar?.ttsEnabled) && (
                    <>
                      <div className="form-group">
                        <label>语速: {activeChar?.ttsSpeed?.toFixed(1) ?? '1.0'}x</label>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={activeChar?.ttsSpeed ?? 1.0}
                          onChange={(e) => {
                            if (!activeChar) return
                            const updated = { ...activeChar, ttsSpeed: parseFloat(e.currentTarget.value) }
                            updateCharacter(updated)
                            saveSingleChar(updated)
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label>音调: {activeChar?.ttsPitch ?? 0}</label>
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="1"
                          value={activeChar?.ttsPitch ?? 0}
                          onChange={(e) => {
                            if (!activeChar) return
                            const updated = { ...activeChar, ttsPitch: parseInt(e.currentTarget.value, 10) }
                            updateCharacter(updated)
                            saveSingleChar(updated)
                          }}
                        />
                      </div>
                    </>
                  )}

                  {/* 全局 TTS 设置 */}
                  <div className="form-group" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color, #e0e0e0)' }}>
                    <label style={{ fontWeight: 600 }}>🌐 全局语音设置</label>
                    <TtsGlobalSettings />
                  </div>
                </>
              )}

              <div className="theme-toggle-section">
                <label className="theme-toggle-label">
                  <span>🌓 主题模式（界面外观）</span>
                  <button
                    className={`theme-toggle-btn${themeMode === "dark" ? " dark" : ""}`}
                    onClick={toggleTheme}
                    title={themeMode === "dark" ? "切换到浅色模式" : "切换到深色模式"}
                  >
                    <span className="theme-toggle-thumb" />
                  </button>
                  <span className="theme-mode-text">{themeMode === "dark" ? "深色模式" : "浅色模式"}</span>
                </label>
              </div>

            </>
          )}

          {nav === 'actions' && (
            <>
              <h3>动作按钮配置</h3>
              <p className="subtitle">自定义右键菜单的动作按钮</p>
              {saved && <span className="save-toast">✓ 已保存</span>}
              <button className="idle-action-btn-below" onClick={() => window.electronAPI.openIdleVideosFolder()}>待机动作列表</button>
              <ActionEditor actions={actions} onSave={handleSaveActions} charName={activeChar?.name} />
            </>
          )}

          {nav === 'api' && (
            <>
              <h3>API 配置</h3>
              <p className="subtitle">管理多个 AI 服务配置，随时切换</p>
              {profileSaved && <span className="save-toast">✓ 已保存</span>}
              {testResult && (
                <span className={`test-result${testResult.startsWith('✅') ? ' success' : ' fail'}`}>
                  {testResult}
                </span>
              )}

              <div className="api-layout">
                {/* Profile 列表 */}
                <div className="api-profile-list">
                  {apiProfiles.map((p) => (
                    <button
                      key={p.id}
                      className={`api-profile-card${p.id === editingProfileId ? ' selected' : ''}${p.id === activeProfileId ? ' active' : ''}`}
                      onClick={() => handleSelectProfile(p.id)}
                    >
                      <div className="api-profile-indicator">
                        {p.id === activeProfileId ? '●' : '○'}
                      </div>
                      <div className="api-profile-info">
                        <div className="api-profile-name">
                          {p.name}
                          {p.id === activeProfileId && <span className="api-active-badge">当前</span>}
                        </div>
                        <div className="api-profile-model">{p.model || '未设置模型'}</div>
                      </div>
                    </button>
                  ))}
                  <button className="api-profile-card add-new" onClick={handleNewProfile}>
                    <div className="api-profile-indicator">+</div>
                    <div className="api-profile-info">
                      <div className="api-profile-name">新建配置</div>
                    </div>
                  </button>
                </div>

                {/* 编辑表单 */}
                {editingProfileId && (
                  <div className="api-profile-form">
                    <div className="form-group">
                      <label>名称</label>
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => handleProfileFormChange('name', e.target.value)}
                        placeholder="如: DeepSeek"
                      />
                    </div>
                    <div className="form-group">
                      <label>Base URL</label>
                      <input
                        type="text"
                        value={profileForm.baseUrl}
                        onChange={(e) => handleProfileFormChange('baseUrl', e.target.value)}
                        placeholder="https://api.deepseek.com/v1"
                      />
                      <div className="hint">OpenAI 兼容接口地址</div>
                    </div>
                    <div className="form-group">
                      <label>API Key</label>
                      <input
                        type="password"
                        value={profileForm.apiKey}
                        onChange={(e) => handleProfileFormChange('apiKey', e.target.value)}
                        placeholder="sk-..."
                      />
                    </div>
                    <div className="form-group">
                      <label>模型</label>
                      <input
                        type="text"
                        value={profileForm.model}
                        onChange={(e) => handleProfileFormChange('model', e.target.value)}
                        placeholder="deepseek-chat"
                      />
                    </div>
                    <div className="api-profile-actions">
                      <button className="api-btn primary" onClick={handleSaveProfile}>保存</button>
                      <button
                        className="api-btn"
                        onClick={() => handleSetActiveProfile(editingProfileId)}
                        disabled={editingProfileId === activeProfileId}
                      >
                        设为当前
                      </button>
                      <button className="api-btn" onClick={handleTestConnection}>测试连接</button>
                      <button
                        className="api-btn danger"
                        onClick={() => handleDeleteProfile(editingProfileId)}
                        disabled={apiProfiles.length <= 1}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {nav === 'about' && (
            <div className="about-section">
              <h3>关于 WITH U</h3>
              <p className="subtitle">桌面宠物 + AI 聊天伴侣</p>
              <p><strong>版本：</strong>0.1.0</p>
              <p><strong>技术栈：</strong>Electron + React + TypeScript</p>
              <p><strong>功能：</strong>桌宠互动 · AI 聊天 · 角色自定义</p>
              <p><strong>数据地址：</strong>{userDataPath || '加载中...'}</p>
              <div className="theme-toggle-section">
                <label className="theme-toggle-label">
                  <span>🌓 主题模式</span>
                  <button
                    className={`theme-toggle-btn${themeMode === "dark" ? " dark" : ""}`}
                    onClick={toggleTheme}
                    title={themeMode === "dark" ? "切换到浅色模式" : "切换到深色模式"}
                  >
                    <span className="theme-toggle-thumb" />
                  </button>
                  <span className="theme-mode-text">{themeMode === "dark" ? "深色模式" : "浅色模式"}</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}











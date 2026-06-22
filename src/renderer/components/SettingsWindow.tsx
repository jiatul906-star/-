import { useEffect, useState, useCallback, useMemo } from 'react'
import type { PetAction, CharacterConfig, ApiProfile, ApiProfilesData, MemoryEntry } from '../../common/types'
import { DEFAULT_PET_ACTIONS } from '../../common/types'
import { usePetStore } from '../stores/pet-store'
import { buildSystemPrompt } from '../plugins/chat/api'
import ActionEditor from './ActionEditor'
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

export default function SettingsWindow() {
  const {
    characters,
    activeCharacterId,
    setCharactersData,
    setActiveCharacterId,
    addCharacter,
    updateCharacter,
    removeCharacter,
    setCharacterImage,
  } = usePetStore()

  const [activeTab, setActiveTab] = useState<'look' | 'soul' | 'voice'>('look')
  const [nav, setNav] = useState<NavKey>('appearance')
  const [actions, setActions] = useState<PetAction[]>([])
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState('')
  const [petImagePreview, setPetImagePreview] = useState<string | null>(null)
  const [personality, setPersonality] = useState('')
  const [speechStyle, setSpeechStyle] = useState('')
  const [charApiProfileId, setCharApiProfileId] = useState('')

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

  // 初始化：加载角色 + 动作
  useEffect(() => {
    window.electronAPI.getCharacters().then(setCharactersData)
    window.electronAPI.getPetActions().then((list) => {
      setActions(list.length > 0 ? list : DEFAULT_PET_ACTIONS)
    })

    const unsubChars = window.electronAPI.onCharactersUpdated(setCharactersData)
    const unsubImage = window.electronAPI.onPetImageUpdated(({ charId, dataUrl }) => {
      setCharacterImage(charId, dataUrl)
    })

    return () => {
      unsubChars()
      unsubImage()
    }
  }, [setCharactersData, setCharacterImage])

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

  // 切换角色时加载记忆
  useEffect(() => {
    if (activeChar) {
      window.electronAPI.getAgentMemory(activeChar.id).then(setMemories)
    }
  }, [activeChar?.id])

  // 切换角色时更新表单
  useEffect(() => {
    if (activeChar) {
      setName(activeChar.name)
      setPetImagePreview(activeChar.imageDataUrl)
      setPersonality(activeChar.personality || '')
      setSpeechStyle(activeChar.speechStyle || '')
      setCharApiProfileId(activeChar.apiProfileId || '')
    }
  }, [activeChar?.id])

  // ===== 保存到磁盘 =====
  const persist = useCallback(
    (chars: CharacterConfig[], activeId: string) => {
      window.electronAPI.saveCharacters({ characters: chars, activeId })
    },
    [],
  )

  // ===== 角色操作 =====
  const handleSelectChar = useCallback(
    (id: string) => {
      setActiveCharacterId(id)
    },
    [setActiveCharacterId],
  )

  const handleNewChar = useCallback(() => {
    const g = GRADIENT_PALETTE[Math.floor(Math.random() * GRADIENT_PALETTE.length)]
    const newChar: CharacterConfig = {
      id: generateId(),
      name: randomName(),
      gradient: g,
      imageDataUrl: null,
      personality: '',
      voiceId: '',
      speechStyle: '',
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
    const dataUrl = await window.electronAPI.openImageDialog(activeChar.id)
    if (dataUrl) {
      setCharacterImage(activeChar.id, dataUrl)
      setPetImagePreview(dataUrl)
      const updated = { ...activeChar, imageDataUrl: dataUrl }
      updateCharacter(updated)
      const all = characters.map((c) => (c.id === activeChar.id ? updated : c))
      persist(all, activeCharacterId)
    }
  }, [activeChar, characters, activeCharacterId, updateCharacter, setCharacterImage, persist])

  const handleClearImage = useCallback(() => {
    if (!activeChar) return
    setCharacterImage(activeChar.id, null)
    setPetImagePreview(null)
    const updated = { ...activeChar, imageDataUrl: null }
    updateCharacter(updated)
    const all = characters.map((c) => (c.id === activeChar.id ? updated : c))
    persist(all, activeCharacterId)
  }, [activeChar, characters, activeCharacterId, updateCharacter, setCharacterImage, persist])

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

  const handleSaveActions = async (updated: PetAction[]) => {
    setActions(updated)
    await window.electronAPI.savePetActions(updated)
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
              <div className="dot" style={{ background: c.gradient }} />
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
                    <label>角色头像 / 立绘</label>
                    {petImagePreview ? (
                      <div className="pet-image-preview-area">
                        <img className="pet-image-preview" src={petImagePreview} alt="桌宠形象预览" />
                        <div className="pet-image-actions">
                          <button className="pet-image-change-btn" onClick={handleUploadImage}>更换图片</button>
                          <button className="pet-image-reset-btn" onClick={handleClearImage}>使用默认形象</button>
                        </div>
                      </div>
                    ) : (
                      <button className="avatar-upload-btn" onClick={handleUploadImage}>点击上传</button>
                    )}
                    <div className="hint">支持 JPG/PNG/GIF，建议 1:1 比例</div>
                  </div>
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
                    <div className="system-prompt-preview">
                      {systemPromptPreview ? (
                        <pre>{systemPromptPreview}</pre>
                      ) : (
                        <div className="system-prompt-empty">尚未设置性格描述、说话风格或记忆。填写上方字段后这里会显示 AI 将收到的完整提示词。</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'voice' && (
                <div className="form-group">
                  <label>语音 ID</label>
                  <input type="text" placeholder="输入 TTS 语音 ID" />
                  <div className="hint">留空使用默认语音</div>
                </div>
              )}

            </>
          )}

          {nav === 'actions' && (
            <>
              <h3>动作按钮配置</h3>
              <p className="subtitle">自定义右键菜单的动作按钮</p>
              {saved && <span className="save-toast">✓ 已保存</span>}
              <ActionEditor actions={actions} onSave={handleSaveActions} />
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
              <h3>关于 AI 伴侣</h3>
              <p className="subtitle">桌面宠物 + AI 聊天伴侣</p>
              <p><strong>版本：</strong>0.1.0</p>
              <p><strong>技术栈：</strong>Electron + React + TypeScript</p>
              <p><strong>功能：</strong>桌宠互动 · AI 聊天 · 角色自定义</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

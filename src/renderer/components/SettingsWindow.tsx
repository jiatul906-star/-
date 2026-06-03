import { useEffect, useState, useCallback, useMemo } from 'react'
import type { PetAction, CharacterConfig } from '../../common/types'
import { DEFAULT_PET_ACTIONS } from '../../common/types'
import { usePetStore } from '../stores/pet-store'
import ActionEditor from './ActionEditor'
import './settings.css'

type NavKey = 'appearance' | 'actions' | 'about'

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

  const activeChar = useMemo(
    () => characters.find((c) => c.id === activeCharacterId) ?? characters[0] ?? null,
    [characters, activeCharacterId],
  )

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

  // 切换角色时更新表单
  useEffect(() => {
    if (activeChar) {
      setName(activeChar.name)
      setPetImagePreview(activeChar.imageDataUrl)
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
                <div className="form-group">
                  <label>性格描述</label>
                  <textarea placeholder="用自然语言描述角色性格，AI 会自动理解。例如：温柔体贴、偶尔毒舌、喜欢吐槽天气..." />
                </div>
              )}

              {activeTab === 'voice' && (
                <div className="form-group">
                  <label>语音 ID</label>
                  <input type="text" placeholder="输入 TTS 语音 ID" />
                  <div className="hint">留空使用默认语音</div>
                </div>
              )}

              <div className="form-group" style={{ borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: 14, marginTop: 8 }}>
                <label>AI API 地址</label>
                <input type="text" placeholder="https://api.openai.com/v1" />
                <div className="hint">支持 OpenAI 兼容接口</div>
              </div>
              <div className="form-group">
                <label>API Key</label>
                <input type="password" placeholder="sk-..." />
              </div>
              <div className="form-group">
                <label>模型</label>
                <select defaultValue="gpt-4o">
                  <option>gpt-4o</option>
                  <option>gpt-4o-mini</option>
                  <option>claude-3.5-sonnet</option>
                </select>
              </div>
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

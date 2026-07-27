import { useState, useEffect } from 'react'
import type { PetAction } from '../../common/types'
import VideoCropper from './VideoCropper'
import VideoChromaPicker from './VideoChromaPicker'

interface Props {
  actions: PetAction[]
  onSave: (actions: PetAction[]) => void
  charName?: string
}

let nextId = 100

export default function ActionEditor({ actions, onSave, charName }: Props) {
  const [list, setList] = useState<PetAction[]>(() =>
    [...actions].sort((a, b) => a.order - b.order),
  )

  // 当外部 actions 变化时（切换角色），刷新内部 list
  useEffect(() => {
    setList([...actions].sort((a, b) => a.order - b.order))
    // 同时重置编辑状态，避免上一个角色的残留表单
    setEditingId(null)
    setAddMode(false)
    setCropperVideoPath(null)
    setChromaPickerOpen(false)
    setChromaVideoPath(null)
  }, [actions])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addMode, setAddMode] = useState(false)
  const [cropperVideoPath, setCropperVideoPath] = useState<string | null>(null)
  const [chromaPickerOpen, setChromaPickerOpen] = useState(false)
  const [chromaVideoPath, setChromaVideoPath] = useState<string | null>(null)

  // 编辑中的表单
  const [form, setForm] = useState<PetAction>({
    id: '',
    label: '',
    emoji: '',
    videoPath: '',
    order: 0,
    type: 'normal',
  })

  const isSystem = (a: PetAction) => a.type === 'chat' || a.type === 'settings'

  const startEdit = (a: PetAction) => {
    setEditingId(a.id)
    setAddMode(false)
    setForm({ ...a })
  }

  const startAdd = () => {
    const newAction: PetAction = {
      id: 'custom_' + (nextId++),
      label: '新动作',
      emoji: '❓',
      videoPath: '',
      order: list.length,
      type: 'normal',
    }
    setAddMode(true)
    setEditingId(newAction.id)
    setForm(newAction)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setAddMode(false)
  }

  const saveEdit = () => {
    if (!form.label.trim()) return
    const updated = addMode
      ? [...list, { ...form, order: list.length }]
      : list.map((a) => (a.id === form.id ? { ...form } : a))

    // 重排 order
    const reordered = updated.map((a, i) => ({ ...a, order: i }))
    setList(reordered)
    onSave(reordered)
    setEditingId(null)
    setAddMode(false)
  }

  const deleteAction = (id: string) => {
    const updated = list.filter((a) => a.id !== id)
    const reordered = updated.map((a, i) => ({ ...a, order: i }))
    setList(reordered)
    onSave(reordered)
    setEditingId(null)
    setAddMode(false)
  }

  const moveUp = (idx: number) => {
    if (idx === 0) return
    const updated = [...list]
    ;[updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]]
    const reordered = updated.map((a, i) => ({ ...a, order: i }))
    setList(reordered)
    onSave(reordered)
  }

  const moveDown = (idx: number) => {
    if (idx === list.length - 1) return
    const updated = [...list]
    ;[updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]]
    const reordered = updated.map((a, i) => ({ ...a, order: i }))
    setList(reordered)
    onSave(reordered)
  }

  const handleCropperConfirm = (cx: number, cy: number, cw: number, ch: number) => {
    setForm((f) => ({ ...f, cropX: cx, cropY: cy, cropW: cw, cropH: ch }))
    setCropperVideoPath(null)
  }

  const handleClearCrop = () => {
    setForm((f) => ({ ...f, cropX: undefined, cropY: undefined, cropW: undefined, cropH: undefined }))
  }

  // 将文件名解析为完整路径（供 VideoCropper/VideoChromaPicker 使用）
  const resolveVideoPath = async (fileName: string): Promise<string | null> => {
    if (!fileName) return null
    return await window.electronAPI.getVideoPath(charName || '', fileName)
  }

  const handleOpenCropper = async () => {
    if (!form.videoPath) return
    const fullPath = await resolveVideoPath(form.videoPath)
    if (fullPath) {
      setCropperVideoPath(fullPath)
    }
  }

  const handleOpenChromaPicker = async () => {
    if (!form.videoPath) return
    const fullPath = await resolveVideoPath(form.videoPath)
    if (fullPath) {
      setChromaVideoPath(fullPath)
      setChromaPickerOpen(true)
    }
  }

  const handleBrowseVideo = async () => {
    const selectedPath = await window.electronAPI.openVideoDialog(charName || '')
    if (selectedPath) {
      setForm((f) => ({ ...f, videoPath: selectedPath }))
    }
  }

  const sorted = [...list].sort((a, b) => a.order - b.order)

  return (
    <div>
      {/* 动作列表 */}
      {sorted.map((action, idx) => {
        const editing = editingId === action.id
        const sys = isSystem(action)

        return (
          <div
            key={action.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: editing ? '12px' : '8px 12px',
              marginBottom: 6,
              background: editing ? '#fff' : 'transparent',
              borderRadius: 10,
              border: editing ? '1px solid #E0DDD8' : '1px solid transparent',
              transition: 'all 150ms',
            }}
          >
            {/* 图标 */}
            <span style={{ fontSize: 22, width: 36, textAlign: 'center', flexShrink: 0 }}>
              {action.emoji}
            </span>

            {/* 标签 & 视频路径 + 裁切/去底标记 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{action.label}</div>
              <div style={{ fontSize: 11, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sys ? '系统动作' : action.videoPath || '无视频'}
                {!sys && (action.cropX != null || action.cropY != null || action.cropW != null || action.cropH != null) && (
                  <span style={{ color: '#E8927C', marginLeft: 6 }}>✂ 已裁切</span>
                )}
                {!sys && action.chromaKey && (
                  <span style={{ color: '#7DB8A8', marginLeft: 4 }}>🎨 去底</span>
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            {!editing && (
              <>
                <button onClick={() => moveUp(idx)} disabled={idx === 0} style={btnStyle(idx === 0)} title="上移">▲</button>
                <button onClick={() => moveDown(idx)} disabled={idx === sorted.length - 1} style={btnStyle(idx === sorted.length - 1)} title="下移">▼</button>
                <button onClick={() => startEdit(action)} style={btnStyle(false)} title="编辑">✎</button>
                <button onClick={() => deleteAction(action.id)} disabled={sys} style={{ ...btnStyle(sys), color: sys ? '#ccc' : '#E8927C' }} title={sys ? '系统动作不可删除' : '删除'}>✕</button>
              </>
            )}

            {/* 编辑表单 */}
            {editing && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} style={inputStyle} placeholder="图标" maxLength={4} title="emoji 图标" />
                <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} style={{ ...inputStyle, width: 70 }} placeholder="名称" />
                <input value={form.videoPath} onChange={(e) => setForm((f) => ({ ...f, videoPath: e.target.value }))} style={{ ...inputStyle, width: 130 }} placeholder="视频路径" readOnly title={form.videoPath} />
                <button onClick={() => handleOpenCropper()} disabled={!form.videoPath} style={btnStyle(!form.videoPath)} title={form.videoPath ? '裁切画面' : '请先选择视频'}>✂</button>
                {(form.cropX != null || form.cropY != null || form.cropW != null || form.cropH != null) && (
                  <button onClick={handleClearCrop} style={{ ...btnStyle(false), color: '#E8927C' }} title="清除裁切">↺</button>
                )}
                <button onClick={handleBrowseVideo} style={btnStyle(false)} title="浏览视频">📁</button>
                <button onClick={saveEdit} style={{ ...btnStyle(false), color: '#7DB8A8', fontWeight: 600 }}>✓</button>
                <button onClick={cancelEdit} style={btnStyle(false)}>✕</button>

                {/* 色度键去底 */}
                {form.videoPath && (
                  <button onClick={handleOpenChromaPicker} style={{
                    width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd',
                    background: form.chromaKey ? '#FFE8E0' : '#F5F3F1', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 14, fontWeight: 500, marginTop: 4,
                    color: form.chromaKey ? '#E8927C' : '#999',
                  }}>
                    🎬 视频去底 {form.chromaKey ? (`${form.chromaKey}`) : ''}
                  </button>
                )}

                {/* 视频去底弹窗 */}
                {chromaPickerOpen && chromaVideoPath && (
                  <div className="crop-overlay" style={{ marginTop: 4 }}>
                    <VideoChromaPicker
                      videoPath={chromaVideoPath}
                      currentChromaKey={form.chromaKey}
                      currentTolerance={form.chromaKeyTolerance}
                      onConfirm={(color, tolerance) => {
                        setForm((f) => ({ ...f, chromaKey: color, chromaKeyTolerance: tolerance }))
                        setChromaPickerOpen(false)
                        setChromaVideoPath(null)
                      }}
                      onCancel={() => { setChromaPickerOpen(false); setChromaVideoPath(null) }}
                    />
                  </div>
                )}

                {/* 裁切弹窗 */}
                {cropperVideoPath && (
                  <div className="crop-overlay" style={{ marginTop: 8 }}>
                    <VideoCropper
                      videoPath={cropperVideoPath}
                      currentCropX={form.cropX}
                      currentCropY={form.cropY}
                      currentCropW={form.cropW}
                      currentCropH={form.cropH}
                      onConfirm={handleCropperConfirm}
                      onCancel={() => setCropperVideoPath(null)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* 添加按钮 */}
      {!addMode && editingId === null && (
        <button onClick={startAdd} style={{ width: '100%', padding: '10px', border: '2px dashed #ddd', borderRadius: 10, background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#999', fontFamily: 'inherit', marginTop: 8 }}>＋ 添加新动作</button>
      )}

      {/* 新增模式下的编辑行 */}
      {addMode && (
        <div style={{ marginTop: 8, padding: 12, background: '#fff', borderRadius: 10, border: '1px solid #E0DDD8' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} style={inputStyle} placeholder="图标" maxLength={4} />
            <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} style={{ ...inputStyle, width: 80 }} placeholder="名称" />
            <input value={form.videoPath} onChange={(e) => setForm((f) => ({ ...f, videoPath: e.target.value }))} style={{ ...inputStyle, width: 160 }} placeholder="视频路径（留空 = emoji 反馈）" readOnly title={form.videoPath} />
            <button onClick={() => handleOpenCropper()} disabled={!form.videoPath} style={btnStyle(!form.videoPath)} title="裁切画面">✂</button>
            <button onClick={handleBrowseVideo} style={btnStyle(false)}>📁</button>
            <button onClick={saveEdit} style={{ ...btnStyle(false), color: '#7DB8A8', fontWeight: 600 }}>✓ 添加</button>
            <button onClick={cancelEdit} style={btnStyle(false)}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: 44,
  padding: '6px 8px',
  border: '1px solid #ddd',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  background: '#FBF9F7',
}

const btnStyle = (disabled: boolean): React.CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  cursor: disabled ? 'default' : 'pointer',
  fontSize: 13,
  color: disabled ? '#ccc' : '#888',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontFamily: 'inherit',
})

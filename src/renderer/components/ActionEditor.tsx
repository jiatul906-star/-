import { useState } from 'react'
import type { PetAction } from '../../common/types'

interface Props {
  actions: PetAction[]
  onSave: (actions: PetAction[]) => void
}

let nextId = 100

export default function ActionEditor({ actions, onSave }: Props) {
  const [list, setList] = useState<PetAction[]>(() =>
    [...actions].sort((a, b) => a.order - b.order),
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addMode, setAddMode] = useState(false)

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
      id: `custom_${nextId++}`,
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

  const handleBrowseVideo = async () => {
    const path = await window.electronAPI.openVideoDialog()
    if (path) {
      setForm((f) => ({ ...f, videoPath: path }))
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

            {/* 标签 & 视频路径 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{action.label}</div>
              <div style={{ fontSize: 11, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sys ? '系统动作' : action.videoPath || '无视频'}
              </div>
            </div>

            {/* 操作按钮 */}
            {!editing && (
              <>
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  style={btnStyle(idx === 0)}
                  title="上移"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === sorted.length - 1}
                  style={btnStyle(idx === sorted.length - 1)}
                  title="下移"
                >
                  ▼
                </button>
                <button onClick={() => startEdit(action)} style={btnStyle(false)} title="编辑">
                  ✎
                </button>
                <button
                  onClick={() => deleteAction(action.id)}
                  disabled={sys}
                  style={{
                    ...btnStyle(sys),
                    color: sys ? '#ccc' : '#E8927C',
                  }}
                  title={sys ? '系统动作不可删除' : '删除'}
                >
                  ✕
                </button>
              </>
            )}

            {/* 编辑表单 */}
            {editing && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={form.emoji}
                  onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                  style={inputStyle}
                  placeholder="图标"
                  maxLength={4}
                  title="emoji 图标"
                />
                <input
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  style={{ ...inputStyle, width: 70 }}
                  placeholder="名称"
                />
                <input
                  value={form.videoPath}
                  onChange={(e) => setForm((f) => ({ ...f, videoPath: e.target.value }))}
                  style={{ ...inputStyle, width: 130 }}
                  placeholder="视频路径"
                  readOnly
                  title={form.videoPath}
                />
                <button onClick={handleBrowseVideo} style={btnStyle(false)} title="浏览视频">
                  📁
                </button>
                <button
                  onClick={saveEdit}
                  style={{ ...btnStyle(false), color: '#7DB8A8', fontWeight: 600 }}
                >
                  ✓
                </button>
                <button onClick={cancelEdit} style={btnStyle(false)}>
                  ✕
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* 添加按钮 */}
      {!addMode && editingId === null && (
        <button
          onClick={startAdd}
          style={{
            width: '100%',
            padding: '10px',
            border: '2px dashed #ddd',
            borderRadius: 10,
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 13,
            color: '#999',
            fontFamily: 'inherit',
            marginTop: 8,
          }}
        >
          ＋ 添加新动作
        </button>
      )}

      {/* 新增模式下的空编辑行 */}
      {addMode && (
        <div style={{ marginTop: 8, padding: 12, background: '#fff', borderRadius: 10, border: '1px solid #E0DDD8' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              style={inputStyle}
              placeholder="图标"
              maxLength={4}
            />
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              style={{ ...inputStyle, width: 80 }}
              placeholder="名称"
            />
            <input
              value={form.videoPath}
              onChange={(e) => setForm((f) => ({ ...f, videoPath: e.target.value }))}
              style={{ ...inputStyle, width: 160 }}
              placeholder="视频路径（留空 = emoji 反馈）"
              readOnly
              title={form.videoPath}
            />
            <button onClick={handleBrowseVideo} style={btnStyle(false)}>
              📁
            </button>
            <button onClick={saveEdit} style={{ ...btnStyle(false), color: '#7DB8A8', fontWeight: 600 }}>
              ✓ 添加
            </button>
            <button onClick={cancelEdit} style={btnStyle(false)}>
              取消
            </button>
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

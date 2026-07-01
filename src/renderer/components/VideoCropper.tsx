import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  videoPath: string
  currentCropX?: number
  currentCropY?: number
  currentCropW?: number
  currentCropH?: number
  onConfirm: (cropX: number, cropY: number, cropW: number, cropH: number) => void
  onCancel: () => void
}

type HandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
const MIN_SIZE = 5

export default function VideoCropper({ videoPath, currentCropX, currentCropY, currentCropW, currentCropH, onConfirm, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [vidW, setVidW] = useState(0)
  const [vidH, setVidH] = useState(0)
  const [err, setErr] = useState(false)
  const cropRef = useRef({ x: currentCropX ?? 0, y: currentCropY ?? 0, w: currentCropW ?? 100, h: currentCropH ?? 100 })
  const [crop, setCrop] = useState({ x: currentCropX ?? 0, y: currentCropY ?? 0, w: currentCropW ?? 100, h: currentCropH ?? 100 })
  const [dragging, setDragging] = useState<'move' | HandleDir | null>(null)
  const dragRef = useRef({ startX: 0, startY: 0, startCrop: { x: 0, y: 0, w: 0, h: 0 } })

  const src = 'file:///' + videoPath.replace(/\\/g, '/')

  const onMeta = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    setVidW(v.videoWidth)
    setVidH(v.videoHeight)
    setLoaded(true)
  }, [])

  // mouse handlers for drag-resize
  const handleDown = useCallback((e: React.MouseEvent, mode: 'move' | HandleDir) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(mode)
    dragRef.current = { startX: e.clientX, startY: e.clientY, startCrop: { ...crop } }
  }, [crop])

  useEffect(() => {
    if (!dragging) return
    const getConDims = () => {
      const c = containerRef.current
      if (!c) return { cw: 1, ch: 1 }
      return { cw: c.clientWidth, ch: c.clientHeight }
    }
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      const { cw, ch } = getConDims()
      const dx = ((e.clientX - d.startX) / cw) * 100
      const dy = ((e.clientY - d.startY) / ch) * 100

      setCrop((prev) => {
        let { x, y, w, h } = d.startCrop

        if (dragging === 'move') {
          x = Math.max(0, Math.min(100 - w, d.startCrop.x + dx))
          y = Math.max(0, Math.min(100 - h, d.startCrop.y + dy))
        } else {
          if (dragging.includes('e')) w = Math.max(MIN_SIZE, Math.min(100 - x, d.startCrop.w + dx))
          if (dragging.includes('w')) {
            const maxR = d.startCrop.x + d.startCrop.w
            const nw = Math.max(MIN_SIZE, Math.min(maxR, d.startCrop.w - dx))
            x = maxR - nw; w = nw
          }
          if (dragging.includes('s')) h = Math.max(MIN_SIZE, Math.min(100 - y, d.startCrop.h + dy))
          if (dragging.includes('n')) {
            const maxB = d.startCrop.y + d.startCrop.h
            const nh = Math.max(MIN_SIZE, Math.min(maxB, d.startCrop.h - dy))
            y = maxB - nh; h = nh
          }
        }
        return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 }
      })
    }
    const onUp = () => setDragging(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging])

  const handleDir = (dir: HandleDir) => (e: React.MouseEvent) => handleDown(e, dir)

  if (err) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>视频加载失败</div>
  }

  return (
    <div className="crop-overlay">
      <div style={{ maxWidth: 520, width: '100%' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>✂ 裁切视频画面</h3>
        <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
          拖拽选择要显示的画面区域（百分比），完成后点击确认
        </p>

        <div ref={containerRef} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#000', maxHeight: 300 }}>
          <video
            ref={videoRef}
            src={src}
            style={{ width: '100%', display: 'block', maxHeight: 300 }}
            onLoadedMetadata={onMeta}
            onError={() => setErr(true)}
            autoPlay muted loop
          />
          {loaded && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.3)',
              pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute',
                left: crop.x + '%', top: crop.y + '%',
                width: crop.w + '%', height: crop.h + '%',
                background: 'transparent',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                border: '2px solid #fff',
                pointerEvents: 'auto',
                cursor: dragging === 'move' ? 'grabbing' : 'grab',
              }}
                onMouseDown={(e) => handleDown(e, 'move')}
              >
                {/* grid */}
                <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 33%, rgba(255,255,255,0.15) 33%, rgba(255,255,255,0.15) 34%), repeating-linear-gradient(90deg, transparent, transparent 33%, rgba(255,255,255,0.15) 33%, rgba(255,255,255,0.15) 34%)', pointerEvents: 'none' }} />
                {/* handles */}
                {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as HandleDir[]).map((d) => (
                  <div key={d} className={'crop-handle crop-handle-' + d} onMouseDown={handleDir(d)} style={{ pointerEvents: 'auto', position: 'absolute', width: 14, height: 14, border: '2px solid #fff', borderRadius: 3, background: '#E8927C', zIndex: 2, cursor: d.length === 1 ? (d === 'n' || d === 's' ? 'ns-resize' : 'ew-resize') : (d === 'nw' || d === 'se' ? 'nwse-resize' : 'nesw-resize'), ...((() => { switch (d) { case 'nw': return { top: -7, left: -7 }; case 'n': return { top: -7, left: '50%', marginLeft: -7 }; case 'ne': return { top: -7, right: -7 }; case 'e': return { top: '50%', right: -7, marginTop: -7 }; case 'se': return { bottom: -7, right: -7 }; case 's': return { bottom: -7, left: '50%', marginLeft: -7 }; case 'sw': return { bottom: -7, left: -7 }; case 'w': return { top: '50%', left: -7, marginTop: -7 }; } })()) }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {loaded && (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 12, color: '#666', marginTop: 8, marginBottom: 8 }}>
            <span>X: {crop.x}%</span>
            <span>Y: {crop.y}%</span>
            <span>W: {crop.w}%</span>
            <span>H: {crop.h}%</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #E0DDD8', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#666' }}>取消</button>
          <button onClick={() => onConfirm(crop.x, crop.y, crop.w, crop.h)} style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: '#E8927C', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>✓ 确认裁切</button>
        </div>
      </div>
    </div>
  )
}

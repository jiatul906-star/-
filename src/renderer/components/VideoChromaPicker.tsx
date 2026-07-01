import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  videoPath: string
  currentChromaKey?: string
  currentTolerance?: number
  onConfirm: (color: string, tolerance: number) => void
  onCancel: () => void
}

function chromaKeyFilter(data: Uint8ClampedArray, keyColor: string, tolerance: number) {
  const hex = keyColor.replace('#', '')
  if (hex.length < 6) return
  const kr = parseInt(hex.slice(0, 2), 16)
  const kg = parseInt(hex.slice(2, 4), 16)
  const kb = parseInt(hex.slice(4, 6), 16)
  const t = tolerance / 255.0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const dr = (r - kr) / 255, dg = (g - kg) / 255, db = (b - kb) / 255
    if (Math.sqrt(dr * dr + dg * dg + db * db) <= t) data[i + 3] = 0
  }
}

export default function VideoChromaPicker({ videoPath, currentChromaKey, currentTolerance = 100, onConfirm, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fullFrameRef = useRef<HTMLCanvasElement>(null)
  const displayRef = useRef<HTMLCanvasElement>(null)    // 取色画布：始终显示原始帧
  const resultRef = useRef<HTMLCanvasElement>(null)     // 预览画布：显示处理结果
  const [captured, setCaptured] = useState(false)
  const [tolerance, setTolerance] = useState(currentTolerance)
  const [keyColor, setKeyColor] = useState(currentChromaKey || '#00FF00')
  const [sampledColor, setSampledColor] = useState(currentChromaKey || null)


  const src = 'file:///' + videoPath.replace(/\\/g, '/')

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const fc = fullFrameRef.current
    const dc = displayRef.current
    const rc = resultRef.current
    if (!video || !fc || !dc || !rc) return

    fc.width = video.videoWidth
    fc.height = video.videoHeight
    if (fc.width === 0 || fc.height === 0) return
    const fctx = fc.getContext('2d')
    if (!fctx) return
    fctx.drawImage(video, 0, 0)

    const maxW = 360, maxH = 240
    let w = fc.width, h = fc.height
    if (w > maxW) { h = h * maxW / w; w = maxW }
    if (h > maxH) { w = w * maxH / h; h = maxH }
    dc.width = w; dc.height = h
    const dctx = dc.getContext('2d')
    if (!dctx) return
    dctx.drawImage(fc, 0, 0, w, h)
    // Show original on resultRef
    rc.width = fc.width
    rc.height = fc.height
    const rctx = rc.getContext('2d')
    if (rctx) rctx.drawImage(fc, 0, 0)
    setCaptured(true)

  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = displayRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = Math.floor((e.clientX - rect.left) * scaleX)
    const y = Math.floor((e.clientY - rect.top) * scaleY)
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pixel = ctx.getImageData(x, y, 1, 1).data
    const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('')
    setSampledColor(hex)
  }, [])

  const handleCanvasClick = useCallback(() => {
    if (sampledColor) setKeyColor(sampledColor)
  }, [sampledColor])

  /** 从 fullFrameRef 读取原始帧，处理后绘到 resultRef */
  const processPreview = useCallback(() => {
    const fc = fullFrameRef.current
    const rc = resultRef.current
    if (!fc || !rc || fc.width === 0) return

    rc.width = fc.width
    rc.height = fc.height
    const rctx = rc.getContext('2d')
    if (!rctx) return
    rctx.drawImage(fc, 0, 0)                      // copy original
    const imageData = rctx.getImageData(0, 0, rc.width, rc.height)
    chromaKeyFilter(imageData.data, keyColor, tolerance)  // filter
    rctx.putImageData(imageData, 0, 0)             // save
  }, [keyColor, tolerance])

  // 自动处理
  useEffect(() => {
    if (captured) processPreview()
  }, [keyColor, tolerance, captured])

  return (
    <div className="crop-overlay">
      <div style={{ maxWidth: 520, width: '100%' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600 }}>🎨 视频去底</h3>
        <p style={{ fontSize: 12, color: '#999', margin: '0 0 10px' }}>播放 → 📸 取帧 → 点击画面取色 → 调整容差 → 预览效果 → 应用</p>

        <div style={{ borderRadius: 10, overflow: 'hidden', background: '#000', marginBottom: 8 }}>
          <video ref={videoRef} src={src} style={{ width: '100%', display: 'block', maxHeight: 180 }} autoPlay muted loop controls />
        </div>

        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <button onClick={captureFrame} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #E0DDD8', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500 }}>📸 取帧</button>
        </div>

        {/* 取色画布：原始帧 */}
        <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 6, cursor: 'crosshair', background: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 16px 16px', textAlign: 'center', display: captured ? 'block' : 'none' }}>
          <canvas ref={displayRef} onClick={handleCanvasClick} onMouseMove={handleMouseMove} style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }} />
        </div>

        {/* 取色 + 容差 + 预览 */}
        <div style={{ display: captured ? 'flex' : 'none', gap: 12, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#666' }}>取色:</span>
            <div style={{ width: 24, height: 24, borderRadius: 4, background: keyColor, border: '1px solid #ddd', flexShrink: 0 }} />
            <input type="text" value={keyColor} onChange={(e) => { setKeyColor(e.target.value) }} style={{ width: 72, padding: '4px 6px', border: '1px solid #ddd', borderRadius: 4, fontFamily: 'monospace', fontSize: 11 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#666' }}>容差:</span>
            <input type="range" min={0} max={255} value={tolerance} onChange={(e) => { setTolerance(parseInt(e.target.value)) }} style={{ width: 80, accentColor: '#E8927C' }} />
            <span style={{ fontSize: 11, color: '#999', minWidth: 20 }}>{tolerance}</span>

          </div>
        </div>

        {/* 预览画布：处理后的结果（始终在 DOM） */}
        <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 6, background: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 16px 16px', textAlign: 'center', display: captured ? 'block' : 'none' }}>
          <canvas ref={resultRef} style={{ maxWidth: '100%', maxHeight: 200, display: 'block', margin: '0 auto' }} />
        </div>

        <canvas ref={fullFrameRef} style={{ display: 'none' }} />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #E0DDD8', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#666' }}>取消</button>
          <button onClick={() => onConfirm(keyColor, tolerance)} disabled={!captured} style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: captured ? '#E8927C' : '#ddd', color: '#fff', cursor: captured ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>✓ 应用去底</button>
        </div>
      </div>
    </div>
  )
}

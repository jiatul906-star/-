import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  imageUrl: string
  onConfirm: (resultDataUrl: string) => void
  onCancel: () => void
}

export default function BackgroundRemover({ imageUrl, onConfirm, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgNaturalW, setImgNaturalW] = useState(0)
  const [imgNaturalH, setImgNaturalH] = useState(0)
  const [tolerance, setTolerance] = useState(100)
  const [keyColor, setKeyColor] = useState('#00FF00')
  const [mouseX, setMouseX] = useState(-1)
  const [mouseY, setMouseY] = useState(-1)
  const [sampledColor, setSampledColor] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const hasProcessedRef = useRef(false)

  const onImgLoad = useCallback(() => {
    const img = imgRef.current
    if (!img) return
    setImgNaturalW(img.naturalWidth)
    setImgNaturalH(img.naturalHeight)
    setImgLoaded(true)
  }, [])

  // 鼠标在图片上移动时取色
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width))
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height))
    setMouseX(x)
    setMouseY(y)

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pixel = ctx.getImageData(x, y, 1, 1).data
    const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('')
    setSampledColor(hex)
  }, [])

  // 点击取色
  const handleCanvasClick = useCallback(() => {
    if (sampledColor) setKeyColor(sampledColor)
  }, [sampledColor])

  // 处理：在图片的 canvas 上执行色度键
  const processImage = useCallback(() => {
    if (!imgRef.current || !imgLoaded) return
    const img = imgRef.current
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // 解析 keyColor
    const hex = keyColor.replace('#', '')
    const kr = parseInt(hex.slice(0, 2), 16)
    const kg = parseInt(hex.slice(2, 4), 16)
    const kb = parseInt(hex.slice(4, 6), 16)

    const t = tolerance / 255.0

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const dr = (r - kr) / 255
      const dg = (g - kg) / 255
      const db = (b - kb) / 255
      const dist = Math.sqrt(dr * dr + dg * dg + db * db)

      if (dist <= t) {
        data[i + 3] = 0
      }
    }

    ctx.putImageData(imageData, 0, 0)

    // 写入结果 canvas
    const resultCanvas = resultCanvasRef.current
    if (resultCanvas) {
      resultCanvas.width = canvas.width
      resultCanvas.height = canvas.height
      const rctx = resultCanvas.getContext('2d')
      if (rctx) {
        rctx.putImageData(imageData, 0, 0)
      }
    }
    setShowPreview(true)
  }, [keyColor, tolerance, imgLoaded])

  // 自动处理（图片加载后才生效）
  useEffect(() => {
    if (!imgLoaded) return
    processImage()
  }, [keyColor, tolerance, imgLoaded, processImage])

  // 绘制预览 canvas（源图 + 取色十字线）
  useEffect(() => {
    if (!imgLoaded || !imgRef.current || !previewCanvasRef.current) return
    const canvas = previewCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const maxW = 400, maxH = 300
    let w = imgNaturalW, h = imgNaturalH
    if (w > maxW) { h = h * maxW / w; w = maxW }
    if (h > maxH) { w = w * maxH / h; h = maxH }
    canvas.width = w
    canvas.height = h

    ctx.drawImage(imgRef.current, 0, 0, w, h)

    // 十字线
    if (mouseX >= 0 && mouseY >= 0 && sampledColor) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(mouseX, 0); ctx.lineTo(mouseX, h)
      ctx.moveTo(0, mouseY); ctx.lineTo(w, mouseY)
      ctx.stroke()
      ctx.setLineDash([])

      // 色值标签
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillRect(mouseX + 8, mouseY - 24, 80, 20)
      ctx.fillStyle = sampledColor
      ctx.fillRect(mouseX + 10, mouseY - 22, 12, 16)
      ctx.fillStyle = '#fff'
      ctx.font = '11px sans-serif'
      ctx.fillText(sampledColor, mouseX + 26, mouseY - 10)
    }
  }, [imgLoaded, imgNaturalW, imgNaturalH, mouseX, sampledColor])

  return (
    <div className="crop-overlay">
      <div style={{ maxWidth: 500, width: '100%' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>🎨 移除背景</h3>
        <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
          点击图片取色，工具会移除与该颜色相似的所有像素
        </p>

        {/* 预览 canvas */}
        <div style={{
          borderRadius: 10, overflow: 'hidden', marginBottom: 12,
          background: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 16px 16px',
          textAlign: 'center',
        }}>
          <img
            ref={imgRef}
            src={imageUrl}
            onLoad={onImgLoad}
            style={{ display: 'none' }}
          />
          {imgLoaded && (
            <canvas
              ref={previewCanvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              style={{ cursor: 'crosshair', display: 'block', margin: '0 auto' }}
            />
          )}
        </div>

        {/* 取色信息 */}
        <div style={{ fontSize: 12, color: '#666', marginBottom: 12, textAlign: 'center' }}>
          {sampledColor
            ? `取色: ${sampledColor} 点击选择此颜色作为去除目标`
            : '鼠标悬停在背景色上取色'}
        </div>

        {/* 色值输入 + 容差 */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 2 }}>目标颜色</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, border: '1px solid #ddd',
                background: keyColor, flexShrink: 0,
              }} />
              <input
                type="text"
                value={keyColor}
                onChange={(e) => setKeyColor(e.target.value)}
                style={{
                  flex: 1, padding: '5px 8px', border: '1px solid #ddd', borderRadius: 6,
                  fontFamily: 'monospace', fontSize: 12,
                }}
                placeholder="#00FF00"
              />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: '#999', display: 'block', marginBottom: 2 }}>
              容差: {tolerance}
            </label>
            <input
              type="range"
              min={0}
              max={255}
              value={tolerance}
              onChange={(e) => setTolerance(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#E8927C' }}
            />
          </div>
        </div>

        {/* 手动刷新 */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={processImage} style={{
            padding: '6px 16px', borderRadius: 6, border: 'none',
            background: '#E8927C', color: '#fff', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12,
          }}>
            🔍 预览去底效果
          </button>
        </div>

        {/* 处理后预览 */}
        {true && (
          <div style={{
            borderRadius: 10, overflow: 'hidden', marginBottom: 12,
            background: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 16px 16px',
            textAlign: 'center',
          }}>
            <canvas
              ref={resultCanvasRef}
              style={{ maxWidth: '100%', maxHeight: 240, display: 'block', margin: '0 auto' }}
            />
          </div>
        )}


        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 20px', borderRadius: 8, border: '1px solid #E0DDD8',
            background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#666',
          }}>
            取消
          </button>
          <button
            onClick={() => {
              const rc = resultCanvasRef.current
              if (rc) onConfirm(rc.toDataURL('image/png'))
            }}
            disabled={!imgLoaded}
            style={{
              padding: '8px 24px', borderRadius: 8, border: 'none',
              background: imgLoaded ? '#E8927C' : '#ddd', color: '#fff',
              cursor: imgLoaded ? 'pointer' : 'default',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            }}
          >
            ✓ 应用去底
          </button>
        </div>
      </div>
    </div>
  )
}

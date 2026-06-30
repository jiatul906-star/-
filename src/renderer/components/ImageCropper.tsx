import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  imageUrl: string
  onCrop: (croppedDataUrl: string) => void
  onCancel: () => void
}

type HandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const MIN_CROP_SIZE = 50

export default function ImageCropper({ imageUrl, onCrop, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgW, setImgW] = useState(0)
  const [imgH, setImgH] = useState(0)

  // 裁切区域（像素坐标，相对于图片显示区域）
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 200, height: 200 })
  const [dragging, setDragging] = useState<'move' | HandleDir | null>(null)
  const dragRef = useRef({ startX: 0, startY: 0, startCrop: { x: 0, y: 0, width: 0, height: 0 }, startDims: { rw: 0, rh: 0, ox: 0, oy: 0 } })

  const getRenderDims = useCallback((img) => {
    const cw = img.clientWidth, ch = img.clientHeight
    const imgAspect = img.naturalWidth / img.naturalHeight
    const boxAspect = cw / ch
    let rw, rh, ox, oy
    if (boxAspect > imgAspect) {
      rh = ch; rw = rh * imgAspect; ox = (cw - rw) / 2; oy = 0
    } else {
      rw = cw; rh = rw / imgAspect; ox = 0; oy = (ch - rh) / 2
    }
    return { rw, rh, ox, oy }
  }, [])

  const onImgLoad = useCallback(() => {
    const img = imgRef.current
    if (!img) return
    setImgW(img.clientWidth)
    setImgH(img.clientHeight)
    const { rw, rh } = getRenderDims(img)
    const cw = rw * 0.8
    const ch = rh * 0.8
    const { ox, oy } = getRenderDims(img)
    setCrop({
      x: ox + (rw - cw) / 2,
      y: oy + (rh - ch) / 2,
      width: cw,
      height: ch,
    })
    setImgLoaded(true)
  }, [getRenderDims])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, mode: 'move' | HandleDir) => {
      e.preventDefault()
      e.stopPropagation()
      setDragging(mode)
      const img = imgRef.current
      const dims = img ? getRenderDims(img) : { rw: imgW, rh: imgH, ox: 0, oy: 0 }
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startCrop: { ...crop },
        startDims: dims,
      }
    },
    [crop, imgW, imgH, getRenderDims],
  )

  useEffect(() => {
    if (!dragging) return

    const getDims = () => {
      const img = imgRef.current
      if (!img) return { rw: imgW, rh: imgH, ox: 0, oy: 0 }
      const cw = img.clientWidth, ch = img.clientHeight
      const imgAspect = img.naturalWidth / img.naturalHeight
      const boxAspect = cw / ch
      let rw, rh, ox, oy
      if (boxAspect > imgAspect) {
        rh = ch; rw = rh * imgAspect; ox = (cw - rw) / 2; oy = 0
      } else {
        rw = cw; rh = rw / imgAspect; ox = 0; oy = (ch - rh) / 2
      }
      return { rw, rh, ox, oy }
    }

    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      const { ox, oy, rw, rh } = d.startDims
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY

      setCrop((prev) => {
        let { x, y, width, height } = d.startCrop

        if (dragging === 'move') {
          x = Math.max(ox, Math.min(ox + rw - width, d.startCrop.x + dx))
          y = Math.max(oy, Math.min(oy + rh - height, d.startCrop.y + dy))
        } else {
          if (dragging.includes('e')) {
            width = Math.max(MIN_CROP_SIZE, Math.min(ox + rw - x, d.startCrop.width + dx))
          }
          if (dragging.includes('w')) {
            const maxW = d.startCrop.x + d.startCrop.width
            const newW = Math.max(MIN_CROP_SIZE, Math.min(maxW, d.startCrop.width - dx))
            x = maxW - newW
            width = newW
          }
          if (dragging.includes('s')) {
            height = Math.max(MIN_CROP_SIZE, Math.min(oy + rh - y, d.startCrop.height + dy))
          }
          if (dragging.includes('n')) {
            const maxH = d.startCrop.y + d.startCrop.height
            const newH = Math.max(MIN_CROP_SIZE, Math.min(maxH, d.startCrop.height - dy))
            y = maxH - newH
            height = newH
          }
        }

        return { x, y, width, height }
      })
    }

    const onUp = () => setDragging(null)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, imgW, imgH])

  const handleConfirm = useCallback(() => {
    const img = imgRef.current
    if (!img) return
    const cw = img.clientWidth, ch = img.clientHeight
    const imgAspect = img.naturalWidth / img.naturalHeight
    const boxAspect = cw / ch
    let rw, rh, ox, oy
    if (boxAspect > imgAspect) {
      rh = ch; rw = rh * imgAspect; ox = (cw - rw) / 2; oy = 0
    } else {
      rw = cw; rh = rw / imgAspect; ox = 0; oy = (ch - rh) / 2
    }
    const scaleX = img.naturalWidth / rw
    const scaleY = img.naturalHeight / rh
    const sx = (crop.x - ox) * scaleX
    const sy = (crop.y - oy) * scaleY
    const sw = crop.width * scaleX
    const sh = crop.height * scaleY

    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
    onCrop(canvas.toDataURL('image/png'))
  }, [crop, onCrop])

  const handleDir = (dir: HandleDir) => (e: React.MouseEvent) => {
    e.stopPropagation()
    handleMouseDown(e, dir)
  }

  return (
    <div className="crop-overlay">
      <div className="crop-container" ref={containerRef}>
        <img
          ref={imgRef}
          src={imageUrl}
          alt="裁切预览"
          onLoad={onImgLoad}
          className="crop-image"
          draggable={false}
        />
        {imgLoaded && (
          <div
            className="crop-rect"
            style={{
              left: crop.x,
              top: crop.y,
              width: crop.width,
              height: crop.height,
            }}
            onMouseDown={(e) => handleMouseDown(e, 'move')}
          >
            <div className="crop-grid" />
            {/* 4 corners */}
            <div className="crop-handle crop-handle-nw" onMouseDown={handleDir('nw')} />
            <div className="crop-handle crop-handle-ne" onMouseDown={handleDir('ne')} />
            <div className="crop-handle crop-handle-sw" onMouseDown={handleDir('sw')} />
            <div className="crop-handle crop-handle-se" onMouseDown={handleDir('se')} />
            {/* 4 edges */}
            <div className="crop-handle crop-handle-n" onMouseDown={handleDir('n')} />
            <div className="crop-handle crop-handle-s" onMouseDown={handleDir('s')} />
            <div className="crop-handle crop-handle-w" onMouseDown={handleDir('w')} />
            <div className="crop-handle crop-handle-e" onMouseDown={handleDir('e')} />
          </div>
        )}
      </div>
      <div className="crop-actions">
        <button className="crop-btn" onClick={onCancel}>取消</button>
        <button className="crop-btn primary" onClick={handleConfirm}>确认裁剪</button>
      </div>
    </div>
  )
}

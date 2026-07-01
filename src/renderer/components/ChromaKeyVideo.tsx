import { useRef, useEffect, useCallback, useState } from 'react'

interface Props {
  videoPath: string
  chromaKey?: string
  tolerance?: number
  cropX?: number
  cropY?: number
  cropW?: number
  cropH?: number
  trimStart?: number
  trimEnd?: number
  onEnded: () => void
  onError: () => void
  className?: string
  style?: React.CSSProperties
}

function parseColor(color: string): [number, number, number] {
  const s = color.trim().toLowerCase()
  if (s.startsWith('#')) {
    const hex = s.slice(1)
    if (hex.length === 3) return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)]
    if (hex.length === 6) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
    return [0, 255, 0]
  }
  const rm = s.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
  if (rm) return [parseInt(rm[1]), parseInt(rm[2]), parseInt(rm[3])]
  const ram = s.match(/^rgba\((\d+),\s*(\d+),\s*(\d+)/)
  if (ram) return [parseInt(ram[1]), parseInt(ram[2]), parseInt(ram[3])]
  return [0, 255, 0]
}

export default function ChromaKeyVideo({
  videoPath, chromaKey, tolerance = 100, cropX, cropY, cropW, cropH,
  trimStart, trimEnd, onEnded, onError, className, style,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const keyColorRef = useRef<[number, number, number]>([0, 255, 0])
  const hasChroma = typeof chromaKey === 'string' && chromaKey.length > 0
  const hasCrop = cropX != null || cropY != null || cropW != null || cropH != null

  useEffect(() => {
    if (hasChroma) {
      try { keyColorRef.current = parseColor(chromaKey!) } catch { keyColorRef.current = [0, 255, 0] }
    }
  }, [chromaKey, hasChroma])

  const renderFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.paused || video.ended) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const vw = video.videoWidth, vh = video.videoHeight
    if (vw === 0 || vh === 0) { animRef.current = requestAnimationFrame(renderFrame); return }

    // 计算裁切源坐标（百分比→像素）
    const sx = ((cropX ?? 0) / 100) * vw
    const sy = ((cropY ?? 0) / 100) * vh
    const sw = ((cropW ?? 100) / 100) * vw
    const sh = ((cropH ?? 100) / 100) * vh

    // 让 canvas internal 尺寸匹配 CSS 显示尺寸
    const displayW = canvas.clientWidth
    const displayH = canvas.clientHeight
    if (canvas.width !== displayW || canvas.height !== displayH) {
      canvas.width = displayW
      canvas.height = displayH
    }

    // 用 contain 逻辑绘制裁切内容：完整显示、保持比例、居中
    const cropAspect = sw / sh
    const canvasAspect = displayW / displayH

    let dx, dy, dw, dh
    if (cropAspect > canvasAspect) {
      dw = displayW
      dh = displayW / cropAspect
      dx = 0
      dy = (displayH - dh) / 2
    } else {
      dh = displayH
      dw = displayH * cropAspect
      dx = (displayW - dw) / 2
      dy = 0
    }

    ctx.clearRect(0, 0, displayW, displayH)
    ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh)

    // 色度键去底
    if (hasChroma) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      const [kr, kg, kb] = keyColorRef.current
      const t = (tolerance ?? 100) / 255.0
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const dr = (r - kr) / 255, dg = (g - kg) / 255, db = (b - kb) / 255
        if (Math.sqrt(dr * dr + dg * dg + db * db) <= t) data[i + 3] = 0
      }
      ctx.putImageData(imageData, 0, 0)
    }

    animRef.current = requestAnimationFrame(renderFrame)
  }, [cropX, cropY, cropW, cropH, hasChroma, hasCrop, chromaKey, tolerance])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const src = 'file:///' + videoPath.replace(/\\/g, '/')
    video.src = src
    video.load()

    const onLoad = () => {
      if (trimStart != null) video.currentTime = trimStart
      video.play().catch(() => onError())
      animRef.current = requestAnimationFrame(renderFrame)
    }

    const onTimeUpdate = () => {
      if (trimEnd != null && video.currentTime >= trimEnd) { video.pause(); onEnded() }
    }

    const onVideoEnd = () => onEnded()
    video.addEventListener('loadedmetadata', onLoad)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('ended', onVideoEnd)
    video.addEventListener('error', () => onError())

    return () => {
      video.removeEventListener('loadedmetadata', onLoad)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('ended', onVideoEnd)
      cancelAnimationFrame(animRef.current)
      video.pause()
      video.src = ''
    }
  }, [videoPath, trimStart, trimEnd, renderFrame, onEnded, onError])

  return (
    <>
      <video ref={videoRef} style={{ display: 'none' }} muted playsInline />
      <canvas ref={canvasRef} className={className} style={{ ...style, width: style?.width || '100%', height: style?.height || '100%' }} />
    </>
  )
}

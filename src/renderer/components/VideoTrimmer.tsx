import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  videoPath: string
  currentStart?: number
  currentEnd?: number
  onConfirm: (start: number, end: number) => void
  onCancel: () => void
}

export default function VideoTrimmer({ videoPath, currentStart, currentEnd, onConfirm, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)
  const [startTime, setStartTime] = useState(currentStart ?? 0)
  const [endTime, setEndTime] = useState(currentEnd ?? 0)
  const [previewing, setPreviewing] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [videoSrc, setVideoSrc] = useState('')

  useEffect(() => {
    if (videoPath) {
      setVideoSrc('file:///' + videoPath.replace(/\\/g, '/'))
    }
  }, [videoPath])

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const dur = v.duration
    setDuration(dur)
    if (!currentEnd || currentEnd === 0) setEndTime(dur)
  }, [currentEnd])

  const handleTrim = useCallback(() => {
    if (startTime >= endTime) return
    onConfirm(startTime, endTime)
  }, [startTime, endTime, onConfirm])

  const togglePreview = useCallback(() => {
    if (!previewing) {
      setPreviewing(true)
      setTimeout(() => {
        const pv = previewRef.current
        if (pv) {
          pv.currentTime = startTime
          pv.play().catch(() => {})
        }
      }, 100)
    } else {
      setPreviewing(false)
      const pv = previewRef.current
      if (pv) pv.pause()
    }
  }, [previewing, startTime])

  // Auto-stop preview at endTime
  const handlePreviewTimeUpdate = useCallback(() => {
    const pv = previewRef.current
    if (pv && pv.currentTime >= endTime) {
      pv.pause()
      pv.currentTime = startTime
    }
  }, [endTime, startTime])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `0:${String(sec).padStart(2, '0')}`
  }

  if (videoError) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
        <p style={{ fontSize: 32, margin: '0 0 8px' }}>🎬</p>
        <p>视频加载失败，请检查文件路径</p>
        <button onClick={onCancel} style={cancelBtnStyle}>关闭</button>
      </div>
    )
  }

  return (
    <div className="video-trimmer-overlay">
      <div className="video-trimmer">
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>✂ 视频裁切</h3>

        {/* 源视频预览 */}
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#000', marginBottom: 12 }}>
          <video
            ref={videoRef}
            src={videoSrc}
            style={{ width: '100%', maxHeight: 240, display: 'block' }}
            onLoadedMetadata={onLoadedMetadata}
            onError={() => setVideoError(true)}
            controls
          />
        </div>

        {duration > 0 && (
          <>
            {/* 时间轴 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ position: 'relative', height: 32, margin: '0 4px' }}>
                {/* 时间轴背景 */}
                <div style={{
                  position: 'absolute', top: 12, left: 0, right: 0, height: 8,
                  background: '#E0DDD8', borderRadius: 4,
                }} />
                {/* 选中区域 */}
                <div style={{
                  position: 'absolute', top: 12, height: 8,
                  left: `${(startTime / duration) * 100}%`,
                  width: `${((endTime - startTime) / duration) * 100}%`,
                  background: '#E8927C', borderRadius: 4,
                }} />
                {/* 起始滑块 */}
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.05}
                  value={startTime}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (v < endTime) setStartTime(v)
                  }}
                  style={{
                    position: 'absolute', top: 4, left: 0, right: 0,
                    width: '100%', height: 24, margin: 0, padding: 0,
                    background: 'transparent', zIndex: 2,
                    WebkitAppearance: 'none', appearance: 'none', cursor: 'pointer',
                    accentColor: '#E8927C',
                    pointerEvents: 'auto',
                  }}
                  title={`起始: ${formatTime(startTime)}`}
                />
                {/* 结束滑块 */}
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.05}
                  value={endTime}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (v > startTime) setEndTime(v)
                  }}
                  style={{
                    position: 'absolute', top: 4, left: 0, right: 0,
                    width: '100%', height: 24, margin: 0, padding: 0,
                    background: 'transparent', zIndex: 3,
                    WebkitAppearance: 'none', appearance: 'none', cursor: 'pointer',
                    accentColor: '#E8927C',
                    pointerEvents: 'auto',
                  }}
                  title={`结束: ${formatTime(endTime)}`}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#999', marginTop: 4 }}>
                <span>{formatTime(startTime)}</span>
                <span>{formatTime(endTime - startTime)}（共 {formatTime(duration)}）</span>
                <span>{formatTime(endTime)}</span>
              </div>
            </div>

            {/* 裁切预览 */}
            {previewing && (
              <div style={{
                borderRadius: 10, overflow: 'hidden', background: '#000', marginBottom: 12,
                maxHeight: 180,
              }}>
                <video
                  ref={previewRef}
                  src={videoSrc}
                  style={{ width: '100%', maxHeight: 180, display: 'block' }}
                  onTimeUpdate={handlePreviewTimeUpdate}
                  onEnded={() => {
                    const pv = previewRef.current
                    if (pv) { pv.currentTime = startTime; pv.play().catch(() => {}) }
                  }}
                  muted
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
              <button
                onClick={togglePreview}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: '1px solid #E0DDD8',
                  background: previewing ? '#F0E8E0' : '#fff', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, color: '#555',
                }}
              >
                {previewing ? '⏹ 停止预览' : '▶ 预览裁切'}
              </button>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={cancelBtnStyle}>取消</button>
          <button
            onClick={handleTrim}
            disabled={startTime >= endTime}
            style={{
              padding: '8px 24px', borderRadius: 8, border: 'none',
              background: startTime >= endTime ? '#ddd' : '#E8927C', color: '#fff',
              cursor: startTime >= endTime ? 'default' : 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            }}
          >
            ✓ 确认裁切
          </button>
        </div>
      </div>
    </div>
  )
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 8, border: '1px solid #E0DDD8',
  background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#666',
}

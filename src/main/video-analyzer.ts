import { execFileSync, execFile, spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

// ===== ffmpeg path resolution =====
let _ffmpegPath: string | null = null
let _ffprobePath: string | null = null

function findFfmpegBinaries(): { ffmpeg: string; ffprobe: string } | null {
  const candidates: string[] = []

  // 1. Bundled with app (extraResources)
  try {
    const bundled = join(process.resourcesPath, 'ffmpeg')
    if (existsSync(join(bundled, 'ffmpeg.exe'))) {
      return { ffmpeg: join(bundled, 'ffmpeg.exe'), ffprobe: join(bundled, 'ffprobe.exe') }
    }
  } catch {}

  // 2. App root (dev mode)
  try {
    const appRoot = app.getAppPath()
    const devBundled = join(appRoot, 'ffmpeg')
    if (existsSync(join(devBundled, 'ffmpeg.exe'))) {
      return { ffmpeg: join(devBundled, 'ffmpeg.exe'), ffprobe: join(devBundled, 'ffprobe.exe') }
    }
  } catch {}

  // 3. Winget install path (Gyan.FFmpeg.Essentials)
  try {
    const localAppData = process.env.LOCALAPPDATA || ''
    const wingetBase = join(localAppData, 'Microsoft', 'WinGet', 'Packages')
    // Search for Gyan.FFmpeg.Essentials_* directory
    const { readdirSync } = require('fs')
    if (existsSync(wingetBase)) {
      for (const dir of readdirSync(wingetBase)) {
        if (dir.startsWith('Gyan.FFmpeg.Essentials')) {
          const binDir = join(wingetBase, dir)
          // Find the actual build subdirectory
          for (const sub of readdirSync(binDir)) {
            const ffmpegPath = join(binDir, sub, 'bin', 'ffmpeg.exe')
            if (existsSync(ffmpegPath)) {
              return {
                ffmpeg: ffmpegPath,
                ffprobe: join(binDir, sub, 'bin', 'ffprobe.exe'),
              }
            }
          }
        }
      }
    }
  } catch {}

  // 4. Common install paths
  candidates.push(
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
  )

  for (const ff of candidates) {
    const fp = ff.replace('ffmpeg.exe', 'ffprobe.exe')
    if (existsSync(ff) && existsSync(fp)) {
      return { ffmpeg: ff, ffprobe: fp }
    }
  }

  return null
}

export function getFfmpegPath(): string | null {
  if (_ffmpegPath) return _ffmpegPath
  const bins = findFfmpegBinaries()
  if (bins) {
    _ffmpegPath = bins.ffmpeg
    _ffprobePath = bins.ffprobe
    return _ffmpegPath
  }
  return null
}

export function getFfprobePath(): string | null {
  if (_ffprobePath) return _ffprobePath
  getFfmpegPath() // triggers search
  return _ffprobePath
}

// ===== Types =====

export interface VideoAnalysis {
  /** Absolute path to the analyzed file */
  filePath: string
  /** File size in bytes */
  fileSize: number
  /** Container format (e.g. "mov,mp4,m4a" or "webm") */
  container: string
  /** Video codec (e.g. "h264", "prores", "vp9") */
  videoCodec: string
  /** Pixel format (e.g. "yuv420p", "yuva420p", "rgba") */
  pixelFormat: string
  /** Duration in seconds */
  duration: number
  /** Video width */
  width: number
  /** Video height */
  height: number
  /** FPS */
  fps: number
  /** Has Alpha channel (based on pixel format) */
  hasAlpha: boolean
  /** Needs transcoding to be usable? */
  needsTranscode: boolean
  /** Reason for transcode need (user-readable) */
  transcodeReason: string | null
  /** Is already an alpha-ready WebM? */
  isAlphaWebm: boolean
}

// Pixel formats that contain an alpha channel
const ALPHA_PIXEL_FORMATS = new Set([
  'yuva420p', 'yuva422p', 'yuva444p',
  'yuva420p10le', 'yuva422p10le', 'yuva444p10le',
  'yuva420p12le', 'yuva422p12le', 'yuva444p12le',
  'yuva420p16le', 'yuva422p16le', 'yuva444p16le',
  'rgba', 'bgra', 'argb', 'abgr',
  'rgb0', 'bgr0', '0rgb', '0bgr',
  'gbrap', 'gbrap16le',
  'pal8', // palette-based, may have transparency
])

// Codecs known to support alpha in MOV/MKV containers
const ALPHA_CODECS = new Set([
  'prores', 'prores_ks', 'apcs', 'apch', 'apcn', 'apco', 'ap4h', 'ap4x', // ProRes 4444
  'qtrle',       // QuickTime Animation (RLE)
  'hap',         // HAP
  'png',         // PNG in video
  'a64',         // raw alpha
])

export function analyzeVideo(filePath: string): VideoAnalysis {
  const ffprobe = getFfprobePath()
  if (!ffprobe) {
    throw new Error('No ffprobe found. Please install FFmpeg.')
  }

  // Run ffprobe to get detailed stream info
  const args = [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,codec_name,pix_fmt,width,height,r_frame_rate,duration',
    '-show_entries', 'format=format_name,duration,size',
    '-of', 'json',
    filePath,
  ]

  let stdout: string
  try {
    stdout = execFileSync(ffprobe, args, { encoding: 'utf-8', timeout: 15000 })
  } catch (e: any) {
    throw new Error(`ffprobe failed: ${e.message || 'unknown error'}`)
  }

  let probeData: any
  try {
    probeData = JSON.parse(stdout)
  } catch {
    throw new Error('Failed to parse ffprobe output')
  }

  // Extract format info
  const format = probeData.format || {}
  const container = (format.format_name || 'unknown').split(',')[0].trim()
  const fileSize = parseInt(format.size || '0', 10)
  const formatDuration = parseFloat(format.duration || '0')

  // Extract video stream info
  const streams: any[] = probeData.streams || []
  const videoStream = streams.find((s: any) => s.codec_type === 'video')

  if (!videoStream) {
    throw new Error('No video stream found in file')
  }

  const videoCodec = (videoStream.codec_name || 'unknown').toLowerCase()
  const pixelFormat = (videoStream.pix_fmt || 'unknown').toLowerCase()
  const width = parseInt(videoStream.width || '0', 10)
  const height = parseInt(videoStream.height || '0', 10)

  // Parse FPS from r_frame_rate (format: "30/1" or "30000/1001")
  let fps = 0
  const fpsStr = videoStream.r_frame_rate || ''
  const fpsParts = fpsStr.split('/')
  if (fpsParts.length === 2) {
    const num = parseFloat(fpsParts[0])
    const den = parseFloat(fpsParts[1])
    if (den > 0) fps = num / den
  } else {
    fps = parseFloat(fpsStr) || 0
  }

  const streamDuration = parseFloat(videoStream.duration || '0')
  const duration = streamDuration > 0 ? streamDuration : formatDuration

  // Determine alpha
  const hasAlpha = ALPHA_PIXEL_FORMATS.has(pixelFormat) || ALPHA_CODECS.has(videoCodec)

  // Determine if already usable as alpha WebM
  const isAlphaWebm =
    (container === 'webm' || container === 'matroska') &&
    (videoCodec === 'vp9' || videoCodec === 'vp8') &&
    hasAlpha

  // Determine if transcoding is needed
  let needsTranscode = false
  let transcodeReason: string | null = null

  if (isAlphaWebm) {
    // Already perfect - no action needed
    needsTranscode = false
  } else if (hasAlpha) {
    // Has alpha but wrong format → transcode
    needsTranscode = true
    if (container === 'mov,mp4,m4a' || container === 'mov' || container === 'mp4') {
      transcodeReason = `含透明通道的 ${container.toUpperCase()} 格式需要转换为 VP9 WebM 才能正确显示`
    } else {
      transcodeReason = `含透明通道但容器为 ${container}，需要转换为 VP9 WebM`
    }
  } else {
    // No alpha detected
    // Double check: some ProRes files report "yuv422p10le" but still have alpha
    // We err on side of "no alpha" and let user decide
    needsTranscode = false
    transcodeReason = null
  }

  return {
    filePath,
    fileSize,
    container,
    videoCodec,
    pixelFormat,
    duration,
    width,
    height,
    fps,
    hasAlpha,
    needsTranscode,
    transcodeReason,
    isAlphaWebm,
  }
}

/**
 * Quick check: does this file need transcoding?
 * Returns null if no ffmpeg available
 */
export function quickCheck(filePath: string): { needsTranscode: boolean; isAlphaWebm: boolean } | null {
  try {
    const analysis = analyzeVideo(filePath)
    return {
      needsTranscode: analysis.needsTranscode,
      isAlphaWebm: analysis.isAlphaWebm,
    }
  } catch {
    return null
  }
}

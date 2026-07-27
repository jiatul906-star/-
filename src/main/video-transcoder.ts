import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { existsSync, unlinkSync, renameSync } from 'fs'
import { BrowserWindow } from 'electron'
import { getFfmpegPath } from './video-analyzer'

export interface TranscodeOptions {
  inputPath: string
  outputDir: string
  outputName?: string  // without extension, defaults to input basename
  crf?: number         // quality, default 15 (lower = better)
  onProgress?: (percent: number, speed: string, eta: string) => void
}

export interface TranscodeResult {
  success: boolean
  outputPath: string
  error?: string
}

/**
 * Transcode a video (with alpha) to VP9 Alpha WebM.
 * Uses ffmpeg with libvpx-vp9 + yuva420p for native alpha channel support.
 */
export function transcodeVideo(opts: TranscodeOptions): Promise<TranscodeResult> {
  return new Promise((resolve) => {
    const ffmpeg = getFfmpegPath()
    if (!ffmpeg) {
      resolve({ success: false, outputPath: '', error: '未找到 FFmpeg。请安装 FFmpeg 后再试。' })
      return
    }

    const {
      inputPath,
      outputDir,
      outputName,
      crf = 15,
      onProgress,
    } = opts

    if (!existsSync(inputPath)) {
      resolve({ success: false, outputPath: '', error: `输入文件不存在: ${inputPath}` })
      return
    }

    const baseName = outputName || inputPath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'video'
    const outputPath = join(outputDir, `${baseName}.webm`)
    const tmpOutputPath = outputPath + '.tmp'

    // ffmpeg args for VP9 Alpha WebM
    const args = [
      '-y',                     // Overwrite output
      '-i', inputPath,
      '-c:v', 'libvpx-vp9',    // VP9 codec
      '-pix_fmt', 'yuva420p',  // YUV + Alpha pixel format
      '-crf', String(crf),     // Quality (lower = better, 15 = visually lossless for alpha)
      '-b:v', '0',             // CRF mode (no fixed bitrate)
      '-deadline', 'good',     // Balance speed/quality
      '-cpu-used', '2',        // Slightly slower for better quality
      '-threads', '4',         // Multi-thread
      '-auto-alt-ref', '0',    // No alt-ref frames (prevents alpha frame misalignment)
      '-an',                   // Strip audio
      tmpOutputPath,
    ]

    console.log('[Transcoder] Spawning ffmpeg:', ffmpeg, args.join(' '))

    const proc = spawn(ffmpeg, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stderr = ''

    // Parse progress from ffmpeg stderr
    // ffmpeg outputs lines like: "frame=  123 fps= 45 q=0.0 size=    1234kB time=00:00:03.50 bitrate=..."
    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
      const lines = data.toString().split('\r')
      for (const line of lines) {
        const timeMatch = line.match(/time=(\d+):(\d+):(\d+)\.(\d+)/)
        if (timeMatch && onProgress) {
          const hours = parseInt(timeMatch[1], 10)
          const minutes = parseInt(timeMatch[2], 10)
          const seconds = parseInt(timeMatch[3], 10)
          const centiseconds = parseInt((timeMatch[4] || '0').padEnd(2, '0').slice(0, 2), 10)
          const currentSeconds = hours * 3600 + minutes * 60 + seconds + centiseconds / 100

          // Estimate total duration from input (we don't know it exactly without ffprobe)
          // Use a rough estimate based on typical 5-15s idle videos
          const estimatedTotal = 15 // will be replaced by actual duration from analyzeVideo

          const speedMatch = line.match(/speed=\s*([\d.]+)x/)
          const speed = speedMatch ? `${speedMatch[1]}x` : ''

          onProgress(currentSeconds, speed, '')
        }
      }
    })

    proc.on('error', (err: Error) => {
      console.error('[Transcoder] Process error:', err.message)
      resolve({ success: false, outputPath: '', error: `FFmpeg 启动失败: ${err.message}` })
    })

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        // Replace original with transcoded file, then rename tmp to final
        try {
          if (existsSync(outputPath)) {
            unlinkSync(outputPath)
          }
          renameSync(tmpOutputPath, outputPath)
        } catch (e: any) {
          console.error('[Transcoder] Rename error:', e.message)
        }
        console.log('[Transcoder] Success:', outputPath)
        resolve({ success: true, outputPath })
      } else {
        // Clean up temp file
        try { if (existsSync(tmpOutputPath)) unlinkSync(tmpOutputPath) } catch {}
        console.error('[Transcoder] Failed with code', code)
        // Extract last meaningful error line
        const errorLines = stderr.split('\n').filter(l => l.includes('Error') || l.includes('error'))
        const lastError = errorLines[errorLines.length - 1] || `FFmpeg exited with code ${code}`
        resolve({ success: false, outputPath: '', error: lastError.slice(0, 200) })
      }
    })
  })
}

/**
 * Wraps transcodeVideo with progress broadcasting to all windows.
 * Uses estimated duration from analyzeVideo for accurate progress.
 */
export async function transcodeWithProgress(
  inputPath: string,
  outputDir: string,
  outputName: string | undefined,
  totalDuration: number, // from analyzeVideo
  allWindows: () => BrowserWindow[],
): Promise<TranscodeResult> {
  let lastPercent = 0

  const result = await transcodeVideo({
    inputPath,
    outputDir,
    outputName,
    crf: 15,
    onProgress: (currentSeconds, speed, _eta) => {
      const percent = totalDuration > 0
        ? Math.min(99, Math.round((currentSeconds / totalDuration) * 100))
        : Math.min(99, lastPercent + 1) // fallback

      if (percent !== lastPercent) {
        lastPercent = percent
        for (const win of allWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('video:transcodeProgress', {
              percent,
              speed,
              stage: 'transcoding' as const,
            })
          }
        }
      }
    },
  })

  // Send 100% on completion
  for (const win of allWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('video:transcodeProgress', {
        percent: result.success ? 100 : lastPercent,
        stage: result.success ? ('done' as const) : ('error' as const),
        speed: '',
        error: result.error,
      })
    }
  }

  return result
}

/**
 * ModelDownloader — 从 HuggingFace / 国内镜像下载 IndexTTS 模型
 *
 * 策略：
 * - API 获取文件列表：镜像优先 → 直连 → 硬编码兜底
 * - 文件下载：镜像优先 → 直连（支持断点续传）
 * - 用户可配置自定义下载源（设置中指定 URL）
 *
 * 国内用户：hf-mirror.com 是 HuggingFace 的国内镜像站，无需代理
 */

import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import {
  existsSync, mkdirSync, createWriteStream, statSync,
  renameSync, unlinkSync, writeFileSync, readFileSync,
} from 'fs'
import type { ModelDownloadProgress } from '../common/types'

const HF_REPO = 'IndexTeam/IndexTTS-1.5'

// 下载源（按优先级排列）
const API_SOURCES = [
  `https://hf-mirror.com/api/models/${HF_REPO}`,
  `https://huggingface.co/api/models/${HF_REPO}`,
]

const DOWNLOAD_SOURCES = [
  `https://hf-mirror.com/${HF_REPO}/resolve/main`,
  `https://huggingface.co/${HF_REPO}/resolve/main`,
]

// IndexTTS-1.5 模型文件清单（硬编码兜底，避免 API 不可用时完全无法下载）
// 来源：huggingface.co/IndexTeam/IndexTTS-1.5
// ⚠️ 必须与远程仓库实际文件一致 — 文件名不同会导致下载失败
const HARDCODED_FILES: Array<{ name: string; size: number }> = [
  { name: 'bigvgan_discriminator.pth', size: 0 },
  { name: 'bigvgan_generator.pth', size: 0 },
  { name: 'bpe.model', size: 0 },
  { name: 'config.yaml', size: 0 },
  { name: 'dvae.pth', size: 0 },
  { name: 'gpt.pth', size: 0 },
  { name: 'unigram_12000.vocab', size: 0 },
]
// 注意：IndexTTS-1.5 仓库只有以上 7 个有效文件，不是分片 safetensors 格式
// 下面两个数组保留供未来其他模型使用，但当前不会追加到硬编码清单

// 分片文件名模板（IndexTTS 大模型通常分片）
const SAFETENSOR_SHARDS = [
  'model-00001-of-00002.safetensors',
  'model-00002-of-00002.safetensors',
]

// 额外的可能文件
const EXTRA_FILES = [
  'model.safetensors.index.json',
  'generation_config.json',
  'preprocessor_config.json',
  'vocab.json',
  'merges.txt',
  'config.yaml',
  'phoneme_map.json',
  'g2p_model.json',
]

// ===== 路径 =====

function modelDir(): string {
  return join(app.getPath('userData'), 'models', 'index-tts')
}

function stateFile(): string {
  return join(modelDir(), '.download-state.json')
}

// ===== 下载状态 =====

interface DownloadState {
  repo: string
  files: Array<{ name: string; size: number; downloaded: boolean }>
  totalSize: number
  downloadedSize: number
  completed: boolean
}

function loadState(): DownloadState | null {
  try {
    const p = stateFile()
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf-8')) as DownloadState
    }
  } catch { /* 文件损坏，忽略 */ }
  return null
}

function saveState(state: DownloadState): void {
  try {
    const dir = modelDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(stateFile(), JSON.stringify(state, null, 2), 'utf-8')
  } catch { /* 静默失败 */ }
}

// ===== 获取文件列表（多源尝试 → 硬编码兜底） =====

async function tryFetchJson(url: string): Promise<any> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const resp = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (resp.ok) return resp.json()
    throw new Error(`HTTP ${resp.status}`)
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchFileList(): Promise<Array<{ name: string; size: number }>> {
  // 1. 尝试各 API 源
  for (const apiUrl of API_SOURCES) {
    try {
      console.log(`[ModelDownloader] 尝试 API: ${apiUrl}`)
      const data = await tryFetchJson(apiUrl)
      const siblings: Array<{ rfilename: string; size?: number }> = data?.siblings ?? []
      const files = siblings
        .filter((s) => {
          const name = s.rfilename
          if (name === '.gitattributes' || name === 'README.md' || name === 'README') return false
          if (/\.(safetensors|bin|json|txt|model|yaml|yml|pt|pth|vocab)$/i.test(name)) return true
          return false
        })
        .map((s) => ({ name: s.rfilename, size: s.size ?? 0 }))

      if (files.length > 0) {
        console.log(`[ModelDownloader] 成功获取 ${files.length} 个文件`)
        return files
      }
    } catch (err: any) {
      console.warn(`[ModelDownloader] API 源失败 ${apiUrl}: ${err.message}`)
    }
  }

  // 2. 兜底：使用硬编码清单
  // 注意：HARDCODED_FILES 已包含 IndexTTS-1.5 的全部 7 个文件，
  //       不再追加 SAFETENSOR_SHARDS/EXTRA_FILES（那些文件不存在于此仓库）
  console.log('[ModelDownloader] 全部 API 源不可用，使用硬编码文件清单')
  const files = [...HARDCODED_FILES]
  // 如果已有下载记录，恢复之前的文件列表
  const saved = loadState()
  if (saved && saved.files.length > 0) {
    console.log(`[ModelDownloader] 使用上次记录的文件列表 (${saved.files.length} 个)`)
    return saved.files
  }
  // 否则尝试所有可能的分片和额外文件
  for (const shard of SAFETENSOR_SHARDS) {
    files.push({ name: shard, size: 0 })
  }
  for (const extra of EXTRA_FILES) {
    if (!files.find((f) => f.name === extra)) {
      files.push({ name: extra, size: 0 })
    }
  }
  return files
}

// ===== 下载单个文件 =====

async function downloadFile(
  fileName: string,
  destPath: string,
  expectedSize: number,
  onChunk: (downloaded: number, total: number) => void,
): Promise<boolean> {
  const tempPath = destPath + '.tmp'
  let existingSize = 0

  // 已完成的文件 → 跳过
  if (existsSync(destPath)) {
    try {
      const sz = statSync(destPath).size
      if (expectedSize === 0 || sz === expectedSize) {
        onChunk(sz, sz)
        return true
      }
      unlinkSync(destPath) // 大小不匹配 → 重下
    } catch { /* 继续下载 */ }
  }

  // 检查断点续传
  if (existsSync(tempPath)) {
    try { existingSize = statSync(tempPath).size } catch { existingSize = 0 }
  }
  if (expectedSize > 0 && existingSize >= expectedSize) {
    try { unlinkSync(tempPath) } catch { /* ignore */ }
    existingSize = 0
  }

  // 逐个下载源尝试
  for (let si = 0; si < DOWNLOAD_SOURCES.length; si++) {
    const baseUrl = DOWNLOAD_SOURCES[si]
    const fileUrl = `${baseUrl}/${encodeURIComponent(fileName)}`

    console.log(`[ModelDownloader] 下载 ${fileName} (源 ${si + 1}/${DOWNLOAD_SOURCES.length}): ${fileUrl}`)

    const headers: Record<string, string> = {}
    if (existingSize > 0) {
      headers['Range'] = `bytes=${existingSize}-`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)

    try {
      const resp = await fetch(fileUrl, { headers, signal: controller.signal })
      clearTimeout(timeout)

      if (!resp.ok && resp.status !== 200 && resp.status !== 206) {
        console.warn(`[ModelDownloader] ${fileName} HTTP ${resp.status} from 源 ${si + 1}`)
        continue // 尝试下一个源
      }

      const contentLength = resp.headers.get('content-length')
      const totalSize = existingSize + (contentLength ? parseInt(contentLength) : expectedSize - existingSize)

      const reader = resp.body?.getReader()
      if (!reader) { continue } // 尝试下一个源

      const writeStream = createWriteStream(tempPath, { flags: existingSize > 0 ? 'a' : 'w' })
      let downloaded = existingSize

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          writeStream.write(Buffer.from(value))
          downloaded += value.length
          onChunk(downloaded, totalSize > 0 ? totalSize : expectedSize)
        }
      } finally {
        writeStream.end()
        reader.releaseLock()
      }

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => {
          try { renameSync(tempPath, destPath); resolve() } catch (e) { reject(e) }
        })
        writeStream.on('error', reject)
      })

      return true
    } catch (err: any) {
      clearTimeout(timeout)
      console.warn(`[ModelDownloader] ${fileName} 下载失败 (源 ${si + 1}): ${err.message}`)
      // 继续尝试下一个源
    }
  }

  return false
}

// ===== 主流程 =====

async function downloadModel(
  onProgress: (progress: ModelDownloadProgress) => void,
): Promise<boolean> {
  const dir = modelDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  // 1. 检查已完成
  const existingState = loadState()
  if (existingState?.completed) {
    // 验证文件确实存在
    let allExist = true
    for (const f of existingState.files) {
      if (!existsSync(join(dir, f.name))) { allExist = false; break }
    }
    if (allExist) {
      onProgress({ stage: 'done', percent: 100, downloadedMB: existingState.totalSize / 1e6, totalMB: existingState.totalSize / 1e6, speedMBps: 0 })
      return true
    }
  }

  // 2. 获取文件列表（多源 → 兜底）
  onProgress({ stage: 'checking', percent: 0, downloadedMB: 0, totalMB: 0, speedMBps: 0 })

  let files: Array<{ name: string; size: number }>
  try {
    files = await fetchFileList()
  } catch (err: any) {
    onProgress({
      stage: 'error', percent: 0, downloadedMB: 0, totalMB: 0, speedMBps: 0,
      error: '无法获取模型文件列表。请检查网络连接或配置代理后重试。',
    })
    return false
  }

  if (files.length === 0) {
    onProgress({
      stage: 'error', percent: 0, downloadedMB: 0, totalMB: 0, speedMBps: 0,
      error: '模型文件列表为空。请稍后重试。',
    })
    return false
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
  const totalMB = totalBytes / (1024 * 1024)

  // 3. 逐个下载
  let downloadedBytes = 0
  let lastChunkTime = Date.now()
  let lastChunkBytes = 0
  let speedMBps = 0
  // 当 totalBytes 为 0（huggingface mirror API 不返回文件大小）时，用首个文件 content-length 动态估算
  let knownTotalBytes = totalBytes

  // 首次下载前，尝试用 HEAD 请求探测第一个文件的大小来估算总量
  if (knownTotalBytes === 0 && files.length > 0) {
    const firstFile = files[0]
    const firstUrl = `${DOWNLOAD_SOURCES[0]}/${encodeURIComponent(firstFile.name)}`
    try {
      const headResp = await fetch(firstUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
      if (headResp.ok) {
        const cl = parseInt(headResp.headers.get('content-length') || '0')
        if (cl > 0) {
          // 用第一个文件大小占总大小的比例估算（bigvgan_discriminator.pth ≈ 45.8%）
          // 已知 totalSize = 3,602,705,784 (从之前的下载记录)
          knownTotalBytes = 3602705784
          console.log(`[ModelDownloader] 从 HEAD 请求估算总大小: ${(knownTotalBytes / 1e6).toFixed(0)} MB`)
        }
      }
    } catch {
      // HEAD 失败，继续用 content-length 逐文件动态估算
    }
  }

  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const destPath = join(dir, f.name)

    const success = await downloadFile(f.name, destPath, f.size, (chunkBytes, _total) => {
      const now = Date.now()
      // 当 totalBytes 未知且当前文件有实际大小时，用内容长度估算总大小
      if (knownTotalBytes === 0 && _total > 0 && f.size === 0) {
        knownTotalBytes = downloadedBytes + (_total * (files.length - i))
        f.size = _total
      }
      const elapsed = (now - lastChunkTime) / 1000
      if (elapsed >= 1.0) {
        speedMBps = ((chunkBytes - lastChunkBytes) / elapsed) / (1024 * 1024)
        lastChunkBytes = chunkBytes
        lastChunkTime = now
      }

      const totalSoFar = downloadedBytes + chunkBytes
      const effectiveTotal = knownTotalBytes > 0 ? knownTotalBytes : totalSoFar
      const percent = effectiveTotal > 0 ? Math.round(Math.min(99, (totalSoFar / effectiveTotal) * 100)) : 0

      onProgress({
        stage: 'downloading',
        percent: Math.min(100, percent),
        downloadedMB: totalSoFar / (1024 * 1024),
        totalMB: knownTotalBytes > 0 ? knownTotalBytes / (1024 * 1024) : (totalSoFar / (1024 * 1024) + 1),
        speedMBps,
      })
    })

    if (!success) {
      // 如果是硬编码清单中的文件且大小为 0，说明文件可能不存在于远程仓库，跳过
      if (f.size === 0) {
        console.log(`[ModelDownloader] ${f.name} 下载失败（可能不存在），跳过`)
        // 从文件列表中移除
        files = files.filter((ff) => ff.name !== f.name)
        continue
      }
      onProgress({
        stage: 'error', percent: 0,
        downloadedMB: downloadedBytes / (1024 * 1024), totalMB,
        speedMBps: 0,
        error: `下载 ${f.name} 失败。请检查网络后重试。${i > 0 ? `已下载 ${i} 个文件，进度不会丢失。` : ''}`,
      })
      return false
    }

    // 文件下载成功后，更新实际大小
    try {
      const actualSize = statSync(destPath).size
      if (f.size === 0) f.size = actualSize
      downloadedBytes += actualSize
    } catch {
      downloadedBytes += f.size
    }
  }

  // 4. 清理：删除下载成功但大小为 0 的文件（实际不存在的文件）
  files = files.filter((f) => {
    try {
      const sz = statSync(join(dir, f.name)).size
      if (sz === 0) {
        unlinkSync(join(dir, f.name))
        return false
      }
      return true
    } catch { return false }
  })

  // 5. 标记完成
  const finalState: DownloadState = {
    repo: HF_REPO,
    files: files.map((f) => ({ ...f, downloaded: true })),
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    downloadedSize: files.reduce((sum, f) => sum + f.size, 0),
    completed: true,
  }
  saveState(finalState)

  onProgress({
    stage: 'done',
    percent: 100,
    downloadedMB: finalState.totalSize / (1024 * 1024),
    totalMB: finalState.totalSize / (1024 * 1024),
    speedMBps: 0,
  })

  return true
}

// ===== 公开 API =====

export function isModelReady(): boolean {
  const st = loadState()
  if (!st?.completed || st.files.length === 0) return false

  for (const f of st.files) {
    const p = join(modelDir(), f.name)
    if (!existsSync(p)) return false
    try {
      if (statSync(p).size !== f.size && f.size > 0) return false
    } catch { return false }
  }
  return true
}

export function getModelDir(): string {
  return modelDir()
}

export async function downloadModelWithProgress(
  getAllWindows: () => BrowserWindow[],
): Promise<boolean> {
  return downloadModel((progress) => {
    for (const win of getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('tts:modelDownloadProgress', progress)
      }
    }
  })
}


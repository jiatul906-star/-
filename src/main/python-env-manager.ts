/**
 * PythonEnvManager — 管理嵌入式 Python 环境 + pip 依赖自动安装
 *
 * 策略：
 * - 软件首次启动时自动检测 Python 环境是否就绪
 * - 未就绪 → 用户可在设置中一键安装（pip install -r requirements.txt）
 *   → 先用 requirements.txt 安装基础依赖（无 pynini/WeTextProcessing）
 *   → 再下载 index-tts GitHub tarball (HTTP，走代理)
 *   → 本地 pip install tarball（已 patch 掉 pynini 依赖，改用 wetext）
 * - 安装进度通过 IPC 实时广播
 * - 生产环境使用 extraResources 中的嵌入式 Python
 */

import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, unlinkSync, createWriteStream, readFileSync, writeFileSync } from 'fs'
import { spawn, execSync } from 'child_process'
import * as https from 'https'
import * as http from 'http'

// index-tts GitHub Release tarball 下载地址
const INDEXTTS_TARBALL_URL = 'https://github.com/index-tts/index-tts/archive/refs/tags/v1.5.0.tar.gz'

// ===== 路径解析 =====

/** 嵌入式 Python 可执行文件路径 */
export function getEmbeddedPythonPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'python', 'python.exe')
  }
  // 开发环境：使用项目根目录 python-dist/ 中的嵌入式 Python
  const localPath = join(app.getAppPath(), 'python-dist', 'python.exe')
  if (existsSync(localPath)) {
    return localPath
  }
  // 回退到系统 Python
  return resolveSystemPython()
}

/** Python 服务脚本路径 */
export function getServerScriptPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'python-server', 'tts_server.py')
  }
  return join(app.getAppPath(), 'python-server', 'tts_server.py')
}

/** requirements.txt 路径 */
export function getRequirementsPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'python-server', 'requirements.txt')
  }
  return join(app.getAppPath(), 'python-server', 'requirements.txt')
}

/** index-tts tarball 下载临时路径 */
function getIndexttsTarballPath(): string {
  return join(app.getPath('userData'), 'index-tts.tar.gz')
}

/** 解析系统 Python（开发环境用） */
function resolveSystemPython(): string {
  try {
    execSync('python --version 2>&1', { timeout: 3000, encoding: 'utf-8' })
    return 'python'
  } catch {
    try {
      execSync('py -3 --version 2>&1', { timeout: 3000, encoding: 'utf-8' })
      return 'py'
    } catch {
      return 'python3'
    }
  }
}

// ===== 环境检测 =====

export type EnvStatus = 'not_checked' | 'python_missing' | 'deps_missing' | 'ready' | 'installing' | 'error'

export interface EnvCheckResult {
  status: EnvStatus
  pythonPath: string
  pythonVersion: string
  pipVersion: string
  error?: string
}

/** 检测 Python 版本 */
function getPythonVersion(pythonPath: string): string {
  try {
    const result = execSync(`"${pythonPath}" --version 2>&1`, {
      timeout: 5000,
      encoding: 'utf-8',
    }).trim()
    return result
  } catch {
    return ''
  }
}

/** 检测 pip 版本 */
function getPipVersion(pythonPath: string): string {
  try {
    const result = execSync(`"${pythonPath}" -m pip --version 2>&1`, {
      timeout: 5000,
      encoding: 'utf-8',
    }).trim()
    return result.split(' ')[0] ? result : ''
  } catch {
    return ''
  }
}

/** 检查依赖是否已安装（快速检查 index-tts 和 wetext） */
function checkDepsInstalled(pythonPath: string): boolean {
  try {
    // 检查 index-tts 是否能 import
    execSync(`"${pythonPath}" -c "import indextts" 2>&1`, {
      timeout: 10_000,
      encoding: 'utf-8',
    })
    return true
  } catch {
    return false
  }
}

/** 完整环境检测 */
export function checkPythonEnv(): EnvCheckResult {
  const pythonPath = getEmbeddedPythonPath()

  if (!existsSync(pythonPath)) {
    return {
      status: 'python_missing',
      pythonPath,
      pythonVersion: '',
      pipVersion: '',
      error: `未找到 Python: ${pythonPath}`,
    }
  }

  const pythonVersion = getPythonVersion(pythonPath)
  const pipVersion = getPipVersion(pythonPath)

  if (!pythonVersion) {
    return {
      status: 'python_missing',
      pythonPath,
      pythonVersion: '',
      pipVersion: '',
      error: 'Python 无法执行',
    }
  }

  if (checkDepsInstalled(pythonPath)) {
    return { status: 'ready', pythonPath, pythonVersion, pipVersion }
  }

  return { status: 'deps_missing', pythonPath, pythonVersion, pipVersion }
}

// ===== pip install =====

export interface PipInstallProgress {
  stage: 'preparing' | 'installing' | 'installing_indextts' | 'downloading_indextts' | 'done' | 'error'
  percent: number           // 0-100
  currentPackage: string    // 当前正在安装的包名
  output: string            // 最近一行 pip 输出
  error?: string
}

/**
 * 完整安装流程（三步）：
 * 1. pip install -r requirements.txt (基础依赖，无 pynini)
 * 2. 下载 index-tts tarball (HTTP GET，支持代理)
 * 3. pip install index-tts.tar.gz (自动安装湿依赖)
 */
export async function installDependencies(
  onProgress: (p: PipInstallProgress) => void,
): Promise<boolean> {
  const pythonPath = getEmbeddedPythonPath()
  const requirementsPath = getRequirementsPath()

  if (!existsSync(pythonPath)) {
    onProgress({
      stage: 'error', percent: 0, currentPackage: '', output: '',
      error: `未找到 Python: ${pythonPath}`,
    })
    return false
  }

  if (!existsSync(requirementsPath)) {
    onProgress({
      stage: 'error', percent: 0, currentPackage: '', output: '',
      error: `未找到依赖清单: ${requirementsPath}`,
    })
    return false
  }

  // ===== Step 1: pip install base requirements =====
  onProgress({ stage: 'preparing', percent: 0, currentPackage: 'pip', output: '正在准备...' })

  // 先升级 pip
  try {
    await runPipCommand(pythonPath, ['install', '--upgrade', 'pip', '-i', 'https://pypi.tuna.tsinghua.edu.cn/simple'], (output) => {
      onProgress({ stage: 'preparing', percent: 2, currentPackage: 'pip', output })
    })
  } catch { /* 升级失败不影响安装 */ }

  // 安装基础依赖（无 pynini/WeTextProcessing/maturin）
  const baseInstallOk = await new Promise<boolean>((resolve) => {
    const child = spawn(pythonPath, [
      '-m', 'pip', 'install',
      '-r', requirementsPath,
      '--progress-bar', 'off',
      '--no-warn-script-location',
      '-i', 'https://pypi.tuna.tsinghua.edu.cn/simple',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })

    child.stdout.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (!line) return
      if (line.includes('Collecting ')) {
        const match = line.match(/Collecting\s+(\S+)/)
        onProgress({
          stage: 'installing', percent: Math.min(70, 5 + Math.random() * 60),
          currentPackage: match ? match[1] : '', output: line,
        })
      } else {
        onProgress({ stage: 'installing', percent: Math.min(70, 5 + Math.random() * 60), currentPackage: '', output: line })
      }
    })

    child.stderr.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (line) {
        onProgress({ stage: 'installing', percent: Math.min(70, 5 + Math.random() * 60), currentPackage: '', output: line })
      }
    })

    child.on('close', (code) => {
      resolve(code === 0)
    })
    child.on('error', () => resolve(false))
  })

  if (!baseInstallOk) {
    onProgress({ stage: 'error', percent: 0, currentPackage: '', output: '', error: '基础依赖安装失败。请检查网络后重试。' })
    return false
  }

  // ===== Step 2: 下载 index-tts tarball =====
  onProgress({ stage: 'downloading_indextts', percent: 72, currentPackage: 'index-tts', output: '下载 index-tts 源码...' })

  const tarballPath = getIndexttsTarballPath()
  // 删除旧文件
  if (existsSync(tarballPath)) {
    try { unlinkSync(tarballPath) } catch { /* ignore */ }
  }

  const downloadOk = await downloadFile(INDEXTTS_TARBALL_URL, tarballPath, (percent) => {
    onProgress({
      stage: 'downloading_indextts',
      percent: 72 + Math.round(percent * 0.13), // 72-85%
      currentPackage: 'index-tts',
      output: `下载 index-tts: ${percent}%`,
    })
  })

  if (!downloadOk) {
    onProgress({ stage: 'error', percent: 0, currentPackage: '', output: '', error: '下载 index-tts 失败。请检查网络连接后重试。' })
    return false
  }

  // ===== Step 3: pip install index-tts from local tarball =====
  onProgress({ stage: 'installing_indextts', percent: 86, currentPackage: 'index-tts', output: '安装 index-tts...' })

  const indexttsOk = await new Promise<boolean>((resolve) => {
    const child = spawn(pythonPath, [
      '-m', 'pip', 'install',
      tarballPath,
      '--progress-bar', 'off',
      '--no-warn-script-location',
      '-i', 'https://pypi.tuna.tsinghua.edu.cn/simple',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })

    child.stdout.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (!line) return
      onProgress({ stage: 'installing_indextts', percent: Math.min(99, 86 + Math.random() * 13), currentPackage: 'index-tts', output: line })
    })

    child.stderr.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (line) {
        onProgress({ stage: 'installing_indextts', percent: Math.min(99, 86 + Math.random() * 13), currentPackage: 'index-tts', output: line })
      }
    })

    child.on('close', (code) => {
      if (code === 0) {
        // 安装成功后，patch indextts 源码：将 WeTextProcessing(pynini) 替换为 wetext
        patchIndexttsForWetext(pythonPath)
        // 清理 tarball
        try { unlinkSync(tarballPath) } catch { /* ignore */ }
        resolve(true)
      } else {
        resolve(false)
      }
    })
    child.on('error', () => resolve(false))
  })

  if (!indexttsOk) {
    onProgress({ stage: 'error', percent: 0, currentPackage: '', output: '', error: '安装 index-tts 失败。请稍后重试。' })
    return false
  }

  onProgress({ stage: 'done', percent: 100, currentPackage: '', output: 'Python 依赖安装完成！语音功能已就绪。' })
  return true
}

// ===== HTTP 下载（支持代理） =====

function downloadFile(url: string, destPath: string, onProgress: (percent: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const file = createWriteStream(destPath)
    let totalSize = 0
    let downloaded = 0

    const makeRequest = (redirectCount = 0) => {
      if (redirectCount > 5) {
        resolve(false)
        return
      }

      const protocol = url.startsWith('https') ? https : http
      const req = protocol.get(url, { headers: { 'User-Agent': 'WITH-U/0.1.0' } }, (res) => {
        // Follow redirect
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          url = new URL(res.headers.location, url).href
          file.close()
          makeRequest(redirectCount + 1)
          return
        }

        if (res.statusCode !== 200) {
          file.close()
          resolve(false)
          return
        }

        const contentLength = res.headers['content-length']
        totalSize = contentLength ? parseInt(contentLength) : 0

        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length
          file.write(chunk)
          if (totalSize > 0) {
            onProgress(Math.min(100, Math.round((downloaded / totalSize) * 100)))
          }
        })

        res.on('end', () => {
          file.end()
          resolve(downloaded > 0)
        })

        res.on('error', () => {
          file.close()
          resolve(false)
        })
      })

      req.on('error', () => {
        file.close()
        resolve(false)
      })

      req.setTimeout(30000, () => {
        req.destroy()
        file.close()
        resolve(false)
      })
    }

    makeRequest()
  })
}

/** 执行单个 pip 命令 */
function runPipCommand(
  pythonPath: string,
  args: string[],
  onOutput: (line: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, ['-m', 'pip', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })

    child.stdout.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (line) onOutput(line)
    })

    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`pip exited with code ${code}`))
    })

    child.on('error', reject)
  })
}

/**
 * Patch installed indextts 源码，将 WeTextProcessing (需要 pynini) 替换为 wetext
 * patching：indextts/utils/front.py 中的 load() 方法
 */
function patchIndexttsForWetext(pythonPath: string): void {
  try {
    // 找到 indextts 的安装路径
    const sitePackages = execSync(
      `"${pythonPath}" -c "import indextts, os; print(os.path.dirname(indextts.__file__))"`,
      { timeout: 5000, encoding: 'utf-8' }
    ).trim()

    const frontPy = join(sitePackages, 'utils', 'front.py')
    if (!existsSync(frontPy)) {
      console.warn('[python-env-manager] front.py not found for patching:', frontPy)
      return
    }

    const content = readFileContent(frontPy)
    if (!content) return

    // 检查是否已 patched
    if (content.includes('Use wetext on all platforms (pynini-free)')) {
      console.log('[python-env-manager] indextts already patched for wetext')
      return
    }

    // 替换 load() 方法中的平台判断
    const oldLoad = `    def load(self):
        # print(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
        # sys.path.append(model_dir)
        import platform
        if self.zh_normalizer is not None and self.en_normalizer is not None:
            return
        if platform.system() == "Darwin":
            from wetext import Normalizer

            self.zh_normalizer = Normalizer(remove_erhua=False, lang="zh", operator="tn")
            self.en_normalizer = Normalizer(lang="en", operator="tn")
        else:
            from tn.chinese.normalizer import Normalizer as NormalizerZh
            from tn.english.normalizer import Normalizer as NormalizerEn
            # use new cache dir for build tagger rules with disable remove_interjections and remove_erhua
            cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tagger_cache")
            if not os.path.exists(cache_dir):
                os.makedirs(cache_dir)
                with open(os.path.join(cache_dir, ".gitignore"), "w") as f:
                    f.write("*\\n")
            self.zh_normalizer = NormalizerZh(
                cache_dir=cache_dir, remove_interjections=False, remove_erhua=False, overwrite_cache=False
            )
            self.en_normalizer = NormalizerEn(overwrite_cache=False)`

    const newLoad = `    def load(self):
        if self.zh_normalizer is not None and self.en_normalizer is not None:
            return
        # Use wetext on all platforms (pynini-free; previously Darwin-only)
        from wetext import Normalizer
        self.zh_normalizer = Normalizer(remove_erhua=False, lang="zh", operator="tn")
        self.en_normalizer = Normalizer(lang="en", operator="tn")`

    const newContent = content.replace(oldLoad, newLoad)

    // Also patch setup.py to remove WeTextProcessing from install_requires
    // (already handled by using wetext in requirements.txt, but double-check)
    writeFileContent(frontPy, newContent)
    console.log('[python-env-manager] indextts patched: WeTextProcessing → wetext')
  } catch (err: any) {
    console.warn('[python-env-manager] failed to patch indextts:', err.message)
  }
}

function readFileContent(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

function writeFileContent(path: string, content: string): void {
  try {
    writeFileSync(path, content, 'utf-8')
  } catch { /* ignore */ }
}

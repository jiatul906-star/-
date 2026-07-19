/**
 * PythonEnvManager — 管理嵌入式 Python 环境 + pip 依赖自动安装
 *
 * 策略：
 * - 软件首次启动时自动检测 Python 环境是否就绪
 * - 未就绪 → 用户可在设置中一键安装（pip install -r requirements.txt）
 * - 安装进度通过 IPC 实时广播
 * - 生产环境使用 extraResources 中的嵌入式 Python
 */

import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { spawn, execSync } from 'child_process'

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

/** 检查依赖是否已安装（快速检查 index-tts） */
function checkDepsInstalled(pythonPath: string): boolean {
  try {
    execSync(`"${pythonPath}" -c "import index_tts" 2>&1`, {
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
  stage: 'preparing' | 'installing' | 'done' | 'error'
  percent: number           // 0-100
  currentPackage: string    // 当前正在安装的包名
  output: string            // 最近一行 pip 输出
  error?: string
}

/**
 * 执行 pip install -r requirements.txt
 * 解析 pip 输出，逐行广播进度
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

  onProgress({
    stage: 'preparing', percent: 0, currentPackage: '', output: '正在准备安装 Python 依赖...',
  })

  // 先升级 pip 确保兼容性
  try {
    await runPipCommand(pythonPath, ['install', '--upgrade', 'pip'], (output) => {
      onProgress({ stage: 'preparing', percent: 5, currentPackage: 'pip', output })
    })
  } catch {
    // 升级 pip 失败不影响后续安装
  }

  // 估算总包数，用于显示进度
  const totalPackages = 5 // torch, torchaudio, index-tts, fastapi, uvicorn
  let completed = 0

  return new Promise((resolve) => {
    const child = spawn(pythonPath, [
      '-m', 'pip', 'install',
      '-r', requirementsPath,
      '--progress-bar', 'off',
      '--no-warn-script-location',
      '-i', 'https://pypi.tuna.tsinghua.edu.cn/simple',  // 清华镜像源，国内加速
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })

    child.stdout.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (!line) return

      // 解析 pip 输出，提取包名
      let currentPackage = ''
      if (line.includes('Collecting ')) {
        const match = line.match(/Collecting\s+(\S+)/)
        if (match) {
          currentPackage = match[1]
          completed++
          const percent = Math.min(95, Math.round((completed / totalPackages) * 100))
          onProgress({
            stage: 'installing', percent, currentPackage, output: `正在安装 ${currentPackage}...`,
          })
          return
        }
      }

      if (line.includes('Successfully installed')) {
        onProgress({
          stage: 'installing', percent: 98, currentPackage: '', output: line,
        })
        return
      }

      // 普通日志行
      onProgress({
        stage: 'installing',
        percent: Math.min(95, 10 + completed * 15),
        currentPackage,
        output: line,
      })
    })

    child.stderr.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (line) {
        // pip 的一些输出走 stderr（正常现象）
        onProgress({
          stage: 'installing',
          percent: Math.min(95, 10 + completed * 15),
          currentPackage: '',
          output: line,
        })
      }
    })

    child.on('close', (code) => {
      if (code === 0) {
        onProgress({
          stage: 'done', percent: 100, currentPackage: '', output: 'Python 依赖安装完成！',
        })
        resolve(true)
      } else {
        onProgress({
          stage: 'error', percent: 0, currentPackage: '', output: '',
          error: `pip install 失败（退出码: ${code}）。请检查网络连接后重试。`,
        })
        resolve(false)
      }
    })

    child.on('error', (err) => {
      onProgress({
        stage: 'error', percent: 0, currentPackage: '', output: '',
        error: `启动 pip 失败: ${err.message}`,
      })
      resolve(false)
    })
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

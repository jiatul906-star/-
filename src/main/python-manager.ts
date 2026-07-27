/**
 * PythonManager — 管理 IndexTTS Python 子进程生命周期
 *
 * 启动策略：延迟启动（首次 TTS 请求时才启动，避免拖慢应用启动速度）
 * 崩溃恢复：自动重启，最多 3 次，避免无限重启
 * 优雅关闭：before-quit → SIGTERM → 等待 5s → SIGKILL
 */

import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import { existsSync } from 'fs'
import { getEmbeddedPythonPath, getServerScriptPath } from './python-env-manager'

const DEFAULT_PORT = 9876
const HEALTH_TIMEOUT_MS = 30_000   // 等待服务就绪的最大时间
const SHUTDOWN_GRACE_MS = 5_000    // SIGTERM 后等待时间
const MAX_RESTARTS = 3             // 崩溃自动重启上限
const HEALTH_POLL_MS = 500         // 健康检查轮询间隔

type Status = 'stopped' | 'starting' | 'running' | 'error'

interface PythonManagerEvents {
  onStatusChange?: (status: Status, message?: string) => void
}

export class PythonManager {
  private process: ChildProcess | null = null
  private port: number
  private status: Status = 'stopped'
  private restartCount = 0
  private device: string = 'auto'
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private events: PythonManagerEvents = {}
  private pythonPath: string
  private serverScript: string

  constructor(port: number = DEFAULT_PORT) {
    this.port = port
    this.pythonPath = getEmbeddedPythonPath()
    this.serverScript = getServerScriptPath()
  }

  // ===== 公开 API =====

  getStatus(): Status {
    return this.status
  }

  getPort(): number {
    return this.port
  }

  /** 启动 Python HTTP 服务（如果尚未运行） */
  async start(device: 'auto' | 'cpu' | 'cuda' = 'auto'): Promise<boolean> {
    this.device = device
    if (this.status === 'running') return true
    if (this.status === 'starting') {
      // 已经在启动中，等待就绪
      return this.waitForReady()
    }

    this.setStatus('starting', '正在启动语音引擎...')

    if (!existsSync(this.pythonPath)) {
      this.setStatus('error', `Python 环境未找到: ${this.pythonPath}`)
      return false
    }

    if (!existsSync(this.serverScript)) {
      this.setStatus('error', `TTS 服务脚本未找到: ${this.serverScript}`)
      return false
    }

    try {
      this.process = spawn(this.pythonPath, [this.serverScript, '--port', String(this.port), '--device', this.device], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) console.log(`[PythonManager] ${msg}`)
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) console.error(`[PythonManager:err] ${msg}`)
      })

      this.process.on('exit', (code, signal) => {
        console.log(`[PythonManager] 进程退出 code=${code} signal=${signal}`)
        this.process = null
        if (this.status === 'running' || this.status === 'starting') {
          this.setStatus('error', `语音引擎意外退出 (code=${code})`)
          this.tryRestart()
        }
      })

      this.process.on('error', (err) => {
        console.error('[PythonManager] spawn 失败:', err.message)
        this.process = null
        this.setStatus('error', `启动失败: ${err.message}`)
      })

      const ready = await this.waitForReady()
      return ready
    } catch (err: any) {
      this.setStatus('error', `启动异常: ${err.message}`)
      return false
    }
  }

  /** 停止 Python 服务 */
  async stop(): Promise<void> {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }

    if (!this.process) {
      this.setStatus('stopped')
      return
    }

    // 发送 shutdown 请求
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      await fetch(`http://localhost:${this.port}/shutdown`, {
        method: 'POST',
        signal: controller.signal,
      })
      clearTimeout(timeout)
    } catch {
      // /shutdown 端点可能不存在，忽略
    }

    // 等待进程退出
    const killed = await new Promise<boolean>((resolve) => {
      if (!this.process) { resolve(true); return }

      const timer = setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL')
        }
        resolve(true)
      }, SHUTDOWN_GRACE_MS)

      this.process!.on('exit', () => {
        clearTimeout(timer)
        resolve(true)
      })

      // 先尝试 SIGTERM
      this.process!.kill('SIGTERM')
    })

    this.process = null
    this.restartCount = 0
    this.setStatus('stopped')
  }

  /** 健康检查 */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const resp = await fetch(`http://localhost:${this.port}/health`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return resp.ok
    } catch {
      return false
    }
  }

  // ===== 事件回调 =====

  onStatusChange(cb: (status: Status, message?: string) => void): void {
    this.events.onStatusChange = cb
  }

  // ===== 内部方法 =====

  private setStatus(status: Status, message?: string): void {
    this.status = status
    this.events.onStatusChange?.(status, message)
  }

  private async waitForReady(): Promise<boolean> {
    const startTime = Date.now()
    while (Date.now() - startTime < HEALTH_TIMEOUT_MS) {
      const healthy = await this.healthCheck()
      if (healthy) {
        this.setStatus('running', '语音引擎就绪')
        this.restartCount = 0
        return true
      }
      await new Promise((r) => setTimeout(r, HEALTH_POLL_MS))
    }
    this.setStatus('error', '语音引擎启动超时')
    return false
  }

  private tryRestart(): void {
    if (this.restartCount >= MAX_RESTARTS) {
      console.log('[PythonManager] 已达最大重启次数，放弃重启')
      return
    }
    this.restartCount++
    console.log(`[PythonManager] ${this.restartCount}/${MAX_RESTARTS} 秒后尝试重启...`)
    this.restartTimer = setTimeout(() => {
      this.start()
    }, 2000)
  }

}

/** 全局单例 */
let instance: PythonManager | null = null

export function getPythonManager(): PythonManager {
  if (!instance) {
    instance = new PythonManager()
  }
  return instance
}

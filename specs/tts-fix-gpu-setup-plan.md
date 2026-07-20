
# TTS 修复 + GPU 检测安装方案

> 基于 `src/` 代码深度分析，2026-07-21

---

## 问题 1：TTS 语音播报失效

### 根因分析（共 3 个独立根因）

| # | 根因 | 文件 | 证据 |
|---|------|------|------|
| **A** | Python 服务器硬编码 `device="cuda"` | `python-server/tts_server.py:47` | `IndexTTS(model_dir=MODEL_DIR, device="cuda")` — 无 GPU / CUDA 未安装时模型加载直接崩溃 |
| **B** | 端口 9876 残留占用 → 无限重启循环 | `src/main/python-manager.ts` | 上次会话的 Python 进程未清理，新进程 `bind()` 失败 → 不断 retry，TTS 永远不可用 |
| **C** | PlaybackManager 使用独立 AudioContext，忽略用户音量设置 | `src/renderer/plugins/tts/playback-manager.ts:113-141` | 每个句子创建新的 AudioContext + GainNode 硬编码 0.8，完全不经过 `audio-context.ts` 的全局 GainNode（用户音量设置走的是全局 GainNode） |

### 修复方案

**A — 设备自适应（核心修复）**

修改 `python-server/tts_server.py`：
- 启动时检测 `torch.cuda.is_available()`
- 有 CUDA → `device="cuda"`（当前行为）
- 无 CUDA → `device="cpu"` + 打印提示 "未检测到 GPU，使用 CPU 推理（速度较慢）"
- 通过 CLI 参数 `--device auto|cpu|cuda` 允许主进程覆盖

修改 `src/main/python-manager.ts`：
- `start()` 增加可选参数 `device?: 'auto' | 'cpu' | 'cuda'`
- spawn 时传入 `--device auto`

**B — 端口占用处理**

修改 `src/main/python-manager.ts`：
- `start()` 中捕获 `exit` 事件的 `code=3`（端口占用），不再 retry
- 改为：检测端口是否被外部进程占用 → 是 → 杀掉占用者 → 重试
- 或者：自动切换端口（9876 → 9877 → 9878）并通知 IPC 层

修改 `src/main/index.ts`：
- `before-quit` 中确保 `PythonManager.stop()` 被执行（已存在，确认未失效）

**C — 统一 AudioContext 音量控制**

修改 `src/renderer/plugins/tts/playback-manager.ts`：
- 不再为每个句子创建独立 AudioContext
- 改为使用 `audio-context.ts` 中的全局 AudioContext + GainNode
- 增益从 GainNode 读取（用户在设置中拖动音量滑块 → `setVolume()` → GainNode）

---

## 问题 2：GPU 检测 + 一键安装插件

### 当前状态

已有基础设施（无需新建）：
- `detectGpu()` → `nvidia-smi` 检测 → 返回 `GpuInfo { ttsLevel: 'full'|'limited'|'unavailable' }`
- `TtsGpuStatus` 组件 → 展示 GPU 状态横幅（绿色/黄色/红色）
- `TtsPythonEnv` 组件 → 展示 Python 环境 + "安装依赖" 按钮
- `TtsModelManager` 组件 → 展示模型状态 + "下载模型" 按钮
- `checkPythonEnv()` / `installDependencies()` / `downloadModel()` 均已实现

**缺失的部分**：这些组件各自独立，没有串联起来。用户需要：
1. 点 GPU 状态 → 看到"安装"按钮
2. 一键点击 → 自动执行：GPU 检测 → Python 环境安装 → pip 依赖安装 → 模型下载 → 模型加载 → 服务启动

### 方案

**新增 IPC 通道：`tts:quickSetup`**

```
渲染进程 invoke('tts:quickSetup')
  → 主进程：
    1. detectGpu() → 确定 device 参数 (cuda/cpu)
    2. checkPythonEnv() → 如果 missing，报错让用户先装 Python
    3. installDependencies() → 实时进度通过 tts:pipInstallProgress 广播
    4. downloadModel() → 实时进度通过 tts:modelDownloadProgress 广播
    5. 返回 { success: true, device: 'cuda'|'cpu' }
```

**无需新增 preload 暴露**（进度监听已有现有通道）

**UI 改动（SettingsWindow.tsx）**

在 Voice 标签页顶部新增 `TtsQuickSetup` 组件，替代当前零散的三个横幅：

```
┌─ 语音功能状态 ─────────────────────────────┐
│  GPU: NVIDIA GeForce RTX 4060 (8GB) ✅      │
│  Python 环境: ✅ 就绪                        │
│  语音模型: ✅ 已下载 (2.3GB)                 │
│                                             │
│  状态：🟢 语音功能正常                        │
│         [重新检测]                           │
└─────────────────────────────────────────────┘

或（未安装时）：

┌─ 语音功能状态 ─────────────────────────────┐
│  GPU: ❌ 未检测到 NVIDIA 显卡               │
│  Python 环境: ❌ 未安装                     │
│  语音模型: ❌ 未下载                         │
│                                             │
│  状态：🔴 语音功能不可用                      │
│         [⚡ 一键安装 (CPU 版本)]              │
│         约需下载 2.3GB，首次安装需 10-20 分钟  │
└─────────────────────────────────────────────┘
```

组件 `TtsQuickSetup` 逻辑：
1. 挂载时调用 `getGpuInfo()` + `checkPythonEnv()` + `getModelStatus()` 汇总状态
2. 根据汇总结果显示不同按钮：
   - 全部就绪 → 绿色 "语音功能正常"
   - 有缺失 → 显示 "一键安装" 按钮（标注 CPU/CUDA 版本）
3. 点击一键安装 → 顺序调用 `checkPythonEnv → installDeps → downloadModel`
4. 进度条显示当前阶段 + 百分比

### 不新增 CSS 变量（遵守 design-system.md）

所有色值/间距从现有 CSS 变量读取，`settings.css` 中已有 `.tts-status-banner` 系列样式可直接复用。

---

## 影响范围汇总

| 文件 | 改动 | 风险 |
|------|------|------|
| `python-server/tts_server.py` | 添加 `--device` 参数 + GPU 自动检测 | 低，向后兼容 |
| `src/main/python-manager.ts` | `start()` 传入 device 参数；端口占用处理 | 中，涉及进程管理 |
| `src/main/ipc/index.ts` | 新增 `tts:quickSetup` handler | 低 |
| `src/renderer/plugins/tts/playback-manager.ts` | 使用全局 AudioContext | 中，需验证音量联动 |
| `src/renderer/components/SettingsWindow.tsx` | 新增 `TtsQuickSetup` 组件，重构 Voice 标签页 | 中，UI 改动 |
| `src/preload/index.ts` | 新增 `quickSetupTTS` 桥接 | 低 |
| `src/preload/index.d.ts` | 新增类型声明 | 低 |

---

## 建议执行顺序

1. **先修 A**（tts_server.py device 自适应）— 不依赖其他改动，独立验证
2. **再修 C**（PlaybackManager 音量）— 验证播放链路
3. **修 B**（端口占用）— 防止下次启动冲突
4. **最后做问题 2**（一键安装 UI）— 依赖前面修复稳定

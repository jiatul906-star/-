# TTS 修复 + GPU 检测安装方案

> 基于 src/ 代码深度分析，2026-07-21
> 最后更新：2026-07-21

---

## 问题 1：TTS 语音播报失效

### 根因分析（共 3 个独立根因）

| # | 根因 | 文件 | 证据 |
|---|------|------|------|
| **A** | Python 服务器硬编码 device="cuda" | python-server/tts_server.py:47 | IndexTTS(model_dir=MODEL_DIR, device="cuda") — 无 GPU / CUDA 未安装时模型加载直接崩溃 |
| **B** | 端口 9876 残留占用 → 无限重启循环 | src/main/python-manager.ts | 上次会话的 Python 进程未清理，新进程 ind() 失败 → 不断 retry，TTS 永远不可用 |
| **C** | PlaybackManager 使用独立 AudioContext，忽略用户音量设置 | src/renderer/plugins/tts/playback-manager.ts:113-141 | 每个句子创建新的 AudioContext + GainNode 硬编码 0.8，完全不经过 udio-context.ts 的全局 GainNode（用户音量设置走的是全局 GainNode） |
| **D** | TTS 模型下载进度条不动 | src/main/model-downloader.ts | 当 HuggingFace API 不可达时回退到硬编码文件列表（size 全为 0），	otalBytes = 0 导致 percent 始终为 0 |
| **E** | TTS 播放按钮无模型状态反馈 | src/renderer/components/ChatWindow.tsx | TtsPlayButton 只检查 	tsEnabled && ttsHealthy，模型未下载时用户不知道具体原因 |

### 修复状态

| # | 状态 | 修改文件 | 改动内容 |
|---|------|----------|----------|
| **A** | ❌ 待处理 | python-server/tts_server.py + src/main/python-manager.ts | 添加 --device 参数 + GPU 自动检测 |
| **B** | ❌ 待处理 | src/main/python-manager.ts | 端口占用处理 |
| **C** | ❌ 待处理 | src/renderer/plugins/tts/playback-manager.ts | 使用全局 AudioContext |
| **D** | ✅ **已完成** | src/main/model-downloader.ts | 当 	otalBytes 为 0（硬编码回退）时通过 content-length 动态估算总大小，进度百分比改为基于 effectiveTotal 计算 |
| **E** | ✅ **已完成** | src/main/ipc/index.ts + src/renderer/components/ChatWindow.tsx | 	ts:checkHealth 和 	ts:synthesize 均增加 isModelReady() 检查；TtsPlayButton 增加 modelReady 状态跟踪，提示信息细化到"模型未下载"/"功能未启用"/"服务不可用"三种情况 |

### 修复方案

**A — 设备自适应（核心修复）**

修改 python-server/tts_server.py：
- 启动时检测 	orch.cuda.is_available()
- 有 CUDA → device="cuda"（当前行为）
- 无 CUDA → device="cpu" + 打印提示 "未检测到 GPU，使用 CPU 推理（速度较慢）"
- 通过 CLI 参数 --device auto|cpu|cuda 允许主进程覆盖

修改 src/main/python-manager.ts：
- start() 增加可选参数 device?: 'auto' | 'cpu' | 'cuda'
- spawn 时传入 --device auto

**B — 端口占用处理**

修改 src/main/python-manager.ts：
- start() 中捕获 exit 事件的 code=3（端口占用），不再 retry
- 改为：检测端口是否被外部进程占用 → 是 → 杀掉占用者 → 重试
- 或者：自动切换端口（9876 → 9877 → 9878）并通知 IPC 层

修改 src/main/index.ts：
- efore-quit 中确保 PythonManager.stop() 被执行（已存在，确认未失效）

**C — 统一 AudioContext 音量控制**

修改 src/renderer/plugins/tts/playback-manager.ts：
- 不再为每个句子创建独立 AudioContext
- 改为使用 udio-context.ts 中的全局 AudioContext + GainNode
- 增益从 GainNode 读取（用户在设置中拖动音量滑块 → setVolume() → GainNode）

**D — 模型下载进度修复（已完成）**

修改 src/main/model-downloader.ts：
- 声明 knownTotalBytes = totalBytes 追踪已知总大小
- 当 	otalBytes 为 0 且第一个文件下载时获取到 content-length（_total 参数），用该文件大小 × 剩余文件数粗估总大小
- 百分比计算改为基于 effectiveTotal（knownTotalBytes > 0 ? knownTotalBytes : totalSoFar）
- 	otalMB 同理使用 knownTotalBytes 而非 	otalMB

**E — 模型状态反馈修复（已完成）**

修改 src/main/ipc/index.ts：
- 	ts:checkHealth 先检查 isModelReady()，模型未下载时直接返回 alse
- 	ts:synthesize 先检查 isModelReady()，模型未下载时 console.warn 并返回 
ull

修改 src/renderer/components/ChatWindow.tsx：
- TtsPlayButton 新增 modelReady 状态
- useEffect 中同时调用 getModelStatus() 获取模型状态
- canPlay = ttsEnabled && ttsHealthy && modelReady
- getTitle() 输出细化至 "语音功能未启用，请先在设置中开启" / "语音服务不可用，请检查服务状态" / "语音模型未下载，请先下载模型"

---

## 问题 2：GPU 检测 + 一键安装插件

### 当前状态

已有基础设施（无需新建）：
- detectGpu() → 
vidia-smi 检测 → 返回 GpuInfo { ttsLevel: 'full'|'limited'|'unavailable' }
- TtsGpuStatus 组件 → 展示 GPU 状态横幅（绿色/黄色/红色）
- TtsPythonEnv 组件 → 展示 Python 环境 + "安装依赖" 按钮
- TtsModelManager 组件 → 展示模型状态 + "下载模型" 按钮
- checkPythonEnv() / installDependencies() / downloadModel() 均已实现

**缺失的部分**：这些组件各自独立，没有串联起来。用户需要：
1. 点 GPU 状态 → 看到"安装"按钮
2. 一键点击 → 自动执行：GPU 检测 → Python 环境安装 → pip 依赖安装 → 模型下载 → 模型加载 → 服务启动

### 方案

**新增 IPC 通道：	ts:quickSetup**

`
渲染进程 invoke('tts:quickSetup')
  → 主进程：
    1. detectGpu() → 确定 device 参数 (cuda/cpu)
    2. checkPythonEnv() → 如果 missing，报错让用户先装 Python
    3. installDependencies() → 实时进度通过 tts:pipInstallProgress 广播
    4. downloadModel() → 实时进度通过 tts:modelDownloadProgress 广播
    5. 返回 { success: true, device: 'cuda'|'cpu' }
`

**无需新增 preload 暴露**（进度监听已有现有通道）

**UI 改动（SettingsWindow.tsx）**

在 Voice 标签页顶部新增 TtsQuickSetup 组件，替代当前零散的三个横幅：

`
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
`

组件 TtsQuickSetup 逻辑：
1. 挂载时调用 getGpuInfo() + checkPythonEnv() + getModelStatus() 汇总状态
2. 根据汇总结果显示不同按钮：
   - 全部就绪 → 绿色 "语音功能正常"
   - 有缺失 → 显示 "一键安装" 按钮（标注 CPU/CUDA 版本）
3. 点击一键安装 → 顺序调用 checkPythonEnv → installDeps → downloadModel
4. 进度条显示当前阶段 + 百分比

### 不新增 CSS 变量（遵守 design-system.md）

所有色值/间距从现有 CSS 变量读取，settings.css 中已有 .tts-status-banner 系列样式可直接复用。

---

## 影响范围汇总

| 文件 | 改动 | 风险 | 状态 |
|------|------|------|------|
| python-server/tts_server.py | 添加 --device 参数 + GPU 自动检测 | 低，向后兼容 | ❌ 待处理 |
| src/main/python-manager.ts | start() 传入 device 参数；端口占用处理 | 中，涉及进程管理 | ❌ 待处理 |
| src/main/ipc/index.ts | 新增 	ts:quickSetup handler；	ts:checkHealth/	ts:synthesize 增加模型检查 | 低 | ✅ 模型状态检查已完成，	ts:quickSetup 待处理 |
| src/renderer/plugins/tts/playback-manager.ts | 使用全局 AudioContext | 中，需验证音量联动 | ❌ 待处理 |
| src/renderer/components/ChatWindow.tsx | TtsPlayButton 增加模型状态检查 + 细化提示 | 低 | ✅ 已完成 |
| src/renderer/components/SettingsWindow.tsx | 新增 TtsQuickSetup 组件，重构 Voice 标签页 | 中，UI 改动 | ❌ 待处理 |
| src/common/types.ts | ModelDownloadProgress 移除 extracting；PipInstallProgress 补充 installing_indextts/downloading_indextts | 低 | ✅ 已完成 |
| src/preload/index.ts | 新增 quickSetupTTS 桥接 | 低 | ❌ 待处理 |
| src/preload/index.d.ts | 新增类型声明 | 低 | ❌ 待处理 |

---

## 建议执行顺序

1. ✅ ~~先修 A（tts_server.py device 自适应）— 不依赖其他改动，独立验证~~
2. ❌ 再修 C（PlaybackManager 音量）— 验证播放链路
3. ❌ 修 B（端口占用）— 防止下次启动冲突
4. ✅ ~~模型下载进度条修复（问题 D）— 已完成~~
5. ✅ ~~TTS 按钮模型状态反馈修复（问题 E）— 已完成~~
6. ❌ 最后做问题 2（一键安装 UI）— 依赖前面修复稳定

---

## 问题 3：语音组件数据路径显示

### 背景

软件分发给其他用户后，用户可能尚未安装语音相关组件（Python、TTS 模型等）。用户需要在设置界面中：
- 看到各组件的**数据存放地址**（知道文件会装到哪里）
- 从软件内部**一键安装**缺失的组件

当前 Voice 标签页虽然有一键安装按钮，但**完全没有展示各组件的实际路径**。用户遇到问题（模型加载失败、Python 找不到、参考音频路径错误）时毫无头绪，因为根本不知道数据存放在哪里。

### 要求

在设置界面 → 外观 → 声音（Voice）标签页中，**显示以下组件的完整数据路径**：

| # | 路径项 | 实际目录/文件 | 用途 |
|---|--------|-------------|------|
| 1 | **应用数据根目录** | %APPDATA%/ai-companion/ | 所有用户数据根目录 |
| 2 | **TTS 模型目录** | %APPDATA%/ai-companion/models/index-tts/ | IndexTTS 模型文件（~2.3GB） |
| 3 | **Python 可执行文件** | 开发环境 python-dist/python.exe / 打包环境 
esources/python/python.exe | 嵌入式 Python |
| 4 | **TTS 服务脚本** | python-server/tts_server.py | IndexTTS HTTP 服务入口 |
| 5 | **Python 依赖清单** | python-server/requirements.txt | pip 依赖列表 |
| 6 | **TTS 设置文件** | %APPDATA%/ai-companion/tts-settings.json | 全局语音设置 |
| 7 | **参考音频** | %APPDATA%/ai-companion/character/{角色名}/ref_voice.wav | 当前角色的音色参考 |
| 8 | **角色数据目录** | %APPDATA%/ai-companion/character/ | 所有角色配置/图片/视频 |
| 9 | **模型下载缓存** | %APPDATA%/ai-companion/index-tts.tar.gz | 下载中的临时文件 |

### 交互设计

在 Voice 标签页的一键安装卡片（TtsQuickSetup）**下方**，增加一个 **"数据目录详情"** 折叠面板：

`
┌─ 语音功能状态 ─────────────────────────────┐
│  ...（GPU/Python/模型状态 + 安装按钮）      │
└───────────────────────────────────────────┘

  ▶ 数据目录详情               ← 点击展开/折叠

展开后：

  ▼ 数据目录详情
  ┌──────────────────────────────────────────┐
  │  应用数据根目录    C:\Users\...\ai-companion\
  │  TTS 模型目录      C:\Users\...\models\index-tts\
  │  Python 可执行文件  C:\...\python-dist\python.exe
  │  TTS 服务脚本      C:\...\python-server\tts_server.py
  │  依赖清单          C:\...\python-server\requirements.txt
  │  TTS 设置文件      C:\...\tts-settings.json
  │  参考音频路径      C:\...\character\小桃\ref_voice.wav
  │  角色数据目录      C:\...\character\
  │  下载缓存          C:\...\index-tts.tar.gz
  └──────────────────────────────────────────┘
`

### 技术要点

- **默认折叠**，不干扰主流程。用户想看路径时点击展开即可
- 所有路径显示为**等宽字体**（Consolas / Cascadia Code），方便复制
- 路径文本设置 user-select: all，**点击即可全选 → Ctrl+C 复制**
- 参考音频路径**跟随当前角色切换**，切换到小蓝后自动更新为 character/小蓝/ref_voice.wav
- 采用主进程 	ts:getDataPaths IPC handler 一次性返回所有路径对象，渲染进程挂载时调用

### 设计原则

- **不新增硬编码色值**：所有样式使用 settings.css 中已有的 CSS 变量
- **不影响用户操作流**：默认折叠，不抢焦点，不阻塞安装按钮
- **零门槛**：不需要用户手动翻找文件夹，路径一目了然

### 影响范围

| 文件 | 改动 | 状态 |
|------|------|------|
| src/main/ipc/index.ts | 新增 	ts:getDataPaths handler | ❌ 待处理 |
| src/preload/index.ts | 新增 getTtsDataPaths 桥接 | ❌ 待处理 |
| src/preload/index.d.ts | 新增类型声明 | ❌ 待处理 |
| src/renderer/components/SettingsWindow.tsx | Voice 标签页中 TtsQuickSetup 下方新增 TtsDataPaths 组件 | ❌ 待处理 |
| src/renderer/components/settings.css | 新增路径展示相关样式 | ❌ 待处理 |
| src/common/types.ts | 新增 TtsDataPaths 接口定义 | ❌ 待处理 |

### 验收标准

1. Voice 标签页 → 点击 "数据目录详情" → 展开显示 9 条完整路径
2. 每条路径与文件系统实际位置一致
3. 点击路径文字可选中复制
4. 切换角色 → 参考音频路径自动更新
5. 安装组件前后，路径显示不变（路径在安装前就能看到，用户可以手动检查/准备）

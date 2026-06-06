# 技术架构

> 状态：初稿（待程序员审阅） | 最后更新：2026-06-06

---

## 一、技术栈

| 层 | 选型 | 说明 |
|----|------|------|
| 桌面框架 | Electron | 版本待定（脚手架已搭建） |
| 渲染 | React | 版本待定 |
| 构建 | electron-builder | 打包 Windows 安装包 |
| 主题 | CSS 自定义属性 | 5 主题 × 2 明暗 = 10 套配色 |
| TTS 引擎 | IndexTTS (Python) | 子进程 HTTP 服务，零样本语音克隆 |
| 持久化 | 待定 | localStorage 或 electron-store |

---

## 二、架构总览

```
┌─────────────────────────────────────────────────┐
│                  Electron 主进程                  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ 窗口管理器 │  │ IPC 中枢 │  │ Python 子进程  │  │
│  │          │  │          │  │ (IndexTTS)    │  │
│  │ 创建/销毁 │  │ 消息路由 │  │ localhost:PORT │  │
│  │ 位置同步  │  │ 广播/点对点│  │ POST /tts     │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│        │             │               │           │
├────────┼─────────────┼───────────────┼───────────┤
│        │             │               │           │
│  渲染进程（共享）      │               │           │
│        │             │               │           │
│  ┌─────┴─────────────┴───────────────┴─────────┐ │
│  │              壳 (core/)                      │ │
│  │  ┌─────────────────────────────────────┐    │ │
│  │  │         插件系统                      │    │ │
│  │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌────┐ │    │ │
│  │  │  │ chat │ │ diy  │ │ tts  │ │pet │ │    │ │
│  │  │  └──────┘ └──────┘ └──────┘ └────┘ │    │ │
│  │  └─────────────────────────────────────┘    │ │
│  │  ┌──────────┐ ┌────────┐ ┌──────────────┐  │ │
│  │  │ 事件总线  │ │ 数据层  │ │ 主题引擎     │  │ │
│  │  └──────────┘ └────────┘ └──────────────┘  │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 关键设计决策

**插件共享渲染进程**。不做进程隔离——唯一开发者，所有插件可控。省掉插件间 IPC 开销，通过壳层事件总线通信。

**桌宠不过是一个独立的 BrowserWindow，不是独立的插件进程**。它加载和主窗口相同的渲染代码，但 `transparent + alwaysOnTop + frame: false`。

---

## 三、窗口架构

三个窗口载体：

| 窗口 | 技术 | 生命周期 |
|------|------|---------|
| **主窗口** | BrowserWindow（frameless, 420×600 默认, 320×360 最小, 可拖拽调大小） | 应用启动到退出 |
| **桌宠窗口** | BrowserWindow（transparent, alwaysOnTop, frame: false, 尺寸跟随素材） | 首次选择角色后创建，退出时销毁 |
| **设置弹窗** | 主窗口内 CSS overlay | 打开到关闭，非独立 BrowserWindow |

### 窗口 z-order

```
桌宠窗口 (alwaysOnTop, skipTaskbar)
    ↑ 始终在上
主窗口 (normal)
    ↑ 正常层级
其他桌面窗口
```

### 桌宠-主窗口位置同步

```
主窗口 move/resize 事件
  → IPC: window:moved / window:resized
    → 桌宠窗口 setBounds({ x, y })
      → CSS transition 300ms ease-out
```

桌宠骑乘态时跟随主窗口，拖拽脱离后停止跟随。

---

## 四、模块拆分

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts             # 入口：创建窗口、注册 IPC
│   ├── window-manager.ts    # 窗口创建/销毁/位置同步
│   ├── ipc-bridge.ts        # IPC 通道注册与路由
│   └── tts-service.ts       # Python 子进程管理 + HTTP 通信
│
├── core/                    # 壳（渲染进程）
│   ├── event-bus.ts         # 插件间事件总线
│   ├── theme.ts             # 主题引擎（setTheme/setMode/setDensity/getCurrent + localStorage）
│   ├── data-store.ts        # 数据层（角色/设置/聊天记录 CRUD + 持久化）
│   └── ipc-client.ts        # 渲染进程 ↔ 主进程 IPC 封装
│
├── plugins/                 # 插件（每个插件 export 一个对象）
│   ├── chat/                # 聊天插件
│   │   ├── index.ts         #   导出 ChatPlugin
│   │   ├── components/      #   气泡/消息列表/输入框/流式光标
│   │   └── api.ts           #   AI API 调用（OpenAI 兼容接口）
│   ├── pet/                 # 桌宠插件
│   │   ├── index.ts         #   导出 PetPlugin
│   │   ├── components/      #   帧动画/SpeechBubble/交互菜单
│   │   └── state-machine.ts #   动画状态机
│   ├── diy/                 # DIY 角色编辑插件
│   │   ├── index.ts
│   │   └── components/      #   外观/性格/声音三个标签页
│   ├── settings/            # 设置插件
│   │   ├── index.ts
│   │   └── components/      #   AI 设置 / 界面外观
│   └── tts/                 # TTS 控制插件
│       ├── index.ts
│       └── audio-player.ts  #   流式播放 + 打断策略
│
└── shared/                  # 公共
    ├── types.ts             # 类型定义（角色/AI配置/主题配置/消息）
    ├── ipc-channels.ts      # IPC 通道名常量
    └── constants.ts         # 默认值/预设角色/默认主题
```

### 模块职责边界

| 模块 | 拥有 | 不拥有 |
|------|------|--------|
| core/event-bus | 插件间消息路由 | 不处理业务逻辑 |
| core/theme | CSS 变量写入 + localStorage | 不管理 UI 组件 |
| core/data-store | 角色/设置/聊天记录 CRUD | 不直接操作 DOM |
| plugins/chat | 消息收发、气泡渲染 | 不管桌宠动画、不管设置 |
| plugins/pet | 帧动画、交互、状态机 | 不管聊天内容、不管 API |
| plugins/diy | 角色编辑表单 | 不管聊天、不管桌宠行为 |
| plugins/tts | TTS 触发与播放控制 | 不管文本来源、不管角色切换 |

---

## 五、数据流

### 5.1 发送一条消息的完整路径

```
用户输入 "你好"
  → InputBar (plugins/chat)
  → ChatPlugin.sendMessage("你好")
  → api.ts: fetch(API_URL, { messages: [...history, "你好"] })
  → 流式响应 → 逐字写入 MessageList
  → 如果 TTS 开启：
      ChatPlugin → event-bus.emit('tts:play', { text, characterId })
      → TTSPlugin → ipc-client → 主进程 → Python HTTP → IndexTTS
      → mp3 buffer → IPC → renderer → HTML5 Audio 播放
      → 同时 event-bus.emit('pet:animate', { state: 'talk' })
```

### 5.2 切换角色

```
用户点击侧栏头像
  → Sidebar → event-bus.emit('character:switch', { characterId })
  → data-store: 更新当前角色
  → theme: 如果角色的主题偏好不同，切换主题
  → IPC: pet:sync-character → 桌宠窗口更新角色形象
  → ChatPlugin: 重新加载该角色的聊天历史
```

### 5.3 数据持久化

```
用户操作（修改设置/新建角色/发消息）
  → 对应的 core/data-store 方法
  → 写内存状态
  → 写 localStorage（同步）
  → 如果数据量增大，后续可迁移到 electron-store

退出时：
  before-quit → data-store.flush() → 确保所有数据已写入
```

---

## 六、插件系统规范

每个插件 export 一个对象：

```typescript
interface Plugin {
  id: string;                    // 唯一标识
  name: string;                  // 显示名
  components: Record<string, React.ComponentType>;  // 注册到壳的组件
  activate: (ctx: PluginContext) => void;   // 插件激活时调用
  deactivate: () => void;                   // 插件停用时调用
}

interface PluginContext {
  eventBus: EventBus;            // 发/收事件
  dataStore: DataStore;          // 读写数据
  theme: ThemeEngine;            // 读写主题
  ipc: IpcClient;                // 主进程通信
}
```

插件通过 `import()` 动态加载，非独立构建。加载顺序：core → chat → pet → diy → settings → tts。

---

## 七、TTS 集成架构

```
Electron 主进程
  ├── 启动时 spawn Python 子进程
  │     python -m index_tts --port 9876
  ├── 等待 HTTP 服务就绪（轮询 /health 或等待 stdout 信号）
  ├── 主窗口 renderer 请求 TTS：
  │     POST http://localhost:9876/tts
  │     { text: "你好", reference_audio: "<角色音频路径>" }
  │     → 返回 audio/mpeg buffer
  ├── buffer 通过 IPC 传回 renderer
  └── renderer: HTML5 Audio 播放

退出时：
  before-quit → 发送 shutdown 信号给 Python → 等待进程退出 → 强制 kill（超时 5s）
```

**GPU 检测**（启动时）：
```
检测 CUDA 可用性
  ├── NVIDIA + VRAM ≥ 8G  → 启用 TTS（正常模式）
  ├── NVIDIA + VRAM 4-6G  → 启用 TTS（标注"可能较慢"）
  └── 无 NVIDIA / VRAM < 4G → TTS 功能灰掉 + 提示
```

---

## 八、构建与打包

```
开发环境：
  electron .    （主进程 + renderer）
  renderer 用 Vite 或 webpack HMR

生产打包（electron-builder）：
  ├── ASAR: src/ 中所有 JS/CSS/HTML
  ├── extraResources:
  │   ├── python/               # 嵌入式 Python 运行时
  │   ├── index_tts/            # IndexTTS 模型 + 代码
  │   └── reference_audio/      # 4 个角色的参考音频
  └── 最终安装包 ~3-5GB
```

**待确定**：Python 是打包进安装包还是首次启用 TTS 时下载？如果打包，安装包 > 3GB。如果延迟下载，需处理下载失败/中断/进度提示。

---

## 九、架构约束（不可违反）

1. **插件不直接调用其他插件的内部函数**。跨插件通信只走 event-bus。
2. **渲染进程不直接操作文件系统**。文件读写通过 IPC 走主进程。
3. **所有 UI 值从 CSS 变量读取**。插件代码中不出现硬编码色值/间距。
4. **IPC 通道名统一在 `shared/ipc-channels.ts` 定义**。不允许在代码中手写通道名字符串。
5. **`src/` 是唯一真相源**。构建产物从 src/ 生成，不手动修改 ASAR。

---

## 十、待程序员确认

| # | 待定项 | 选项 | 
|---|--------|------|
| 1 | 持久化方案 | localStorage（简单）vs electron-store（更可靠） |
| 2 | 状态管理 | React Context + useReducer vs zustand |
| 3 | 构建工具 | Vite vs webpack |
| 4 | TTS 模型分发 | 打包进安装包 vs 首次使用时下载 |
| 5 | Electron 版本 | 待定 |
| 6 | React 版本 | 待定 |

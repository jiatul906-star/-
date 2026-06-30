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
| **主窗口** | BrowserWindow（frameless, 960×680 默认, 680×480 最小, 可拖拽调大小） | 应用启动到退出 |
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

> ⚠️ **初稿已过时。** 以下为计划中的目录结构。**实际代码结构以 `ag.md` 和 `src/` 为准。** 关键差异：
> - `src/core/` → 实际为 `src/renderer/core/`
> - `src/shared/` → 实际为 `src/common/`
> - `main/window-manager.ts` → 实际未拆分，逻辑在 `main/index.ts` + `main/ipc/index.ts` + `main/windows/*.ts`
> - 插件系统实际使用有限，功能代码主要在 `renderer/components/` 和 `renderer/stores/`

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts             # 入口：创建窗口、注册 IPC
│   ├── ipc/index.ts         # IPC 通道注册与路由（含持久化逻辑）
│   └── windows/             # chat.ts / pet.ts / settings.ts
│
├── renderer/                # 渲染进程
│   ├── App.tsx              # 根组件（hash 路由）
│   ├── main.tsx             # React 入口
│   ├── core/                # event-bus.ts / plugin.ts
│   ├── plugins/             # chat(✅) / diy(空壳) / pet(空壳) / tts(空壳)
│   ├── stores/pet-store.ts  # Zustand 全局状态
│   └── components/          # ChatWindow / PetWindow / SettingsWindow / ContextMenu 等
│
├── preload/                 # contextBridge → window.electronAPI
└── common/types.ts          # 公共类型定义
```

### 模块职责边界

> ⚠️ 以下为设计意图，实际实现可能不同。以 `src/` 中代码为准。

| 模块 | 拥有 | 不拥有 |
|------|------|--------|
| renderer/core/event-bus | 插件间消息路由 | 不处理业务逻辑 |
| renderer/stores/pet-store | Zustand 全局状态（角色、动作、API配置） | 不直接操作 DOM |
| main/ipc/index.ts | IPC 通道注册 + JSON 文件持久化 | 不处理渲染逻辑 |
| renderer/plugins/chat | 消息收发、AI API 调用 | 不管桌宠动画、不管设置 |
| renderer/components/ChatWindow | 聊天 UI 渲染 | 不管 API 调用细节 |
| renderer/components/SettingsWindow | 设置 UI（角色编辑/API配置/外观） | 不管聊天、不管桌宠行为 |
| renderer/components/PetWindow | 桌宠渲染 + 右键菜单交互 | 不管聊天历史、不管 AI 调用 |

---

## 五、数据流

> ⚠️ **实际数据流**：以 `bug/开发速查手册.md` 第五节"AI 调用流程"和第六节"状态管理模式"为准。下方为设计原稿，保留供参考。

### 5.1 发送一条消息的完整路径（实际）

```
用户输入 "你好"
  → ChatWindow 输入框
  → sendMessage() (ChatWindow.tsx)
  → buildSystemPrompt(activeChar, memories) (chat/api.ts)
  → streamChat(messages, profile, systemPrompt) (chat/api.ts)
  → SSE 流式响应 → 逐字写入消息列表
  → 完成后 addChatMessage() 持久化 (IPC → main → chat-history.json)
```

### 5.2 切换角色（实际）

```
用户点击侧栏头像
  → setActiveCharacter(id) (Zustand store)
  → 聊天窗口重新加载该角色的聊天历史
  → IPC broadcast (characters:updated) → 其他窗口同步
  → 桌宠形象跟随变化（通过 Zustand store 共享 activeCharacterId）
```

### 5.3 数据持久化（实际）

```
用户操作（修改设置/新建角色/发消息）
  → IPC invoke (renderer → main)
  → main/ipc/index.ts: 写 JSON 文件到 %APPDATA%/ai-companion/
  → IPC send 广播到所有窗口（characters:updated / api-profiles:updated 等）
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

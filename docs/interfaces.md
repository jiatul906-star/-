# 模块间接口契约

> 状态：初稿（待程序员审阅） | 最后更新：2026-06-06

本文档定义每个模块的输入和输出。任何模块的内部实现可以自由修改，但**接口签名不能变**。修改接口前必须更新本文档并同步所有调用方。

---

## 一、IPC 通道定义

所有通道名常量定义在 `src/shared/ipc-channels.ts`。

### 1.1 主窗口 ↔ 桌宠窗口

| 通道名 | 方向 | 载荷 | 触发时机 |
|--------|------|------|---------|
| `pet:sync-character` | 主→宠 | `{ characterId: string, character: Character }` | 角色切换、角色数据更新 |
| `pet:set-state` | 主→宠 | `{ state: PetState }` | 窗口状态变化（打开/关闭/最小化/最大化） |
| `pet:set-position` | 主→宠 | `{ x: number, y: number }` | 主窗口移动/缩放，桌宠需要跟随 |
| `pet:position-changed` | 宠→主 | `{ x: number, y: number }` | 用户拖拽桌宠到新位置 |
| `pet:interaction` | 宠→主 | `{ type: 'poke' \| 'headpat' \| 'right-click' \| 'double-click', characterId: string }` | 用户与桌宠交互 |

### 1.2 渲染进程 ↔ 主进程

| 通道名 | 方向 | 载荷 | 返回 |
|--------|------|------|------|
| `tts:generate` | 渲染→主 | `{ text: string, characterId: string }` | `{ audioBuffer: ArrayBuffer }` |
| `tts:status` | 主→渲染 | `{ available: boolean, reason?: string }` | — |
| `file:upload-image` | 渲染→主 | `{ sourcePath: string }` | `{ savedPath: string, dataUrl: string }` |
| `file:get-user-data-path` | 渲染→主 | — | `{ path: string }` |
| `app:quit` | 渲染→主 | — | — |
| `app:get-gpu-info` | 渲染→主 | — | `{ hasNvidia: boolean, vramMB: number }` |
| `tray:update-icon` | 渲染→主 | `{ imageDataUrl: string }` | — |

---

## 二、事件总线（插件间通信）

插件不直接引用其他插件，通过 `core/event-bus` 收发事件。

### 事件列表

| 事件名 | 发出者 | 载荷 | 说明 |
|--------|--------|------|------|
| `character:switch` | Sidebar / Tray | `{ characterId: string }` | 切换当前活跃角色 |
| `character:created` | diy plugin | `{ character: Character }` | 新建角色完成 |
| `character:updated` | diy plugin | `{ characterId: string, changes: Partial<Character> }` | 角色数据修改 |
| `character:deleted` | diy plugin | `{ characterId: string }` | 角色被删除 |
| `message:send` | InputBar | `{ text: string, characterId: string }` | 用户发送消息 |
| `message:received` | chat plugin (api) | `{ message: Message }` | AI 返回完整消息 |
| `message:streaming` | chat plugin (api) | `{ characterId: string, text: string, isComplete: boolean }` | 流式输出中，逐 token |
| `tts:play` | chat plugin | `{ text: string, characterId: string }` | 请求播放 TTS |
| `tts:stop` | chat plugin | — | 打断当前播放 |
| `tts:playing` | tts plugin | `{ characterId: string, progress: number }` | 播放进度 |
| `tts:complete` | tts plugin | `{ characterId: string }` | 播放完成 |
| `pet:animate` | 任意插件 | `{ characterId: string, animation: AnimationName }` | 请求桌宠播动画 |
| `theme:changed` | theme engine | `{ theme: string, mode: 'light' \| 'dark' }` | 主题切换 |
| `window:state-changed` | window manager | `{ state: 'normal' \| 'minimized' \| 'maximized' \| 'closed' }` | 主窗口状态变化 |
| `settings:open` | 任意插件 | `{ tab?: string }` | 打开设置弹窗，可选指定标签 |
| `settings:close` | settings plugin | — | 关闭设置弹窗 |

### 使用方式

```typescript
// 发出事件
eventBus.emit('character:switch', { characterId: 'xiaotao' });

// 订阅事件
eventBus.on('character:switch', ({ characterId }) => {
  // 更新 UI
});

// 取消订阅（插件 deactivate 时必须调用）
eventBus.off('character:switch', handler);
```

---

## 三、数据层接口

### 3.1 DataStore

```typescript
interface DataStore {
  // 角色 CRUD
  getCharacters(): Character[];
  getCharacter(id: string): Character | null;
  getActiveCharacter(): Character | null;
  createCharacter(data: CreateCharacterInput): Character;
  updateCharacter(id: string, changes: Partial<Character>): void;
  deleteCharacter(id: string): void;
  setActiveCharacter(id: string): void;

  // 聊天记录
  getChatHistory(characterId: string): Message[];
  addMessage(characterId: string, message: Message): void;
  clearHistory(characterId: string): void;

  // 设置
  getSettings(): AppSettings;
  updateSettings(changes: Partial<AppSettings>): void;
}
```

### 3.2 localStorage 键名

| 键 | 值类型 | 说明 |
|----|--------|------|
| `characters` | `Character[]` | 所有角色数据 |
| `activeCharacterId` | `string` | 当前选中角色 ID |
| `chatHistory:{characterId}` | `Message[]` | 每个角色的聊天记录 |
| `settings` | `AppSettings` | 应用设置（API/主题/密度） |

**注意**：键名格式统一。所有键名常量定义在 `src/shared/constants.ts`。

---

## 四、主题引擎接口

```typescript
// src/core/theme.ts

interface ThemeEngine {
  setTheme(name: ThemeName): void;
  // 'peach' | 'mint' | 'lavender' | 'coffee' | 'sakura'
  // → 写入 <html class="theme-{name}">
  // → 所有 CSS 变量对应色系值

  setMode(mode: 'light' | 'dark'): void;
  // → 叠加 <html class="dark">（暗色时）
  // → 移除 dark class（浅色时）

  setDensity(density: 'comfort' | 'compact'): void;
  // → <html class="density-{mode}">

  getCurrent(): { theme: ThemeName; mode: 'light' | 'dark'; density: 'comfort' | 'compact' };
}

type ThemeName = 'peach' | 'mint' | 'lavender' | 'coffee' | 'sakura';
```

---

## 五、TTS HTTP 服务接口

IndexTTS Python 子进程监听 `localhost:9876`。

### POST /tts

**请求**：
```json
{
  "text": "你好，今天天气不错",
  "reference_audio": "E:\\app\\reference_audio\\xiaotao_ref.wav"
}
```

**成功响应**：
```
HTTP 200
Content-Type: audio/mpeg
{binary mp3 data}
```

**错误响应**：
```json
{
  "error": "cuda_out_of_memory",
  "message": "显存不足"
}
```

### GET /health

**成功响应**：
```json
{
  "status": "ready",
  "gpu": "NVIDIA GeForce RTX 3060",
  "vram_total_mb": 12288,
  "vram_free_mb": 8192
}
```

### Python 进程生命周期

```
启动：Electron 主进程 spawn('python', ['-m', 'index_tts', '--port', '9876'])
等待：轮询 GET /health（间隔 500ms，最多等 30s）
      → 超时 → 弹错误提示，TTS 功能不可用
      → 就绪 → 注册 tts:generate IPC handler
关闭：app.on('before-quit') → POST /shutdown → 等 5s → kill
```

---

## 六、数据类型

### 6.1 Character

```typescript
interface Character {
  id: string;                   // UUID
  name: string;                 // 角色名
  isDefault: boolean;           // 是否为官方预制角色（不可删除）
  
  // 外观
  standImage: string;           // 立绘（data URL 或文件路径）
  avatarImage: string;          // 圆形头像
  petImage: string;             // 桌宠本体图（透明背景）
  
  // 桌宠动画帧（可选，无素材时降级为静态图）
  petAnimations?: {
    idle: string[];             // 帧图 data URLs 或路径
    blink: string[];
    talk: string[];
    grabbed: string;
    jump_on: string[];
    jump_off: string[];
    react_happy: string[];
    react_shy: string[];
    react_angry: string[];
    think: string[];
    sad: string[];
    silent: string[];
  };

  // 性格
  personalityTags: string[];    // ["温柔", "话唠"]
  personalityText: string;      // 自由文本描述

  // 声音
  referenceAudio: string;       // 参考音频路径（3-5秒）
  voiceSpeed: number;           // 语速 0.5-2.0，默认 1.0
  voicePitch: number;           // 音调 0.5-2.0，默认 1.0
  voiceVolume: number;          // 音量 0.0-1.0，默认 0.8

  // 元数据
  createdAt: number;            // timestamp
  updatedAt: number;            // timestamp
}
```

### 6.2 Message

```typescript
interface Message {
  id: string;                   // UUID
  characterId: string;          // 属于哪个角色的对话
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}
```

### 6.3 AppSettings

```typescript
interface AppSettings {
  // AI
  apiUrl: string;               // OpenAI 兼容 API endpoint
  apiKey: string;               // API Key
  model: string;                // 模型名（由 API 决定可用值）

  // 界面
  theme: ThemeName;
  mode: 'light' | 'dark';
  density: 'comfort' | 'compact';

  // TTS
  ttsEnabled: boolean;          // 全局 TTS 开关
}
```

### 6.4 预制角色数据

4 个官方角色（`isDefault: true`，不可删除）：

| 角色 | 性格标签 | 性格描述 |
|------|---------|---------|
| 小桃 | 元气, 活泼 | 阳光开朗的少女，说话充满活力，喜欢用感叹号 |
| 小黑 | 傲娇, 毒舌 | 表面冷淡嘴巴不饶人，其实内心很关心你 |
| 小雪 | 温柔, 安静 | 说话轻柔，善解人意，像冬日里的暖茶 |
| 小灰 | 冷淡, 理性 | 话不多但句句到位，逻辑清晰，偶尔蹦出冷笑话 |

---

## 七、插件接口规范

每个插件目录下的 `index.ts` 必须 export：

```typescript
export const plugin: Plugin = {
  id: 'chat',                              // 唯一，与目录名一致
  name: '聊天',                             // 显示名
  components: {
    ChatArea: ChatAreaComponent,            // 注册到壳的组件
    InputBar: InputBarComponent,
    // 壳通过 plugin.components['ChatArea'] 获取组件
  },
  activate(ctx: PluginContext) {
    // 订阅事件、初始化状态
    ctx.eventBus.on('character:switch', this.onCharacterSwitch);
  },
  deactivate() {
    // 取消订阅、清理状态
  }
};
```

**规则**：
- `activate` 在壳初始化时调用（按依赖顺序）
- `deactivate` 在应用退出或插件热替换时调用
- 插件不持有其他插件的引用，只能通过 `ctx.eventBus` 通信
- 插件的 React 组件通过壳的组件注册表被渲染，不自己挂载到 DOM

---

## 八、接口变更流程

1. 修改本文档对应的接口定义
2. `git grep` 搜索所有调用方
3. 更新所有调用方
4. commit message 格式：`interface: 变更描述`
5. 程序员审阅 → 合并

**Breaking change 必须在 commit message 中标注 `BREAKING:`**。

# 模块间接口契约

> 状态：初稿（待程序员审阅） | 最后更新：2026-06-06

本文档定义每个模块的输入和输出。任何模块的内部实现可以自由修改，但**接口签名不能变**。修改接口前必须更新本文档并同步所有调用方。

---

## 一、IPC 通道定义

> ⚠️ **权威源**：所有 IPC 通道以 `src/main/ipc/index.ts`（主进程注册）和 `src/preload/index.ts`（渲染进程暴露）为准。本节仅列概要，写代码前必须读取这两个文件。

### 渲染进程 ↔ 主进程

所有 API 通过 `window.electronAPI` 暴露，参见 `src/preload/index.ts`。

#### 窗口控制
| API | IPC 通道 | 说明 |
|-----|----------|------|
| `electronAPI.minimize()` | `window:minimize` | 最小化当前窗口 |
| `electronAPI.maximize()` | `window:maximize` | 最大化/还原 |
| `electronAPI.close()` | `window:close` | 关闭当前窗口 |
| `electronAPI.quit()` | `app:quit` | 退出应用 |

#### 桌宠
| API | IPC 通道 | 说明 |
|-----|----------|------|
| `electronAPI.movePet(dx, dy)` | `window:movePet` | 拖拽移动桌宠窗口 |
| `electronAPI.resizePet(expand, cx, cy)` | `window:resizePet` | 扩/缩桌宠窗口 |
| `electronAPI.togglePetPassthrough()` | `window:togglePetPassthrough` | 切换鼠标穿透 |

#### 角色持久化
| API | IPC 通道 | 说明 |
|-----|----------|------|
| `electronAPI.getCharacters()` | `character:getAll` | 读取全部角色 |
| `electronAPI.saveCharacters(data)` | `character:saveAll` | 保存并广播 |
| `electronAPI.onCharactersUpdated(cb)` | `characters:updated` | 订阅角色变更 |

#### API Profiles
| API | IPC 通道 | 说明 |
|-----|----------|------|
| `electronAPI.getApiProfiles()` | `api-profiles:getAll` | 读取全部 API Profile |
| `electronAPI.saveApiProfiles(data)` | `api-profiles:saveAll` | 保存并广播 |
| `electronAPI.testApiConnection(profile)` | `api-profiles:test` | 测试 API 连接 |
| `electronAPI.onApiProfilesUpdated(cb)` | `api-profiles:updated` | 订阅配置变更 |

#### 聊天历史
| API | IPC 通道 | 说明 |
|-----|----------|------|
| `electronAPI.getChatHistory(charId)` | `chat-history:get` | 读取角色聊天历史 |
| `electronAPI.addChatMessage(charId, msg)` | `chat-history:add` | 追加消息 |
| `electronAPI.clearChatHistory(charId)` | `chat-history:clear` | 清除历史 |

#### 智能体记忆
| API | IPC 通道 | 说明 |
|-----|----------|------|
| `electronAPI.getAgentMemory(charId)` | `agent-memory:getAll` | 读取记忆列表 |
| `electronAPI.addAgentMemory(charId, entry)` | `agent-memory:add` | 添加记忆 |
| `electronAPI.deleteAgentMemory(charId, id)` | `agent-memory:delete` | 删除记忆 |
| `electronAPI.updateAgentMemory(charId, id, content)` | `agent-memory:update` | 更新记忆内容 |

#### 桌宠动作
| API | IPC 通道 | 说明 |
|-----|----------|------|
| `electronAPI.getPetActions()` | `pet-actions:getAll` | 读取动作列表 |
| `electronAPI.savePetActions(actions)` | `pet-actions:save` | 保存动作列表 |

#### 文件对话框
| API | IPC 通道 | 说明 |
|-----|----------|------|
| `electronAPI.openImageDialog(charId)` | `dialog:openImage` | 选择角色形象图片 |
| `electronAPI.openVideoDialog()` | `dialog:openVideo` | 选择动作绑定视频 |
| `electronAPI.getPetImage(charId)` | `pet-image:getCurrent` | 读取已保存形象 |
| `electronAPI.onPetImageUpdated(cb)` | `pet-image:updated` | 订阅形象更新 |

#### 窗口间通信
| API | IPC 通道 | 说明 |
|-----|----------|------|
| `electronAPI.openChat()` | `window:openChat` | 打开/聚焦聊天窗口 |
| `electronAPI.openSettings()` | `window:openSettings` | 打开/聚焦设置窗口 |
| `electronAPI.onPetMenuClose(cb)` | `pet:menuClose` | 桌宠菜单关闭通知 |

---

## 二、事件总线（渲染进程内插件通信）

> ⚠️ **当前状态**：事件总线在 `src/renderer/core/event-bus.ts` 中定义，但实际代码主要通过 Zustand store (`pet-store.ts`) 和 IPC 广播实现状态同步。事件总线使用有限，新功能应优先考虑 Zustand + IPC 广播模式。

### 事件列表

| 事件名 | 发出者 | 载荷 | 说明 |
|--------|--------|------|------|
| `character:switch` | Sidebar / Tray | `{ characterId: string }` | 切换当前活跃角色 |
| `character:created` | diy plugin | `{ character: CharacterConfig }` | 新建角色完成 |
| `character:updated` | diy plugin | `{ characterId: string, changes: Partial<CharacterConfig> }` | 角色数据修改 |
| `character:deleted` | diy plugin | `{ characterId: string }` | 角色被删除 |
| `message:send` | InputBar | `{ text: string, characterId: string }` | 用户发送消息 |
| `message:received` | chat plugin | `{ message: ChatMessage }` | AI 返回完整消息 |
| `message:streaming` | chat plugin | `{ characterId: string, text: string, isComplete: boolean }` | 流式输出中 |
| `pet:animate` | 任意插件 | `{ characterId: string, animation: string }` | 请求桌宠播动画 |
| `theme:changed` | theme engine | `{ theme: string, mode: 'light' \| 'dark' }` | 主题切换 |
| `window:state-changed` | window manager | `{ state: string }` | 主窗口状态变化 |
| `settings:open` | 任意插件 | `{ tab?: string }` | 打开设置窗口 |
| `settings:close` | settings plugin | — | 关闭设置窗口 |

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

## 三、数据持久化

> ⚠️ **当前实现**：数据持久化通过 IPC 通道 + JSON 文件实现（非 DataStore 抽象层）。所有数据文件存储在 `%APPDATA%/ai-companion/`。

### 3.1 IPC 持久化通道

详见 `src/main/ipc/index.ts` 和 `src/preload/index.ts`。所有读写操作通过 `window.electronAPI` 暴露给渲染进程。

### 3.2 持久化文件

| 文件 | 内容 | 对应 IPC 通道 |
|------|------|-------------|
| `characters.json` | `CharactersData { characters, activeId }` | `character:getAll` / `character:saveAll` |
| `api-profiles.json` | `ApiProfilesData { profiles, activeProfileId }` | `api-profiles:getAll` / `api-profiles:saveAll` |
| `chat-history.json` | `Record<string, ChatMessage[]>` | `chat-history:get` / `chat-history:add` / `chat-history:clear` |
| `agent-memory.json` | `Record<string, MemoryEntry[]>` | `agent-memory:getAll` / `agent-memory:add` / `agent-memory:delete` / `agent-memory:update` |
| `pet-actions.json` | `{ actions: PetAction[] }` | `pet-actions:getAll` / `pet-actions:save` |
| `pet-image-{charId}.png` | 角色自定义形象图片 | `dialog:openImage` / `pet-image:getCurrent` |

---

## 四、主题系统

> ⚠️ **当前实现**：主题通过 CSS 变量 + `App.tsx` 中的 `data-theme` / `data-density` 属性控制，持久化在 `characters.json` 或设置中。`AppSettings.theme` 和 `AppSettings.density` 定义见 `src/common/types.ts`。

## 五、TTS 服务接口 ❌（整阶段未启动）

> TTS（P5）尚未实现。方案曾选为 IndexTTS（Python 子进程），启动前需重新评估。

---

## 六、数据类型

> ⚠️ **权威源**：所有类型定义以 `src/common/types.ts` 为准。本节仅提供概要，写代码前必须读取 `src/common/types.ts` 确认最新定义。

### 6.1 CharacterConfig

```typescript
// 见 src/common/types.ts
interface CharacterConfig {
  id: string
  name: string
  gradient: string              // CSS gradient 色值
  imageDataUrl: string | null   // null = 使用 CSS 默认形象
  personality: string           // 性格描述（AI System Prompt 核心）
  voiceId: string
  speechStyle: string           // 说话风格
  apiProfileId?: string         // 角色专属 API Profile ID
}
```

### 6.2 ChatMessage

```typescript
// 见 src/common/types.ts
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  characterId: string
}
```

### 6.3 ApiProfile

```typescript
// 见 src/common/types.ts
interface ApiProfile {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  isActive: boolean
  maxTokens?: number
  temperature?: number
  createdAt: number
  updatedAt: number
}
```

### 6.4 MemoryEntry

```typescript
// 见 src/common/types.ts
interface MemoryEntry {
  id: string
  content: string
  source: 'ai-extracted' | 'user-explicit'
  createdAt: number
  updatedAt: number
}
```

### 6.5 PetAction

```typescript
// 见 src/common/types.ts
interface PetAction {
  id: string
  label: string
  emoji: string
  videoPath: string
  order: number
  type: 'normal' | 'chat' | 'settings'
}
```

### 6.6 AppSettings

```typescript
// 见 src/common/types.ts
interface AppSettings {
  theme: 'warm-peach' | 'mint' | 'lavender' | 'milk-coffee' | 'sakura'
  density: 'comfortable' | 'compact'
}
```

### 6.7 预制角色数据

| 角色 | 描述 |
|------|------|
| 小桃 | 暖桃色渐变，默认角色 |
| 小蓝 | 蓝色渐变 |

> 注：当前仅 2 个默认角色（`DEFAULT_CHARACTERS`），计划扩展至 4 个。

---

## 六、插件系统

> ⚠️ **当前状态**：插件框架已在 `src/renderer/core/plugin.ts` 中定义，但实际功能代码主要在 `src/renderer/components/` 和 `src/renderer/stores/` 中。`plugins/chat/` 有 `api.ts` + `index.ts` 可用，`plugins/diy/`、`plugins/pet/`、`plugins/tts/` 为空白或占位。

## 七、接口变更流程

1. 修改本文档对应的接口定义
2. `git grep` 搜索所有调用方
3. 更新所有调用方
4. commit message 格式：`interface: 变更描述`
5. 程序员审阅 → 合并

**Breaking change 必须在 commit message 中标注 `BREAKING:`**。

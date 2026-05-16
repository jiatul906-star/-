# UI 实现方案

> 状态：待程序员反馈 | 最后更新：2026-05-16

## 一、窗口架构

基于方案 C（壳 + 插件），UI 需要三个窗口载体：

| 窗口 | 技术 | 说明 |
|------|------|------|
| 桌宠窗口 | BrowserWindow (transparent + alwaysOnTop) | 无边框透明，角色 GIF/帧动画悬浮桌面 |
| 聊天主窗口 | BrowserWindow（普通） | 圆角无边框（frameless），含左侧栏+聊天区 |
| 设置弹窗 | 聊天窗口内浮层（非独立窗口） | CSS overlay，不额外创建 BrowserWindow |

### 桌宠窗口细节

```
类型：BrowserWindow
├── transparent: true
├── alwaysOnTop: true
├── frame: false
├── resizable: false
├── hasShadow: false
└── 尺寸：根据角色素材自适应
```

- 桌面流浪态：可拖拽移动（通过监听 mouse 事件模拟窗口拖动）
- 坐窗口边框态：跟随主窗口位置/大小变化
- z-order 策略：始终 TopMost，托盘可临时隐藏

### 主窗口细节

```
类型：BrowserWindow
├── frame: false（自绘标题栏）
├── transparent: false
├── resizable: true
├── minWidth: 320, minHeight: 360
├── width: 420, height: 600 (默认)
└── backgroundColor: 跟随主题主背景色
```

---

## 二、主题系统实现

### 方案：CSS 自定义属性

所有的设计 token 定义为 CSS variables，主题切换 = 改 CSS 变量值。

```css
:root {
  /* 间距 */
  --sidebar-width: 52px;
  --sidebar-width-single: 22px;
  --avatar-size: 38px;
  --titlebar-height: 40px;
  --msg-padding-x: 16px;
  --bubble-max-width: 75%;
  --bubble-padding: 10px 14px;
  --input-height: 46px;
  --gap-diff-sender: 8px;

  /* 圆角 */
  --radius-bubble: 18px;
  --radius-window: 10px;
  --radius-input: 12px;
  --radius-panel: 12px;
  --radius-button: 8px;

  /* 阴影 */
  --shadow-bubble: 0 2px 8px rgba(0,0,0,0.06);
  --shadow-panel: 0 4px 16px rgba(0,0,0,0.08);
  --shadow-window: 0 8px 32px rgba(0,0,0,0.12);

  /* 动效 */
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-bubble: 250ms;
  --duration-window: 200ms;
  --duration-theme: 300ms;

  /* 颜色（由主题类覆盖） */
  --color-bg: #FBF9F7;
  --color-bubble-ai: #F5F3F1;
  --color-bubble-user: #FFE0D8;
  --color-accent: #E8927C;
  --color-card: #FFFFFF;
  --color-text: #1a1a1a;
  --color-text-secondary: #999;
  --color-border: #eee;
  --color-shadow-bubble: rgba(0,0,0,0.06);
  --color-shadow-panel: rgba(0,0,0,0.08);
  --color-shadow-window: rgba(0,0,0,0.12);
}
```

### 主题切换逻辑

```
用户选择：暖桃 + 暗色
         ↓
设置 class: <html class="theme-peach dark">
         ↓
CSS 变量全部重写
```

- 5 个 `theme-*` 类：控制色系
- 1 个 `dark` 类：控制明暗（叠加在主题类上）
- 切换时有 300ms transition

### 实现建议

用一个 JS 模块 `theme.js` 管理：

```
theme.js
├── setTheme(name)    // 'peach' | 'mint' | 'lavender' | 'coffee' | 'sakura'
├── setMode(mode)    // 'light' | 'dark'
├── setDensity(d)    // 'comfort' | 'compact'
├── getCurrent()     // 返回当前完整配置
└── 读写 localStorage 持久化
```

---

## 三、组件树

```
App
├── PetWindow          ← 独立 BrowserWindow（透明置顶）
│   ├── PetSprite      ← 角色帧动画（idle/walk/blink/talk/grabbed/think/sad/silent）
│   └── SpeechBubble   ← Level 1 右键气泡（漫画风，堆叠飘动）
│
├── MainWindow         ← 主 BrowserWindow
│   ├── TitleBar       ← 自绘标题栏（圆角顶栏），角色可坐
│   ├── Sidebar        ← 左侧角色列表（avatarSize, gap 从 CSS vars）
│   │   ├── AvatarList ← 竖排圆形头像
│   │   └── AddButton  ← "+" 新建角色
│   ├── ChatArea       ← 聊天消息区
│   │   ├── MessageList
│   │   │   └── Bubble ← 气泡组件（ai/user 两变体）
│   │   └── LoadingIndicator ← AI 请求中：三个跳动点
│   ├── InputBar       ← 输入框 + 发送按钮
│   ├── ErrorBar       ← 超时红条 + 重试按钮（底部浮出）
│   │
│   └── SettingsOverlay ← 设置弹窗（浮层，非独立窗口）
│       ├── CharList    ← 左侧角色列表
│       ├── TabBar      ← [外观] [性格] [声音]
│       ├── AppearanceTab ← 三图上传
│       ├── PersonalityTab ← 标签 + 文本
│       ├── VoiceTab    ← 滑块调节 + 试听
│       ├── AISettings  ← API/Key/测试连接
│       └── AppearanceSettings ← 主题色/明暗/密度
│
└── TrayManager        ← 系统托盘
    ├── TrayIcon       ← 当前角色大头照
    └── TrayMenu       ← 显示隐藏/聊天/切换角色/退出
```

---

## 四、IPC 通道设计

主窗口和桌宠窗口之间通过 Electron IPC 通信：

| 通道 | 方向 | 触发时机 |
|------|------|---------|
| `pet:sync-character` | 主→宠 | 切换角色时，同步新角色的桌宠形象 |
| `pet:set-state` | 主→宠 | 窗口变化（开/关/最小化/最大/拖拽），宠物决定跳上/跳下 |
| `pet:position` | 宠→主 | 宠物被拖拽到新位置，保存 |
| `pet:action` | 宠→主 | 戳/摸头/右键等交互事件 |
| `window:moved` | 主→宠 | 窗口被拖拽，宠物跟坐标 |
| `window:resized` | 主→宠 | 窗口大小改变，宠物调整坐姿位置 |
| `tray:action` | 主↔托盘 | 托盘菜单点击 |

---

## 五、桌宠动画状态机

```
         ┌── idle ←→ walk（随机走动）
         │    ↕
         ├── blink（随机眨眼，叠加 idle）
         │
用户戳 ──→ react（随机反应，300ms 后回 idle）
右键  ──→ talk（对话气泡，鼠标移出→回 idle）
拖拽  ──→ grabbed（被抓起，放下→回 idle）
窗口事件→ jump_on / jump_off（300ms / 250ms）
错误   ──→ think（思考歪头）/ sad（委屈）/ silent（捂嘴）
         ↓ 恢复后
         idle
```

---

## 六、空状态 & 错误状态实现

### 首次启动流程

```
软件启动
  ├── 检查 localStorage 是否有角色数据
  ├── 无角色：
  │   ├── 桌宠窗口 → 默认吉祥物 + 对话气泡"来创建一个角色吧~"
  │   ├── 聊天主窗口 → 角色名显示"点击创建" + [创建角色] 按钮
  │   └── 点击 → 弹出 SettingsOverlay（引导创建角色）
  └── 有角色：
      ├── 加载最近使用的角色
      └── 恢复上次窗口位置/状态
```

### 错误处理流程

```
AI 请求
  ├── 发送中 → 角色 think 表情 + 气泡跳动点
  ├── 成功 → 正常流式输出
  ├── 超时 → ErrorBar（红色"回复失败 [重试]"）
  ├── 断网 → 角色 sad 表情，恢复后自动切回正常
  └── API 失效 → 角色反馈动作 + 自动弹 SettingsOverlay(AI设置标签)

TTS 播放
  ├── 成功 → 正常播放
  └── 失败 → 角色 silent（捂嘴）+ 降级为纯文字气泡
```

---

## 七、实现优先级建议

| 阶段 | 内容 | 说明 |
|------|------|------|
| P0 基础 | 主窗口框架 + CSS 变量主题系统 + 基础布局 | 骨架 |
| P1 聊天 | 气泡组件 + 输入框 + 消息列表 | 核心功能 |
| P2 桌宠 | 透明窗口 + 帧动画 + 拖拽 + 状态机 | 差异化 |
| P3 设置 | SettingsOverlay + 角色编辑 + AI 配置 | 完整闭环 |
| P4 托盘 | 托盘图标 + 菜单 + 隐藏/显示 | 体验补全 |
| P5 错误态 | ErrorBar + 角色表情反馈 + 空状态引导 | 打磨 |

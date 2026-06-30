# 项目地图

Electron + React 桌面应用。用户创建/定制 AI 角色，角色以桌宠形态悬浮桌面，支持聊天、记忆、TTS。

## 技术栈

Electron 33 + React 18 + TypeScript 5 + Zustand 5 + framer-motion 11 + electron-vite 2

## 目录结构

```
├── src/                        # ⚠️ 唯一真相源，不允许直接改 out/ 或 ASAR
│   ├── main/                   # Electron 主进程
│   │   ├── index.ts            # 入口：创建窗口、托盘、注册 IPC
│   │   ├── ipc/index.ts        # 所有 IPC handler + 持久化逻辑
│   │   └── windows/            # chat.ts / pet.ts / settings.ts
│   ├── preload/                # contextBridge → window.electronAPI
│   ├── renderer/
│   │   ├── App.tsx             # hash 路由： #/pet | #/settings | 默认 chat
│   │   ├── core/               # event-bus.ts / plugin.ts
│   │   ├── plugins/            # chat(✅) / diy(空壳) / pet(空壳) / tts(空壳)
│   │   ├── stores/pet-store.ts # Zustand 全局状态
│   │   └── components/         # ChatWindow / PetWindow / SettingsWindow / ContextMenu
│   └── common/types.ts         # 公共类型定义
├── docs/                       # 技术参考（architecture / interfaces / design-system / ui-spec）
├── specs/                      # 产品规格 + 验收标准 + 决策记录
├── out/                        # 构建产物（electron-vite build）
├── dist/                       # 打包产物（win-unpacked/ 等）
├── resources/                  # 打包用资源（icon.ico）
├── magins/                     # 素材：视频（.mp4）+ 参考截图（.jpg）
├── mockups/                    # UI 预览 HTML
├── bug/                        # Bug 截图、聊天记录、日志、Bug 清单、开发速查手册
└── 2026-06-06_工作流文档/       # 工作流 .docx 文件（历史文档）
```

## 构建

```bash
npx electron-vite build    # 构建
npx electron .             # 启动
npx electron-vite dev      # 开发（HMR）
```

## ⚠️ 不可违反的约束（每一条都来自真实 Bug）

1. **`src/` 是唯一真相源。** 不允许只修改 ASAR 构建产物。Bug R9 就是这样产生的。
2. **不允许硬编码 UI 值。** 所有色值、间距、圆角、阴影必须从 CSS 变量读取。Bug R6（无主题系统）就是因为硬编码了 `#FBF9F7`。
3. **所有表单输入必须持久化。** value/onChange 绑定 + localStorage。Bug R3（设置输入即丢弃）就是这样产生的。
4. **任何外部依赖方案必须零用户门槛。** 不需要注册账号、不需要获取 Key、不需要安装额外运行环境。
5. **所有模块间通信走已定义的 IPC 通道。** 见 `docs/interfaces.md`。不允许临时加通道。

## 当前进度（2026-07-01）

### ✅ 已完成

| 阶段 | 内容 | 状态 |
|------|------|------|
| P0 | 3 窗口框架（ChatWindow 960×680 / PetWindow 160×270 / SettingsWindow 780×560） | ✅ |
| P0 | CSS 变量主题系统（5 主题）| ✅ 基础完成 |
| P0 | 侧栏角色列表（单/多角色自适应） | ✅ |
| P0 | 桌宠透明窗口（transparent + alwaysOnTop + 拖拽 + 缩放） | ✅ |
| P1 | AI 流式聊天（OpenAI 兼容，DeepSeek 实测可用） | ✅ |
| P1 | 聊天历史持久化（chat-history.json） | ✅ |
| P1 | 角色切换（侧栏 + 桌宠跟变） | ✅ |
| P1 | 右键环形菜单 + 迷你聊天气泡（ContextMenu） | ✅ |
| P2 | 桌宠拖拽 + 缩放 + blur 自动缩窗 | ✅ |
| P2 | 系统托盘（角色大头照 + 右键菜单） | ✅ |
| P3 | 设置面板（外表/灵魂/声音三标签） | ✅ |
| P3 | 角色新建/编辑/删除 + 数据持久化 | ✅ |
| P3 | API Profiles 多配置（新建/编辑/删除/设为当前/测试连接） | ✅ |
| P3 | 智能体记忆（添加/删除/编辑） | ✅ |
| P3 | 桌宠动作编辑器（ActionEditor） | ✅ |
| P3 | 聊天窗口标题栏 API 选择器 | ✅ |

### ❌ 待完成

| 阶段 | 内容 | 说明 |
|------|------|------|
| P3 | 声音标签页 | 整个标签标"待开发"，滑块不可用 |
| P3 | 智能体记忆导入/导出 | 2026-07-01 新增需求 |
| P3 | 按钮数量可自定义 + 设置界面编辑 | 2026-07-01 新增需求 |
| P3 | 右键气泡渐隐规则（>2条变淡消失） | 2026-07-01 新增需求 |
| P3 | 首次启动角色选择引导 | spec 已定义，代码未实现 |
| P4 | 暗色模式完整实现 | CSS 变量已定义但未全局接入 |
| P4 | 错误状态（超时红条、断网 sad 表情、API 失效弹设置） | 部分已做 |
| P5 | TTS（IndexTTS） | 整阶段未启动 |

### 打包与分发

| 阶段 | 内容 | 状态 |
|------|------|------|
| P6 | 源码构建（electron-vite build） | ✅ |
| P6 | 解压目录可直接运行（win-unpacked） | ✅ |
| P6 | app.asar 内容完整 | 🔧 手动 asar pack，未走 electron-builder |
| P6 | 打包后托盘图标正常 | ✅ |
| P6 | 打包后 IPC 通道全功能可用 | ❌ 未系统验证 |
| P6 | 持久化数据路径正确（%APPDATA%） | ❌ 未验证 |
| P6 | 应用元数据正确（进程名/版本号） | ❌ 未验证 |
| P6 | NSIS 安装器可用 | ❌ 未生成 |
| P6 | 打包体积可接受（≤300MB 解压，≤100MB 安装器） | ❌ 未验证 |

## AI 开发前阅读顺序

> **如果使用 Codex 多代理协作**：Codex 总控只读 `CODEX.md`（入口），子代理按 CODEX.md §五的提示词各自读取对应文件。以下为单 AI 模式下的阅读顺序。

1. **CODEX.md** → Codex 总控台（多代理协作入口，含调度策略和子代理启动提示词）
2. **本文件（ag.md）** → 了解骨架和当前进度
3. **specs/requirements.md** → 知道要做什么（四级菜单 + 新需求）
4. **specs/acceptance-criteria.md** → 知道怎样算做完（含状态标记 + 对应源码）
5. **specs/agent-division.md** → 5 个子代理角色定义、AC 分配表、交付接口
6. **specs/development-plan.md** → 完整开发计划
7. **docs/architecture.md** → 知道代码放哪、数据怎么流（⚠️ 初稿过时，以 ag.md 目录结构和 src/ 为准）
8. **docs/interfaces.md** → 知道已有的 IPC 通道和类型签名（⚠️ 以 src/ 代码为准）
9. **docs/design-system.md** → 知道色值/间距/动效参数
10. **docs/ui-spec.md** → 知道 Level 1/2/3 交互规则
11. **bug/开发速查手册.md** → 知道已有组件细节、数据流、常见 Bug

## 当前 API 配置

- **激活**：DeepSeek（`preset_1`），Base URL：`https://api.deepseek.com/v1`，Model：`deepseek-chat`
- **预置模板**：OpenAI / DeepSeek / 硅基流动 / 智谱 GLM / 通义千问
- **API Key**：`sk-17e89afabf824ae0827892061b763077`

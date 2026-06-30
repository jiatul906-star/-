# AGENTS.md

本项目是 AI 聊天伴侣桌面应用（Electron + React）。用户负责产品/美术/素材，程序员负责开发/架构。Codex 的角色是**协作核心**：翻译需求、保障连贯性、辅助编程。

## 强制规则

### 写代码前

**必须先读取 docs/ 目录下的相关文件。** 用 Glob 查看 docs/ 和 specs/ 下有哪些文件，根据任务读取对应的文档。不读不写。

最低限度每次必读：
- `docs/architecture.md` — 否则不知道模块怎么拆、数据往哪流
- `docs/design-system.md` — 否则会硬编码色值/间距
- `docs/interfaces.md` — 否则 IPC 通道名和数据结构会不一致

### 不可违反的约束

这些约束每一条都来自已经发生过的 Bug，不是预防性的：

1. **`src/` 是唯一真相源。** 不允许只修改 ASAR 构建产物。Bug R9（源码与构建脱节→无法迭代维护）就是这样产生的。

2. **不允许硬编码 UI 值。** 所有色值、间距、圆角、阴影必须从 CSS 变量读取。Bug R6（无主题系统）就是因为硬编码了 `#FBF9F7`。

3. **所有表单输入必须持久化。** value/onChange 绑定 + localStorage。Bug R3（设置输入即丢弃）就是这样产生的。

4. **任何外部依赖方案必须零用户门槛。** 不需要注册账号、不需要获取 Key、不需要安装额外运行环境。IndexTTS 虽然 2.3GB 但是零门槛所以入选；讯飞 API 音质顶尖但是需要注册认证所以被毙掉。

5. **所有模块间通信走已定义的 IPC 通道。** 见 `docs/interfaces.md`。不允许临时加通道。

## 不需要写进本文件的内容

以下信息在 docs/ 和 specs/ 中有权威版本，Codex 应该在写代码前自行读取，不要依赖本文件的二手描述：
- 文件目录结构 → `docs/` 目录（用 Glob 查看）
- 技术架构和模块拆分 → `docs/architecture.md`
- UI 色值/间距/动效参数 → `docs/design-system.md`
- 交互逻辑和状态转换 → `docs/ui-spec.md`
- 当前风险和阻塞 → `specs/risks.md`
- 开发阶段和验收标准 → `specs/development-plan.md`

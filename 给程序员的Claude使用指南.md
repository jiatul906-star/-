# 给程序员的 Claude 使用指南

> 你不需要记住项目里的所有规则。你只需要按下面的方式给 Claude 下命令，Claude 会自动读取宪法文档并遵守。

---

## 启动：每次打开 Claude Code 前

**确保在项目根目录启动 Claude Code**。Claude 会自动读取 `CLAUDE.md`，获得所有强制规则。

如果 Claude 已经在运行，说一句：
```
请先读取 CLAUDE.md，然后读取 docs/ 和 specs/ 目录下所有你需要的文件，理解项目全貌。
```

---

## 日常编码：按这个模板说

### 模板

```
我要做 {功能描述}。

写代码前先读 docs/architecture.md、docs/interfaces.md、docs/design-system.md。

完成后对照 specs/development-plan.md 里对应阶段的验收标准自查。
```

### 为什么这个模板有效

- "先读"触发 Claude 去获取宪法约束
- "对照验收标准自查"让 Claude 帮你检查有没有遗漏
- 三句话，不需要你理解宪法里写了什么

---

## 具体任务示例

### 修复致命 Bug

```
修三个致命 Bug（详见 specs/risks.md）：

1. R2 假对话 — 重写 sendMessage，对接 settings 里配置的 API 地址和 Key，实现真实的流式 AI 回复
2. R3 设置不存 — 所有表单字段绑定 value/onChange，写入 localStorage，启动时读回
3. R9 源码脱节 — 把 ASAR 里的逻辑回迁到 src/，确保 src/ 是唯一真相源

写代码前先读 docs/architecture.md、docs/interfaces.md、docs/design-system.md。
完成后对照 specs/risks.md 验证每个 Bug 是否已解决。
```

### 搭建 P0 骨架

```
搭建 P0 骨架（详见 specs/development-plan.md 的 P0 阶段）。

写代码前先读 docs/architecture.md、docs/interfaces.md、docs/design-system.md、docs/ui-spec.md。

注意：
- 所有色值/间距从 CSS 变量读取，不要硬编码
- IPC 通道名统一在 src/shared/ipc-channels.ts 定义
- 完成后对照 P0 验收标准自查
```

### 实现聊天功能

```
实现聊天核心功能（详见 specs/development-plan.md 的 P1 阶段）。

写代码前必须读 docs/architecture.md（特别是数据流部分）、docs/interfaces.md（特别是事件总线和 Message 类型）、docs/design-system.md。

关键约束：
- 消息类型用 interfaces.md 定义的 Message 格式，别自己造字段名
- 流式输出用 event-bus 发 message:streaming 事件
- 不要硬编码色值
```

---

## 新功能开发

### 如果要做 spec 里没有的功能

```
我要做 {新功能}。先一起写个 spec，格式参考 specs/ 下的分析文档。
写完后放到 specs/{功能名}-analysis.md，我审阅确认后再开始编码。
```

### 如果 specs/ 里已有分析文档

```
我要做 {功能}。先读 specs/{功能}-analysis.md 了解方案决策，
然后读 docs/architecture.md、docs/interfaces.md、docs/design-system.md，
然后开始写代码。
```

---

## 出问题时

### 代码跑不起来

```
{错误描述}。

先读相关 docs/ 文件，诊断根因，不要绕过问题——如果是架构约束被违反了，修正代码使其符合约束。
```

### 不确定某个设计决策

```
{问题描述}。查 docs/ 和 specs/ 里有没有相关决策。

如果没有，出一个多维对比分析（格式参考 specs/tts-analysis.md），我来决定。
```

### Bug 修完要验证

```
对照 specs/risks.md 和我刚才修的内容，更新风险状态。
如果有新的阻塞关系，更新阻塞关系图。
```

---

## 少说的话 vs 该说的话

| 别说 | 该说 |
|------|------|
| "帮我写个聊天功能" | "实现聊天功能（详见 specs/development-plan.md P1）。写代码前先读 docs/architecture.md、interfaces.md、design-system.md。" |
| "改一下主题颜色" | "修改主题系统。先读 docs/design-system.md，修改 CSS 变量值，不要在任何组件里硬编码色值。" |
| "加个 IPC 通道" | "加 IPC 通道前，先读 docs/interfaces.md 确认现有通道名规范，新通道在 src/shared/ipc-channels.ts 定义。" |
| "这块代码有问题帮我看看" | "这个 Bug 可能和 docs/interfaces.md 里定义的接口有关，先读接口契约再诊断。" |

---

## 总结：只记这两条

**1. 每次写代码前，在命令里说"先读 docs/architecture.md、docs/interfaces.md、docs/design-system.md"。**

**2. 做完后，说"对照 specs/development-plan.md 的验收标准自查"。**

其他所有细节——架构怎么拆、接口什么签名、色值多少像素——都在 docs/ 里，Claude 自己会读。你不用记。

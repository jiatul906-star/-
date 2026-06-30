# 验收标准

> ⚠️ **宪法约束**：Codex 验收子代理产出时，只接受截图或运行记录作为证据。
> 子代理不得以"代码已写好"/"日志显示正常"/"逻辑已实现"作为完成证明。
> Codex 看到截图/录屏中功能确实在运行，才算通过。
>
> **状态图例**：✅ 已实现 | 🔧 部分实现 | ❌ 待实现

---

## 证据格式要求

| 要求 | 说明 |
|------|------|
| 格式 | PNG 截图 或 GIF/MP4 录屏 |
| 范围 | 全窗口截图（非局部裁切），完整展示功能 |
| 命名 | `AC-X.Y_功能名称.png`（例：`AC-0.1_主窗口启动.png`） |
| 录屏 | ≤30 秒，展示完整操作流程 |

## 禁止的证据类型

| ❌ Codex 不接受 | ✅ Codex 接受 |
|----------------|-------------|
| 代码逻辑审查 | 应用窗口截图 |
| 日志/控制台输出 | 录屏（GIF/MP4） |
| 源码分析/grep | DevTools 实时取值截图 |
| "代码中已实现" | 功能运行的分步截图 |
| "逻辑正确" | 肉眼可见的 UI 效果 |

---

## P0：骨架

### AC-0.1 主窗口启动 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 窗口出现在屏幕上，默认尺寸 960×680（±20px），标题栏三按钮（最小化/最大化/关闭）可见，无白屏/黑屏/崩溃 |
| **验证方法** | 执行 `npx electron-vite build && npx electron .`，等待窗口出现，检查窗口尺寸和按钮 |
| **证据要求** | 全窗口截图 ×1（需含桌面背景，证明窗口正常渲染） |
| **失败判定** | 白屏 / 黑屏 / 崩溃 / 窗口未出现 / 按钮缺失 / 尺寸偏差 > 20px |
| **对应源码** | `src/main/index.ts`（bootstrap入口）、`src/main/windows/chat.ts`（窗口尺寸配置）、`src/renderer/App.tsx`（路由挂载） |

### AC-0.2 桌宠窗口显示 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 桌宠窗口在桌面上可见（透明背景 + CSS 角色形象），窗口无边框，角色图像完整显示，不遮挡任务栏 |
| **验证方法** | 启动应用→选择角色→观察桌宠窗口是否出现 |
| **证据要求** | 桌面全屏截图 ×1（需同时显示桌宠和桌面背景，证明透明+置顶） |
| **失败判定** | 桌宠窗口未出现 / 有边框 / 角色图像不完整 / 崩溃 |
| **对应源码** | `src/main/windows/pet.ts`（窗口配置：transparent/alwaysOnTop/frame）、`src/main/index.ts`（createPetWindow调用）、`src/renderer/components/PetWindow.tsx`（CSS渲染）、`src/renderer/components/pet.css`（.pet-window样式） |

### AC-0.3 主题切换 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 5 套主题色均能正确切换，切换后：主背景色、气泡色、强调色肉眼可辨不同；切换无白屏/闪烁 |
| **验证方法** | 在设置中依次点击 5 套主题色块，每切换一次截图 |
| **证据要求** | 5 张截图（每套主题一张），或 1 段录屏（依次切换 5 套主题） |
| **失败判定** | 某套主题颜色未变化 / 切换时白屏 / 崩溃 |
| **对应源码** | `src/renderer/components/SettingsWindow.tsx`（主题切换UI）、`src/renderer/App.tsx`（data-theme属性）、`src/renderer/components/chat.css`+`settings.css`+`pet.css`（CSS变量引用） |

### AC-0.4 窗口尺寸控制 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 窗口可拖拽边缘调整大小；最小宽度 680px、最小高度 480px（不可再缩小）；布局在最小尺寸时不崩坏 |
| **验证方法** | 拖拽窗口右下角到最小→截图；拖拽到随机大小→截图 |
| **证据要求** | 2 张截图（最小尺寸 + 任意大尺寸各一） |
| **失败判定** | 无法拖拽 / 可缩到 < 680×480 / 布局溢出/重叠/按钮被裁切 |
| **对应源码** | `src/main/windows/chat.ts`（minWidth/minHeight配置）、`src/renderer/components/chat.css`（响应式布局） |

### AC-0.5 左侧角色栏 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 单角色时侧栏宽度 ≈ 22px（迷你头像 + "+"号）；多角色时侧栏宽度 ≈ 52px。头像圆形，选中态高亮 |
| **验证方法** | 单角色状态截图→新建角色→多角色状态截图 |
| **证据要求** | 2 张截图（单角色 + 多角色各一） |
| **失败判定** | 侧栏宽度明显偏差 / 头像非圆形 / 选中态无高亮 / 新建按钮不可见 |
| **对应源码** | `src/renderer/components/ChatWindow.tsx`（sidebar渲染）、`src/renderer/components/chat.css`（.chat-sidebar宽度自适应）、`src/renderer/stores/pet-store.ts`（角色列表状态） |

### AC-0.6 桌宠可拖拽 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 鼠标按住桌宠可拖拽到桌面任意位置，松开后停留在新位置，不弹回 |
| **验证方法** | 拖拽桌宠从位置 A → 位置 B → 截图位置 B |
| **证据要求** | 2 张截图（拖拽前 + 拖拽后各一），或录屏 |
| **失败判定** | 无法拖拽 / 松开后弹回原位 / 拖拽过程中崩溃 |
| **对应源码** | `src/renderer/components/PetWindow.tsx`（mousedown/mousemove拖拽逻辑）、`src/main/ipc/index.ts`（window:movePet IPC handler） |

---

## P1：聊天核心

### AC-1.1 消息发送与 AI 回复 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 用户输入文字→回车→消息出现在气泡中→AI 返回文字（非固定文案，内容与输入相关）→AI 回复也出现在气泡中。用户气泡色 ≠ AI 气泡色 |
| **验证方法** | 输入"你好，你是谁？"→等待 AI 回复→截图整个聊天窗口 |
| **证据要求** | 1 张截图（需同时看到用户消息和 AI 回复） |
| **失败判定** | 无回复 / 回复固定文案 / 回复内容与问题无关 / 气泡颜色相同 / 消息不显示 |
| **对应源码** | `src/renderer/components/ChatWindow.tsx`（sendMessage/消息渲染）、`src/renderer/plugins/chat/api.ts`（streamChat/buildSystemPrompt）、`src/renderer/stores/pet-store.ts`（activeChar/activeProfile选择）、`src/renderer/components/chat.css`（气泡样式） |

### AC-1.2 流式逐字输出 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | AI 回复以逐字/逐 token 方式出现在气泡中，非一次性全部弹出。回复末尾有呼吸光标 |
| **验证方法** | 发送一条消息，录屏捕捉流式输出过程 |
| **证据要求** | 录屏（GIF/MP4，≤15 秒）展示逐字输出 |
| **失败判定** | 一次性弹出 / 无呼吸光标 / 流式中断后不再恢复 |
| **对应源码** | `src/renderer/plugins/chat/api.ts`（AsyncGenerator streamChat SSE解析）、`src/renderer/components/ChatWindow.tsx`（流式状态更新 + 呼吸光标渲染） |

### AC-1.3 聊天历史持久化 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 关闭聊天窗口→重新打开→之前的聊天记录仍然存在 |
| **验证方法** | 发送 2-3 条消息→关闭应用→重新启动→打开同一角色聊天窗口→截图 |
| **证据要求** | 2 张截图（关闭前 + 重启后各一，消息列表一致） |
| **失败判定** | 历史丢失 / 消息顺序错乱 / 角色归属错误 |
| **对应源码** | `src/main/ipc/index.ts`（chat-history:get/add/clear handler → chat-history.json）、`src/preload/index.ts`（getChatHistory/addChatMessage/clearChatHistory API）、`src/renderer/components/ChatWindow.tsx`（加载/保存历史调用） |

### AC-1.4 角色切换 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 点击侧栏另一角色→聊天历史切换为该角色→桌宠形象跟随变化→聊天窗口角色名更新 |
| **验证方法** | 角色 A 聊天 → 切换到角色 B → 截图（窗口 + 桌宠同时可见） |
| **证据要求** | 1 张截图（需同时显示聊天窗口角色名 + 桌宠形象） |
| **失败判定** | 聊天历史未切换 / 桌宠未更新 / 角色名未变 |
| **对应源码** | `src/renderer/stores/pet-store.ts`（setActiveCharacter状态切换）、`src/renderer/components/ChatWindow.tsx`（sidebar点击 + 历史重新加载）、`src/renderer/components/PetWindow.tsx`（形象跟随activeCharacterId）、`src/main/ipc/index.ts`（characters:updated广播） |

### AC-1.5 Level 1 ↔ Level 2 过渡 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 双击桌宠→聊天窗口打开/聚焦，桌宠跳上窗口顶栏坐下；关闭聊天窗口→桌宠跳回桌面。过渡动画流畅 |
| **验证方法** | 录屏：双击桌宠→窗口出现→桌宠坐上顶栏→关闭窗口→桌宠跳回桌面 |
| **证据要求** | 录屏（GIF/MP4，≤20 秒） |
| **失败判定** | 双击无反应 / 桌宠未跳上 / 关闭后桌宠消失 / 动画卡顿 > 1 秒 |
| **对应源码** | `src/renderer/components/PetWindow.tsx`（双击事件→openChat IPC）、`src/main/ipc/index.ts`（window:openChat handler）、`src/main/windows/chat.ts`（窗口show/focus）、`src/main/index.ts`（窗口生命周期→桌宠位置） |

### AC-1.6 戳桌宠反应 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 点击桌宠身体→角色显示反应（动作变化），并显示一句台词。不同时机点击可能有不同反应 |
| **验证方法** | 点击桌宠→截图（含台词气泡） |
| **证据要求** | 1 张截图（需同时显示反应动作 + 台词气泡） |
| **失败判定** | 点击无反应 / 无台词 / 只有一种反应（证明随机逻辑无效） |
| **对应源码** | `src/renderer/components/PetWindow.tsx`（点击事件处理/poke逻辑）、`src/renderer/components/ContextMenu.tsx`（气泡显示）、`src/renderer/stores/pet-store.ts`（反应动作随机选择） |

### AC-1.7 右键对话气泡 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 右键桌宠→弹出漫画风对话气泡（输入框可见）；连续右键→已有气泡向上飘动，新气泡在下方出现；鼠标移出气泡区→气泡消失 |
| **验证方法** | 录屏：右键→输入文字发送→再右键→观察气泡堆叠→移出鼠标→气泡消失 |
| **证据要求** | 录屏（GIF/MP4，≤20 秒）或 3 张分步截图（首次气泡 + 堆叠 + 消失后） |
| **失败判定** | 右键无反应 / 无输入框 / 不堆叠 / 不移出也消失 / 移出后不消失 |
| **对应源码** | `src/renderer/components/PetWindow.tsx`（右键事件→openMenu/chatMessages状态）、`src/renderer/components/ContextMenu.tsx`（气泡渲染/堆叠/透明度计算）、`src/renderer/components/context-menu.css`（.ctx-chat-bubbles动画）、`src/main/ipc/index.ts`（window:resizePet扩窗+blur缩窗） |

---

## P2：桌宠完整态

### AC-2.1 闲置动画 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 桌宠在无交互时，至少展示呼吸动画。每隔 2-10 秒随机眨眼一次。肉眼可观察到角色身体有轻微运动 |
| **验证方法** | 录屏：桌宠闲置 15 秒，观察是否有呼吸 + 随机眨眼 |
| **证据要求** | 录屏（GIF/MP4，≤15 秒） |
| **失败判定** | 完全静止 / 无眨眼 / 眨眼频率固定不随机 |
| **对应源码** | `src/renderer/components/PetWindow.tsx`（动画定时器/随机行为）、`src/renderer/components/pet.css`（CSS动画 keyframes）、`src/renderer/stores/pet-store.ts`（动画状态） |

### AC-2.2 拖拽桌宠动画 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 拖拽桌宠时播放"被抓"动作（图像变化），放下后切回待机状态 |
| **验证方法** | 录屏：拖拽桌宠→放下 |
| **证据要求** | 录屏（GIF/MP4，≤10 秒） |
| **失败判定** | 拖拽时无动作变化 / 放下后不恢复待机 |
| **对应源码** | `src/renderer/components/PetWindow.tsx`（mousedown→grabbed状态/mouseup→idle状态）、`src/renderer/components/pet.css`（.grabbed样式） |

### AC-2.3 窗口生命周期联动 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 关闭窗口→桌宠跳回桌面；最小化→桌宠跳下；最大化→桌宠跳下；恢复→桌宠跳回。全部过渡动画可见 |
| **验证方法** | 录屏依次操作：关闭→恢复→最小化→恢复→最大化→恢复 |
| **证据要求** | 录屏（GIF/MP4，≤30 秒） |
| **失败判定** | 某操作后桌宠位置异常 / 动画缺失 / 桌宠消失 |
| **对应源码** | `src/main/index.ts`（窗口事件监听：minimize/maximize/restore/close → petWindow状态同步）、`src/main/windows/chat.ts`（窗口生命周期）、`src/renderer/components/PetWindow.tsx`（状态响应） |

### AC-2.4 系统托盘 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 托盘图标显示当前角色大头照（圆形裁剪）；右键托盘图标→弹出菜单含"显示/隐藏桌宠""打开聊天窗口""切换角色""退出"。托盘图标与当前激活角色一致 |
| **验证方法** | 截图托盘图标 + 右键菜单 |
| **证据要求** | 2 张截图（托盘图标 + 右键菜单各一） |
| **失败判定** | 无托盘图标 / 菜单项缺失 / 点击菜单项无反应 / 切换角色后托盘图标未更新 |
| **对应源码** | `src/main/index.ts`（createTray: Tray实例化、icon base64、右键Menu模板） |

### AC-2.5 托盘隐藏/显示桌宠 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 点击"隐藏桌宠"→桌宠消失；点击"显示桌宠"→桌宠恢复 |
| **验证方法** | 录屏：显示→隐藏→显示 |
| **证据要求** | 录屏（GIF/MP4，≤15 秒） |
| **失败判定** | 隐藏后桌宠仍在 / 显示后桌宠不恢复 |
| **对应源码** | `src/main/index.ts`（托盘菜单click→petWindow.hide()/show()） |

### AC-2.6 右键互动菜单 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 右键点击桌宠→弹出环形菜单，至少含"聊天"和"摸摸头"两个选项 |
| **验证方法** | 右键桌宠→截图菜单 |
| **证据要求** | 1 张截图 |
| **失败判定** | 菜单不弹出 / 菜单项缺失 / 点击菜单项无反应 |
| **对应源码** | `src/renderer/components/PetWindow.tsx`（右键事件→contextMenu状态）、`src/renderer/components/ContextMenu.tsx`（环形菜单按钮渲染）、`src/renderer/components/context-menu.css`（环形排列动画）、`src/common/types.ts`（DEFAULT_PET_ACTIONS） |

---

## P3：设置 + DIY

### AC-3.1 设置弹窗 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 点击齿轮/设置入口→设置窗口出现（独立窗口 780×560），聊天窗口保持可见。关闭设置→回到聊天，聊天内容不丢失 |
| **验证方法** | 截图：聊天窗口 + 设置窗口同时可见 |
| **证据要求** | 1 张截图（双窗口同屏） |
| **失败判定** | 设置替换聊天（非浮层/独立窗）/ 聊天内容丢失 |
| **对应源码** | `src/main/windows/settings.ts`（独立窗口 780×560）、`src/main/ipc/index.ts`（window:openSettings handler）、`src/renderer/components/SettingsWindow.tsx`（设置UI渲染） |

### AC-3.2 角色外观编辑 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 外观标签页：可修改角色名称、上传自定义头像/PET图。上传图片后实时预览可见。保存后角色名称和图片在聊天窗口和桌宠窗口均更新 |
| **验证方法** | 修改名称+上传图片→保存→切换到聊天窗口→截图 |
| **证据要求** | 2 张截图（设置中的预览 + 保存后聊天窗口中的效果） |
| **失败判定** | 上传无反应 / 预览不显示 / 保存后未生效 |
| **对应源码** | `src/renderer/components/SettingsWindow.tsx`（外表标签：名称input + 上传按钮 + 预览）、`src/main/ipc/index.ts`（dialog:openImage + pet-image:getCurrent handler）、`src/preload/index.ts`（openImageDialog/onPetImageUpdated API）、`src/renderer/stores/pet-store.ts`（updateCharacter→persist三步） |

### AC-3.3 角色性格编辑 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 性格标签页：可编辑性格描述文本，保存后 AI 回复风格与描述一致（可通过 system prompt 预览确认） |
| **验证方法** | 编辑性格描述→查看 System Prompt 预览→截图 |
| **证据要求** | 1 张截图（含性格输入 + System Prompt 预览） |
| **失败判定** | 输入后预览不更新 / 保存后丢失 |
| **对应源码** | `src/renderer/components/SettingsWindow.tsx`（灵魂标签：personality textarea + speechStyle input + SystemPrompt预览）、`src/renderer/plugins/chat/api.ts`（buildSystemPrompt函数）、`src/renderer/stores/pet-store.ts`（personality/speechStyle状态→持久化） |

### AC-3.4 角色声音标签 ❌

| 字段 | 内容 |
|------|------|
| **量化标准** | 声音标签页显示"待开发"标识（语速/音调/音量滑块 + 试听按钮均不可用）。不影响其他标签页功能 |
| **验证方法** | 切换到声音标签页→截图 |
| **证据要求** | 1 张截图（声音标签页"待开发"标识完整可见） |
| **失败判定** | 声音标签页不可见 / 标识缺失 / "待开发"标识不可辨识 |
| **对应源码** | `src/renderer/components/SettingsWindow.tsx`（声音标签"待开发"占位渲染） |

### AC-3.5 新建角色 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 点击"+"/新建→清空表单→填写→保存→新角色出现在侧栏角色列表中，可切换、可聊天 |
| **验证方法** | 新建角色→填写→保存→截图（侧栏 + 桌宠） |
| **证据要求** | 2 张截图（新建前 + 新建后） |
| **失败判定** | 新建后角色不出现 / 无法切换到新角色 / 数据不持久化 |
| **对应源码** | `src/renderer/components/SettingsWindow.tsx`（新建按钮→createCharacter→表单）、`src/renderer/components/ChatWindow.tsx`（sidebar角色列表更新）、`src/renderer/stores/pet-store.ts`（addCharacter + persist）、`src/main/ipc/index.ts`（character:saveAll → characters.json + 广播） |

### AC-3.6 AI 设置（API 配置）✅

| 字段 | 内容 |
|------|------|
| **量化标准** | API 设置页：可新增/编辑/删除 API Profile（名称 + baseUrl + apiKey + model），可"设为当前"切换激活配置。"测试连接"返回成功/失败结果。新建配置后出现在聊天窗口标题栏 API 选择器下拉中 |
| **验证方法** | 新建配置（填写名称/baseUrl/Key/模型）→保存→设为当前→截图（含配置列表+设为当前标记） |
| **证据要求** | 2 张截图（设置中的配置列表 + 聊天窗口标题栏 API 选择器下拉） |
| **失败判定** | 配置无法保存 / 设为当前不生效 / 标题栏 API 选择器不出现新配置 / 测试连接永远无反馈 |
| **对应源码** | `src/renderer/components/SettingsWindow.tsx`（API Profile CRUD UI + 测试连接按钮）、`src/main/ipc/index.ts`（api-profiles:getAll/saveAll/test handler）、`src/renderer/components/ChatWindow.tsx`（标题栏 API 选择器下拉）、`src/renderer/stores/pet-store.ts`（apiProfiles/activeProfileId状态）、`src/common/types.ts`（ApiProfile/Preset API_PROFILES） |

### AC-3.7 界面外观设置 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 可切换主题色（5 套）、明暗模式、显示密度（舒适/紧凑）。切换后立即生效 |
| **验证方法** | 依次切换三组设置→截图 |
| **证据要求** | 3 张截图（不同主题 + 明暗 + 密度各一），或录屏 |
| **失败判定** | 切换不生效 / 部分组件未跟随 |
| **对应源码** | `src/renderer/components/SettingsWindow.tsx`（外观设置UI：主题色块/明暗开关/密度选择）、`src/renderer/App.tsx`（data-theme/data-density属性注入）、`src/renderer/components/chat.css`+`settings.css`+`pet.css`（CSS变量响应） |

### AC-3.8 首次启动引导 ❌

| 字段 | 内容 |
|------|------|
| **量化标准** | 首次启动（无角色数据）→显示角色选择界面（角色横排卡片，含立绘+名字+"选择"按钮）→选择角色→确认→桌宠出现 + 引导气泡 |
| **验证方法** | 删除持久化数据→重启应用→截每一步 |
| **证据要求** | 3 张截图（选择界面 + 确认后桌宠出现 + 引导气泡） |
| **失败判定** | 首次启动白屏 / 无角色可选 / 选择后不生效 / 无引导 |
| **对应源码** | 当前无实现。需新增：`src/renderer/App.tsx`（首次启动路由判断）或新建 `src/renderer/components/OnboardingWindow.tsx`（角色选择卡片）、`src/main/ipc/index.ts` 中 `character:getAll` 返回空时的处理逻辑 |

### AC-3.9 右键菜单动作按钮自定义 ❌ — 2026-07-01 新增

| 字段 | 内容 |
|------|------|
| **量化标准** | 设置 → 动作标签页：可新增/删除自定义按钮（非"展开聊天"的系统动作可删）。每个按钮可编辑：显示名称、emoji、绑定视频路径（选填）。保存后在右键环形菜单中可见新按钮。点击自定义按钮→播放绑定视频或显示 emoji 反馈 |
| **验证方法** | 新增一个按钮（名称"喂食"、emoji"🍪"）→保存→右键桌宠→截图菜单确认新按钮出现→点击→截图反馈 |
| **证据要求** | 3 张截图（设置中按钮列表 + 右键菜单含新按钮 + 点击后反馈） |
| **失败判定** | 新增按钮不出现 / "展开聊天"可被删除 / 保存后丢失 / 点击无反应 |
| **对应源码** | `src/renderer/components/ActionEditor.tsx`（动作编辑UI：新增/删除/编辑字段）、`src/renderer/components/ContextMenu.tsx`（渲染按钮列表：读取actions prop渲染按钮）、`src/renderer/stores/pet-store.ts`（petActions状态→读取/保存）、`src/main/ipc/index.ts`（pet-actions:getAll/save handler）、`src/preload/index.ts`（getPetActions/savePetActions API）、`src/common/types.ts`（PetAction类型 + DEFAULT_PET_ACTIONS） |

### AC-3.10 右键聊天气泡渐隐 ❌ — 2026-07-01 新增

| 字段 | 内容 |
|------|------|
| **量化标准** | 点击聊天气泡输入框时，聊天框下移约两条消息的高度。消息超过 2 条时：最新 2 条保持全亮（opacity: 1），更早的消息逐条变淡（opacity 递减），最终消失。气泡消失动画：向上飘动 + 淡出 |
| **验证方法** | 连续发送 5 条消息→截图确认仅最新 2 条全亮、其余变淡→继续发送第 6 条→截图确认最早的消息已消失 |
| **证据要求** | 2 张截图（5 条消息时的渐隐效果 + 6 条后的消失效果） |
| **失败判定** | 超过 2 条不渐隐 / 最新 2 条也变淡 / 消息不消失 / 动画无飘动效果 |
| **对应源码** | `src/renderer/components/ContextMenu.tsx`（气泡渲染逻辑：pinnedIndices计算、opacity = 1 - age × 0.3、向上飘动+淡出动画）、`src/renderer/components/context-menu.css`（.ctx-chat-bubbles + .ctx-bubble 动画/transition） |

### AC-3.11 智能体记忆导入/导出 ❌ — 2026-07-01 新增

| 字段 | 内容 |
|------|------|
| **量化标准** | 设置 → 角色编辑 → 灵魂标签 → 智能体记忆区域：① 导出按钮→弹出保存对话框→导出为 `agent-memory-{角色名}-{日期}.json`，文件内容为 MemoryEntry[] 数组；② 导入按钮→弹出打开文件对话框→选择 JSON 文件→校验结构（必须为数组，每项含 content 字段，source 为 'ai-extracted'|'user-explicit'）→合法则追加到当前记忆列表→不合法则显示错误提示（不崩溃）；③ 导入后刷新记忆列表、System Prompt 预览同步更新 |
| **验证方法** | ① 添加 2 条记忆→导出→检查文件内容→删除所有记忆→导入→截图确认记忆恢复；② 导入一个非法 JSON（非数组/缺字段）→截图错误提示 |
| **证据要求** | 4 张截图（导出文件内容 + 导入前空列表 + 导入后恢复 + 非法文件错误提示） |
| **失败判定** | 导出文件为空 / 导入后记忆不恢复 / 非法 JSON 导致崩溃 / 导入后 System Prompt 预览不更新 |
| **对应源码** | `src/renderer/components/SettingsWindow.tsx`（灵魂标签记忆区域：导入/导出按钮 + 记忆列表 + System Prompt预览）、需新增 IPC 通道 in `src/main/ipc/index.ts`：`agent-memory:export`（dialog.showSaveDialog + writeFileSync）、`agent-memory:import`（dialog.showOpenDialog + JSON校验）；`src/preload/index.ts` 需新增：`exportAgentMemory(charId)` / `importAgentMemory(charId)` API |

---

## P4：打磨

### AC-4.1 AI 请求中状态 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 发送消息后→AI 思考期间，气泡内显示跳动点（至少 3 个点依次动画），角色显示思考表情 |
| **验证方法** | 发送消息→在回复到达前截图 |
| **证据要求** | 1 张截图（跳动点可见 + 角色思考态） |
| **失败判定** | 无加载指示 / 加载指示静止不动 |
| **对应源码** | `src/renderer/components/ChatWindow.tsx`（isStreaming状态→loading indicator渲染）、`src/renderer/components/chat.css`（跳动点动画 keyframes） |

### AC-4.2 AI 请求超时/错误 ❌

| 字段 | 内容 |
|------|------|
| **量化标准** | AI 请求超时或失败→底栏显示红色错误提示 + 重试按钮。点击重试→重新发送请求 |
| **验证方法** | 断开网络→发消息→截图错误提示→恢复网络→点重试→截图成功回复 |
| **证据要求** | 2 张截图（错误提示 + 重试后成功） |
| **失败判定** | 无错误提示 / 无重试按钮 / 重试无效 |
| **对应源码** | `src/renderer/components/ChatWindow.tsx`（catch错误→error状态 + 重试按钮）、`src/renderer/plugins/chat/api.ts`（streamChat AbortSignal超时处理）、`src/renderer/components/chat.css`（.error-bar样式） |

### AC-4.3 网络断开反馈 ❌

| 字段 | 内容 |
|------|------|
| **量化标准** | 断开网络→桌宠表情变为委屈/难过；恢复网络→自动切回正常表情 |
| **验证方法** | 断开网络→截图桌宠→恢复网络→截图桌宠 |
| **证据要求** | 2 张截图（断网表情 + 恢复后正常表情） |
| **失败判定** | 断网后表情不变 / 恢复后不切回 |
| **对应源码** | `src/renderer/components/PetWindow.tsx`（网络状态检测→sad表情切换）、`src/renderer/stores/pet-store.ts`（表情状态管理）、`src/renderer/components/pet.css`（.sad表情样式） |

### AC-4.4 暗色模式边框可见性 ❌

| 字段 | 内容 |
|------|------|
| **量化标准** | 暗色模式下，窗口边框/分割线/消息气泡之间有可辨识的视觉边界 |
| **验证方法** | 切换到暗色模式→截图整个主窗口 |
| **证据要求** | 1 张暗色模式截图 |
| **失败判定** | 相邻元素边界无法区分 / 文字对比度不足 |
| **对应源码** | `src/renderer/App.tsx`（data-theme dark属性注入）、各CSS文件需检查暗色变量：`docs/design-system.md`暗色色值定义、`src/renderer/components/chat.css`+`settings.css`+`pet.css`（border/分割线需在暗色下可见） |

---

## P5：TTS

### AC-5.1 TTS 开关与 GPU 检测 ❌

| 字段 | 内容 |
|------|------|
| **量化标准** | 有 NVIDIA GPU → TTS 区域可见但标注"待开发"。无 NVIDIA GPU → TTS 区域灰掉 + 提示"需要 NVIDIA 显卡"。当前阶段 TTS 不可用，不影响其他功能 |
| **验证方法** | 打开设置→查看 TTS 区域→截图 |
| **证据要求** | 1 张截图（TTS 区域状态 + GPU 提示） |
| **失败判定** | TTS 区域状态与 GPU 实际情况不符 / "待开发"标识缺失 |
| **对应源码** | 整阶段未启动。需新增：`src/main/ipc/index.ts`（GPU检测 handler）、`src/renderer/components/SettingsWindow.tsx`（TTS设置区域UI）、`src/main/index.ts`（启动时GPU检测逻辑） |

### AC-5.2 TTS 播放 ❌

| 字段 | 内容 |
|------|------|
| **量化标准** | TTS 开启→AI 回复后自动播放语音。播放期间角色展示"说话中"表情（talk 动画） |
| **验证方法** | 开启 TTS→发送消息→AI 回复→录屏（含声音波形或角色 talk 动画） |
| **证据要求** | 录屏（GIF/MP4，≤15 秒，含角色 talk 动画） |
| **失败判定** | 无声音 / 角色无 talk 动画 / 播放中断后无法恢复 |
| **对应源码** | 整阶段未启动。需新增：TTS服务模块（`src/main/tts-service.ts`或等效方案）、`src/renderer/plugins/tts/index.ts`（播放控制）、`src/renderer/components/PetWindow.tsx`（talk表情同步） |

### AC-5.3 TTS 打断 ❌

| 字段 | 内容 |
|------|------|
| **量化标准** | TTS 播放中发送新消息→旧语音立即停止→新回复语音开始播放 |
| **验证方法** | 录屏：发消息 A → 播放中发消息 B → 语音切换 |
| **证据要求** | 录屏（GIF/MP4，≤15 秒） |
| **失败判定** | 旧语音不停止 / 新旧叠加 / 新语音不播放 |
| **对应源码** | 同 AC-5.2。需在 `src/renderer/plugins/tts/index.ts` 中实现 AbortController 打断逻辑 |

### AC-5.4 TTS 失败降级 ❌

| 字段 | 内容 |
|------|------|
| **量化标准** | TTS 生成失败→角色展示 silent/捂嘴表情→纯文字气泡仍然正常显示（降级，不影响聊天） |
| **验证方法** | 模拟 TTS 失败情况→截图 |
| **证据要求** | 1 张截图（silent 表情 + 纯文字气泡可见） |
| **失败判定** | TTS 失败导致文字气泡也不显示 / 角色无表情反馈 |
| **对应源码** | 同 AC-5.2。需在 `src/renderer/plugins/tts/index.ts` 中 catch TTS错误→emit silent表情事件、`src/renderer/components/PetWindow.tsx`（silent表情响应） |

---

## P6：打包与分发

> ⚠️ **P6 验收与 P0-P5 功能验收独立。** 功能全部通过但打包失败 = 不可交付。

### AC-6.1 源码构建 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | `npx electron-vite build` 成功退出（exit code 0），`out/` 目录生成 `main/index.js`、`preload/index.js`、`renderer/index.html` 三个入口文件，无 TypeScript 编译错误 |
| **验证方法** | 删除 `out/` → 执行 `npx electron-vite build` → 检查 exit code 和产物 |
| **证据要求** | 终端截图（含 build 命令 + exit code 0 + 产物列表 `ls out/main/ out/preload/ out/renderer/`） |
| **失败判定** | build 报错 / exit code ≠ 0 / 三个入口文件任一缺失 |
| **对应源码** | `electron.vite.config.ts`（构建配置）、`tsconfig.json`+`tsconfig.node.json`（TS编译配置）、`package.json`（build script） |

### AC-6.2 解压目录可直接运行 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | `dist/win-unpacked/` 目录存在，包含 `AI伴侣.exe` + `resources/app.asar`。双击 exe 或命令行启动后：出现聊天窗口 + 桌宠窗口 + 系统托盘图标（三个窗口载体全部正常），无崩溃/白屏 |
| **验证方法** | 启动 `"./dist/win-unpacked/AI伴侣.exe"` → 等待窗口出现 → 发送一条测试消息 → 截图 |
| **证据要求** | 3 张截图（资源管理器目录结构 + 启动后聊天窗口 + 系统托盘图标可见） |
| **失败判定** | exe 双击无反应 / 启动白屏 / 崩溃 / 托盘图标缺失 / app.asar 不存在 |
| **对应源码** | `electron-builder.yml`（dir target 配置）、`package.json`（name/version/author/main 字段）、`resources/icon.ico`（应用图标） |

### AC-6.3 app.asar 内容完整 🔧

| 字段 | 内容 |
|------|------|
| **量化标准** | `resources/app.asar` 包含完整的 `main/`、`preload/`、`renderer/` 代码。asar 包内不含 `node_modules/`（按 electron-builder.yml files 配置排除）。asar 包大小在合理范围（当前 ~600KB，不含 node_modules 膨胀） |
| **验证方法** | `npx asar list dist/win-unpacked/resources/app.asar` → 检查输出含 `main/index.js`、`preload/index.js`、`renderer/index.html` → `npx asar list ... | wc -l` 确认文件数 > 10 |
| **证据要求** | 终端截图（asar list 输出 + 确认含三个入口文件） |
| **失败判定** | asar 不存在 / 包内缺少任一入口文件 / 包内包含 node_modules / 包体 < 50KB（可能为空包） |
| **对应源码** | `electron-builder.yml`（files 字段：`out/**/*` + `!node_modules`）、构建流程：`electron-vite build` → `npx asar pack out resources/app.asar` |

### AC-6.4 打包后托盘图标正常 ✅

| 字段 | 内容 |
|------|------|
| **量化标准** | 打包版应用启动后，系统托盘出现品红色聊天气泡图标。图标在浅色和深色任务栏上均肉眼可见。右键托盘菜单 4 项完整（显示/隐藏聊天、显示/隐藏桌宠、分隔线、退出） |
| **验证方法** | 启动打包版 → 查看托盘区 → 右键托盘图标 → 截图整个托盘菜单 |
| **证据要求** | 2 张截图（托盘区图标可见 + 右键菜单展开状态） |
| **失败判定** | 托盘图标不出现 / 图标空白/透明 / 菜单项缺失 / 点击菜单项无反应 |
| **对应源码** | `src/main/index.ts`（createTray: nativeImage base64 → Tray实例化 → Menu模板）、`resources/icon.ico`（应用图标，32×32） |

### AC-6.5 打包后 IPC 通道全功能可用 ❌

| 字段 | 内容 |
|------|------|
| **量化标准** | 打包版应用中（非 dev 模式），全部 20+ IPC 通道正常工作。至少验证以下关键通道：① 角色 CRUD（新建→保存→重启→角色仍在）② API Profile CRUD（新建配置→设为当前→测试连接→重启→配置仍在）③ 聊天历史持久化（发消息→重启→历史仍在）④ 桌宠拖拽（movePet 不报错）⑤ 图片上传（openImage 对话框正常弹出） |
| **验证方法** | 逐项执行：新建角色→重启→检查 / 新建 API Profile→测试连接→重启→检查 / 发消息→重启→检查 / 拖拽桌宠→检查 / 上传角色图片→检查 |
| **证据要求** | 5 张截图（每项验证的截图：重启前后对比）或 1 段完整录屏（≤60 秒，覆盖全部 5 项） |
| **失败判定** | 任一 IPC 通道报错 / 数据未持久化 / 对话框不弹出 / 重启后数据丢失 |
| **对应源码** | `src/main/ipc/index.ts`（全部 IPC handler + JSON 文件读写）、`src/preload/index.ts`（全部 contextBridge API）、持久化路径 `%APPDATA%/ai-companion/` |

### AC-6.6 持久化数据路径正确 ❌

| 字段 | 内容 |
|------|------|
| **量化标准** | 打包版应用的数据存储在 `%APPDATA%/ai-companion/` 目录下（而非项目目录、临时目录或其他位置）。该目录包含 `characters.json`、`api-profiles.json`、`chat-history.json`、`agent-memory.json`、`pet-actions.json` 至少 5 个 JSON 文件。文件内容为合法 JSON，非空 |
| **验证方法** | 启动打包版 → 执行一些操作（新建角色/发消息/改设置）→ 打开 `%APPDATA%/ai-companion/` → 截图目录内容 → 用文本编辑器打开 `characters.json` 截图内容 |
| **证据要求** | 2 张截图（目录文件列表 + characters.json 内容片段） |
| **失败判定** | 数据文件未出现在 `%APPDATA%/ai-companion/` / 文件为空 / JSON 格式损坏 / 数据写到了项目目录或其他位置 |
| **对应源码** | `src/main/index.ts`（`app.getPath('userData')` 路径）、`src/main/ipc/index.ts`（所有 `join(app.getPath('userData'), ...)` 文件路径） |

### AC-6.7 应用元数据正确 ❌

| 字段 | 内容 |
|------|------|
| **量化标准** | 打包版 exe 属性中：产品名称为"AI伴侣"、文件版本与 `package.json` 的 `version` 字段一致（当前 0.1.0）。任务管理器中进程名为 `AI伴侣.exe`（非 `electron.exe`）。窗口标题栏显示"AI伴侣" |
| **验证方法** | 右键 exe → 属性 → 详细信息 → 截图 / 任务管理器 → 截图进程名 / 启动应用 → 截图标题栏 |
| **证据要求** | 3 张截图（exe 属性详细信息 + 任务管理器进程名 + 窗口标题栏） |
| **失败判定** | 进程名显示为 electron.exe / 产品名称缺失或错误 / 版本号不匹配 |
| **对应源码** | `package.json`（name/version/author）、`electron-builder.yml`（appId/productName）、`src/main/windows/chat.ts`（窗口 title） |

### AC-6.8 NSIS 安装器可用 ❌

| 字段 | 内容 |
|------|------|
| **量化标准** | `dist/` 下存在 `AI伴侣 Setup X.Y.Z.exe` NSIS 安装器文件。安装器可正常启动，显示安装向导（含目录选择页），用户可选择安装路径。安装完成后：桌面出现快捷方式（可选勾选）、开始菜单出现程序组、程序可正常启动。卸载（通过 Windows 设置 → 应用 或开始菜单卸载快捷方式）后：安装目录清空、`%APPDATA%/ai-companion/` 下的用户数据**保留**（卸载不删用户数据） |
| **验证方法** | 运行安装器 → 选择自定义目录 → 完成安装 → 检查桌面快捷方式 + 开始菜单 → 启动 → 截图 → 卸载 → 检查安装目录是否清空 → 检查 `%APPDATA%/ai-companion/` 数据是否保留 |
| **证据要求** | 5 张截图（安装向导目录选择页 + 安装完成桌面快捷方式 + 启动后主窗口 + 卸载后安装目录已空 + 用户数据目录仍存在） |
| **失败判定** | 安装器无法启动 / 无目录选择页（oneClick 模式） / 安装后快捷方式缺失 / 卸载失败 / 卸载删除了用户数据（数据丢失事故） |
| **对应源码** | `electron-builder.yml`（nsis: oneClick: false + allowToChangeInstallationDirectory: true）、`package.json`（version → 安装器文件名） |

### AC-6.9 打包体积可接受 ❌

| 字段 | 内容 |
|------|------|
| **量化标准** | 解压目录总大小 ≤ 300MB（Electron ~170MB + Chromium ~90MB + app.asar ~1MB + 预留）。NSIS 安装器 ≤ 100MB（压缩后）。不包含 `node_modules/` 原始目录 |
| **验证方法** | 右键 `dist/win-unpacked/` → 属性 → 截图大小 / 右键安装器 exe → 属性 → 截图大小 |
| **证据要求** | 2 张截图（解压目录大小 + 安装器大小） |
| **失败判定** | 解压目录 > 500MB（可能误打包了 node_modules）/ 安装器 > 200MB / app.asar 超过 10MB（可能含 node_modules 或大文件） |
| **对应源码** | `electron-builder.yml`（files：`out/**/*` + `!node_modules` 排除规则）、`package.json`（dependencies vs devDependencies 分离——electron-builder 自动排除 devDependencies） |

---

### P6 AC 分配表（子代理）

| AC | 状态 | Architect | Coder | Test Writer | Verifier | Reviewer |
|----|------|:--:|:--:|:--:|:--:|:--:|
| AC-6.1 源码构建 | ✅ | — | — | — | — | 回归时 |
| AC-6.2 解压目录可运行 | ✅ | — | — | — | — | 回归时 |
| AC-6.3 app.asar 完整 | 🔧 | ✅ | ✅ | ✅ | ✅ | ✅ |
| AC-6.4 打包后托盘正常 | ✅ | — | — | — | — | 回归时 |
| AC-6.5 打包后 IPC 全功能 | ❌ | ✅ | — | ✅ | ✅ | ✅ |
| AC-6.6 持久化路径正确 | ❌ | ✅ | — | ✅ | ✅ | ✅ |
| AC-6.7 应用元数据正确 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AC-6.8 NSIS 安装器 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AC-6.9 打包体积可接受 | ❌ | ✅ | — | ✅ | ✅ | ✅ |

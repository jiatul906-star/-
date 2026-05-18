# TTS 方案分析

> 状态：**已确定 — IndexTTS** | 最后更新：2026-05-17

## 约束条件

- Electron 桌面应用
- 中文语音为主
- 4 个角色需要不同音色
- 偏好流式播放（边生成边播）
- 成本敏感（独立项目）
- **所有方案必须零用户门槛**（用户不需要注册账号或获取 Key）

---

## 评估过程

| 方案 | 音质 | 用户门槛 | 结论 |
|------|------|---------|------|
| A. Edge-TTS | 已试听，用户评价不行 | 零 | ❌ 音质不达标 |
| B. 浏览器 SpeechSynthesis | 机器人味 | 零 | ❌ 未试听，音质比 Edge 更差 |
| C. 讯飞/火山/腾讯云 | 顶尖 | **需注册认证拿 Key** | ❌ 用户劝退 |
| D. 本地 IndexTTS | 顶尖 | 零 | ✅ 已确定 |
| E. Azure/OpenAI 付费 | 顶尖 | 需绑卡付费 | ❌ 有成本 + 门槛 |

---

## 最终方案：IndexTTS

B 站开源，Apache 协议可商用。零样本语音克隆——每个角色给 3-5 秒参考音频即可生成该音色的语音。

| 维度 | 说明 |
|------|------|
| 音质 | MOS 4.01，中文开源最强 |
| 协议 | Apache，商用安全 |
| 成本 | 零 |
| 用户操作 | 零，软件自带 |
| 模型体积 | ~2.3GB |
| 硬件 | 需 NVIDIA 显卡（GTX 1660 6G 最低，推荐 RTX 3060 12G） |
| 4 个角色 | 每个角色一段参考音频 → 零样本克隆 |
| 流式播放 | 支持 |
| Windows | IndexTTS2 v4 原生支持 |

**仓库：** `github.com/index-tts/index-tts`
**模型：** `huggingface.co/IndexTeam/IndexTTS-1.5`

---

## 集成架构

```
Electron 主进程
    │
    ├── 用户输入 → AI 返回文本
    │
    ├── HTML5 Audio 播放
    │       ↑
    │       │ (mp3 buffer → IPC → renderer)
    │       │
    ├── Python 子进程（IndexTTS HTTP 服务）
    │       ├── POST /tts { text, voice_id }
    │       └── 返回: audio/mpeg
    │
    └── 4 个角色的参考音频
            ├── xiaotao_ref.wav  (元气少女)
            ├── xiaohei_ref.wav  (傲娇)
            ├── xiaoxue_ref.wav  (温柔)
            └── xiaohui_ref.wav  (冷淡)
```

- Electron 启动时拉起 Python HTTP 服务（localhost）
- 需要播放时发 POST 请求
- IndexTTS 用对应角色的参考音频合成，返回 mp3
- Electron 播放，角色同步 talk 动画

---

## 4 个角色声音配置

### 传统方案改为参考音频方案

不再需要配置 voiceId/speed/pitch，而是每个角色存一段参考音频：

```
角色数据目录/
├── 小桃/
│   ├── ref_voice.wav      ← 3-5 秒参考音频（用户在设置里可替换）
│   └── ...
├── 小黑/
│   └── ref_voice.wav
├── 小雪/
│   └── ref_voice.wav
└── 小灰/
    └── ref_voice.wav
```

4 个官方预制角色的参考音频由用户提供，用户自带的声音素材。
用户后续 DIY 创建新角色时，也可以上传新的参考音频来定义新角色的声音。

### 参考音频要求

| 参数 | 要求 |
|------|------|
| 时长 | 3-5 秒 |
| 格式 | WAV 或 MP3 |
| 内容 | 自然说话，覆盖角色典型语气 |
| 背景 | 安静，无杂音/混响 |
| 情绪 | 中性或符合角色性格 |

---

## 硬件要求与用户提示

软件安装时检测 GPU：

| GPU 情况 | 行为 |
|----------|------|
| NVIDIA 显存 ≥ 8G | 自动启用 IndexTTS |
| NVIDIA 显存 4-6G | 启用，但标注"可能较慢" |
| 无 NVIDIA / 显存 < 4G | TTS 功能灰掉，提示"需要 NVIDIA 显卡"，降级为纯文本聊天 |

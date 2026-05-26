# 角色立绘表情差分 — Midjourney 生成 Prompt

## 使用方式

1. Discord 私聊 Midjourney Bot，上传立绘 → 右键复制图片链接
2. 替换下面 `[立绘URL]` 为你的图片链接
3. 逐条发送 `/imagine`
4. 每次出 4 张，U1~U4 放大满意的，🔄 重新生成
5. 先用 1 个表情试效果，确认 `--ow` 参数合适后再跑其余

---

## 通用参数说明

| 参数 | 含义 |
|------|------|
| `--oref [URL]` | Omni Reference，用立绘锁定角色外观 |
| `--ow 350` | Omni Weight，300~400 平衡一致性与表情变化 |
| `--v 7.0` | 使用 Midjourney V7 模型 |
| `--ar 2:3` | 竖幅，接近 512×768 立绘比例 |

---

## 7 个表情 Prompt

### 1. 开心

```
/imagine prompt: same character, bright smile, eyes curved happily, cheerful expression, warm soft lighting --oref [立绘URL] --ow 350 --v 7.0 --ar 2:3
```

### 2. 害羞

```
/imagine prompt: same character, blushing cheeks, looking down shyly, embarrassed expression, pink tones --oref [立绘URL] --ow 350 --v 7.0 --ar 2:3
```

### 3. 生气

```
/imagine prompt: same character, furrowed brows, glaring eyes, angry pouting, irritated expression --oref [立绘URL] --ow 350 --v 7.0 --ar 2:3
```

### 4. 思考

```
/imagine prompt: same character, head slightly tilted, hand touching chin, pondering expression, eyes looking upward thoughtfully --oref [立绘URL] --ow 350 --v 7.0 --ar 2:3
```

### 5. 难过

```
/imagine prompt: same character, teary moist eyes, downcast gaze, sad melancholy expression, soft blue-grey cool lighting --oref [立绘URL] --ow 350 --v 7.0 --ar 2:3
```

### 6. 惊讶

```
/imagine prompt: same character, eyes wide open, mouth slightly open, startled surprised expression, caught off guard --oref [立绘URL] --ow 350 --v 7.0 --ar 2:3
```

### 7. 无奈

```
/imagine prompt: same character, wry forced smile, sighing expression, sweat drop feeling, resigned helpless look --oref [立绘URL] --ow 350 --v 7.0 --ar 2:3
```

---

## 调参指南

| 问题 | 调整 |
|------|------|
| 表情不够明显 | `--ow` 降到 200 |
| 角色不像了、画风跑了 | `--ow` 提到 400 |
| 出图太慢 | 加 `--draft` 快速预览，确认好再去掉 |
| 身体/衣服变了 | 正常现象，MJ 做不到像素级锁身体，后续手动修 |

---

## 文件命名

出图后挑最好的一张，手动修一下不自然的地方，按以下格式命名：

```
{角色名}_stand_{表情}.png

例：
role_stand_happy.png
role_stand_shy.png
role_stand_angry.png
role_stand_thinking.png
role_stand_sad.png
role_stand_surprised.png
role_stand_helpless.png
```

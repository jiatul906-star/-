# 角色立绘表情差分 — Midjourney 网页版生成 Prompt

## 工作流

先用 Midjourney 生成各表情的**静态图片**，确认角色一致性和表情到位后，再导入视频工具做成动态表情。

## 一、准备工作

1. 打开 [midjourney.com](https://www.midjourney.com) 网页版
2. 右上角 **设置 → 模型版本 → 选 V7**
3. 准备好角色**中性表情**的立绘图（不笑不怒不张嘴，否则原图表情会"污染"所有结果）

## 二、操作步骤（核心）

每一步都按这个来：

1. 在中间输入框输入下方的 prompt 文字
2. 把立绘图片**拖入输入框旁边**，会弹出几个区域选项 → **选「Omni Reference」那个框**
3. Omni Reference 旁边的**滑块调到 200**（默认是 100）
4. 宽高比选 **2:3**
5. 点生成

> 调参：表情不够明显 → 滑块降到 100；角色不像了 → 滑块提到 300~400

---

## 三、7 个表情 Prompt（复制到输入框即可）

### 1. 开心
```
same character, slightly parted lips, upper lip raised, nasolabial folds visible, lower eyelid slightly tensed, eyes narrowed with crow's feet, cheeks lifted, genuine warm expression
```

### 2. 害羞
```
same character, head slightly tilted down, eyes looking downward and to the side, cheeks flushed pink, lips pressed together softly, eyebrows relaxed, avoiding eye contact
```

### 3. 生气
```
same character, eyebrows lowered and drawn together, vertical furrow between brows, eyes narrowed with intense gaze, lips pressed tight, jaw clenched, slight nostril flare
```

### 4. 思考
```
same character, head tilted slightly to one side, eyes looking upward and to the side, one eyebrow slightly raised, lips gently pursed, chin resting on hand, unfocused distant gaze
```

### 5. 难过
```
same character, inner eyebrows drawn upward, slight downturn at mouth corners, eyes slightly glossy with moisture, lower lip slightly pushed out, gaze directed downward, facial muscles relaxed and heavy
```

### 6. 惊讶
```
same character, eyebrows raised high, eyes widened showing more of the whites, mouth slightly open in a small O shape, jaw dropped slightly, upper eyelids fully retracted
```

### 7. 无奈
```
same character, one eyebrow raised higher than the other, asymmetrical wry smile with one corner of mouth pulled sideways, eyes half-lidded, slight head shake, resigned expression
```

---

## 四、常见问题

| 问题 | 解决 |
|------|------|
| 表情出不来 | Omni Reference 滑块降到 100 |
| 角色不像了 | 滑块提到 300~400 |
| 某个表情死活不对 | 换一张**中性表情**的立绘重新做参考图 |
| 身体/衣服变了 | 正常，MJ 做不到像素级锁身体，后续手动修 |
| 动漫风角色 | 模型换成 **Niji 7**（设置里切换） |

---

## 五、文件命名

出图后挑最好的，手动修一下不自然处，按格式命名：

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

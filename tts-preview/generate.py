import asyncio, edge_tts, os

voices = [
    ("zh-CN-XiaoxiaoNeural", "元气少女"),
    ("zh-CN-XiaoyiNeural", "傲娇"),
    ("zh-CN-YunjianNeural", "温柔少年"),
    ("zh-CN-YunxiNeural", "冷淡"),
]

texts = [
    "你好呀！从今天起我就是你的桌面小伙伴啦，请多关照哦！",
    "哼，才不是特意来陪你的呢。不过既然来了，就好好相处吧。",
]

async def gen():
    for voice_id, label in voices:
        for i, text in enumerate(texts):
            fname = os.path.join(os.path.dirname(__file__), f"{label}_{i+1}.mp3")
            try:
                comm = edge_tts.Communicate(text, voice_id)
                await comm.save(fname)
                size = os.path.getsize(fname)
                print(f"OK: {label} [{i+1}/2] {size//1024}KB")
            except Exception as e:
                print(f"FAIL: {label} [{i+1}/2] {e}")

asyncio.run(gen())

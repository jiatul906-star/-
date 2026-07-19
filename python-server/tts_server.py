"""
IndexTTS HTTP 服务 — 由 Electron 主进程作为子进程拉起

端点：
  POST /tts        合成语音 { text, speaker, reference_audio } → audio/mpeg
  GET  /health      健康检查 → 200 OK
  POST /shutdown    优雅关闭

启动：python tts_server.py --port 9876

依赖：pip install index-tts fastapi uvicorn
"""

import argparse
import io
import os
import sys
import traceback
from pathlib import Path

# ===== 配置 =====
# 模型目录：由 Electron 通过环境变量 MODEL_DIR 传入，或使用默认路径
MODEL_DIR = os.environ.get("INDEX_TTS_MODEL_DIR", "")
if not MODEL_DIR:
    # 默认：%APPDATA%/with-u/models/index-tts/
    appdata = os.environ.get("APPDATA", os.path.expanduser("~"))
    MODEL_DIR = os.path.join(appdata, "with-u", "models", "index-tts")

# ===== FastAPI 应用 =====
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
import uvicorn

app = FastAPI(title="IndexTTS Server", version="0.1.0")

# 延迟加载 IndexTTS（避免启动时占用大量内存）
_tts_model = None

def get_model():
    """延迟加载 IndexTTS 模型"""
    global _tts_model
    if _tts_model is None:
        try:
            from index_tts import IndexTTS
            _tts_model = IndexTTS(
                model_dir=MODEL_DIR,
                device="cuda",  # 默认 CUDA；无 GPU 时不启用此服务
            )
        except ImportError:
            raise HTTPException(status_code=500, detail="IndexTTS 未安装。请运行: pip install index-tts")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"模型加载失败: {str(e)}")
    return _tts_model


@app.get("/health")
def health():
    """健康检查端点"""
    # 检查模型目录是否存在
    if not os.path.isdir(MODEL_DIR):
        return {"status": "no_model", "model_dir": MODEL_DIR}
    # 检查是否有模型文件
    files = list(Path(MODEL_DIR).glob("*.safetensors")) + list(Path(MODEL_DIR).glob("*.bin"))
    if not files:
        return {"status": "model_missing", "model_dir": MODEL_DIR}
    return {"status": "ok", "model_dir": MODEL_DIR}


@app.post("/tts")
def synthesize(request: dict):
    """
    合成语音

    请求体：
      { "text": "你好呀", "speaker": "小桃", "reference_audio": "/path/to/ref_voice.wav" }

    返回：audio/wav 二进制
    """
    text = request.get("text", "").strip()
    speaker = request.get("speaker", "unknown")
    ref_audio = request.get("reference_audio", "")

    if not text:
        raise HTTPException(status_code=400, detail="text 不能为空")

    if not ref_audio or not os.path.isfile(ref_audio):
        raise HTTPException(status_code=400, detail=f"参考音频不存在: {ref_audio}")

    try:
        model = get_model()
        # IndexTTS 合成接口（根据实际 SDK 调整）
        audio_bytes = model.synthesize(
            text=text,
            reference_audio=ref_audio,
        )
        return Response(content=audio_bytes, media_type="audio/wav")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"合成失败: {str(e)}")


@app.post("/shutdown")
def shutdown():
    """优雅关闭"""
    import signal
    os.kill(os.getpid(), signal.SIGTERM)
    return {"status": "shutting_down"}


# ===== 入口 =====
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IndexTTS HTTP Server")
    parser.add_argument("--port", type=int, default=9876, help="监听端口")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="绑定地址")
    args = parser.parse_args()

    print(f"[tts_server] 模型目录: {MODEL_DIR}", flush=True)
    print(f"[tts_server] 启动 http://{args.host}:{args.port}", flush=True)

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
else:
    # 作为模块导入时（uvicorn 直接加载），提供 app 实例即可
    # uvicorn python-server.tts_server:app --port 9876
    pass

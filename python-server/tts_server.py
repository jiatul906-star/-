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

# ===== torchaudio 补丁：使用 soundfile 后端（避免需要安装 FFmpeg） =====
def _patch_torchaudio():
    """用 soundfile 替换 torchaudio.load/save，避免 torchcodec/FFmpeg 依赖"""
    try:
        import soundfile as sf
        import torch
        import numpy as np

        def _sf_load(path, *args, **kwargs):
            data, sr = sf.read(path, dtype='float32')
            if data.ndim == 1:
                data = data[:, None]  # (N,) -> (N, 1)
            # torchaudio 格式: (channels, samples)
            # soundfile 读取后 data 是 (samples, channels)
            audio = torch.from_numpy(data.T.copy())
            return audio, sr

        def _sf_save(path, tensor, sample_rate, *args, **kwargs):
            # tensor 格式: (channels, samples), soundfile 需要 (samples, channels)
            audio = tensor.cpu().numpy().T
            sf.write(path, audio, sample_rate)

        import torchaudio
        torchaudio.load = _sf_load
        torchaudio.save = _sf_save
        print("[tts_server] torchaudio 已切换到 soundfile 后端 (load + save)", flush=True)
    except Exception as e:
        print(f"[tts_server] torchaudio 补丁失败: {e}", flush=True)

_patch_torchaudio()

# ===== ???? =====
def detect_device(device_arg):
    """?? --device ???????????"""
    if device_arg == "cuda":
        return "cuda"
    if device_arg == "cpu":
        return "cpu"
    # auto: ??????
    try:
        import torch
        if torch.cuda.is_available():
            print("[tts_server] ??? NVIDIA GPU??? CUDA ??", flush=True)
            return "cuda"
        else:
            print("[tts_server] ???? NVIDIA GPU??? CPU??????", flush=True)
            return "cpu"
    except ImportError:
        print("[tts_server] torch ?????? CPU", flush=True)
        return "cpu"

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
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="IndexTTS Server", version="0.1.0")

class TtsRequest(BaseModel):
    text: str
    speaker: str = "unknown"
    reference_audio: str = ""

# 延迟加载 IndexTTS（避免启动时占用大量内存）
# DEVICE_ARG 在 __main__ 中由 CLI --device 参数覆盖
DEVICE_ARG = "auto"

_tts_model = None

def get_model():
    """延迟加载 IndexTTS 模型"""
    global _tts_model
    if _tts_model is None:
        try:
            from indextts.infer import IndexTTS
            cfg_path = os.path.join(MODEL_DIR, "config.yaml")
            if not os.path.isfile(cfg_path):
                raise FileNotFoundError(f"模型配置文件不存在: {cfg_path}")
            _tts_model = IndexTTS(
                cfg_path=cfg_path,
                model_dir=MODEL_DIR,
                is_fp16=(detect_device(DEVICE_ARG) == "cuda"),
                device=detect_device(DEVICE_ARG),
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
    # 检查是否有模型文件（支持 .pth / .safetensors / .bin）
    files = list(Path(MODEL_DIR).glob("*.pth")) + list(Path(MODEL_DIR).glob("*.safetensors")) + list(Path(MODEL_DIR).glob("*.bin"))
    if not files:
        return {"status": "model_missing", "model_dir": MODEL_DIR}
    return {"status": "ok", "model_dir": MODEL_DIR}


@app.post("/tts")
def synthesize(req: TtsRequest):
    """
    合成语音

    请求体：
      { "text": "你好呀", "speaker": "小桃", "reference_audio": "/path/to/ref_voice.wav" }

    返回：audio/wav 二进制
    """
    import tempfile

    text = req.text.strip()
    speaker = req.speaker
    ref_audio = req.reference_audio

    if not text:
        raise HTTPException(status_code=400, detail="text 不能为空")

    if not ref_audio or not os.path.isfile(ref_audio):
        raise HTTPException(status_code=400, detail=f"参考音频不存在: {ref_audio}")

    try:
        model = get_model()
        # IndexTTS.infer() 需要 output_path — 合成结果写入文件
        # 返回 output_path (str) 表示成功
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
        try:
            model.infer(
                audio_prompt=ref_audio,
                text=text,
                output_path=tmp_path,
            )
            if not os.path.isfile(tmp_path) or os.path.getsize(tmp_path) == 0:
                raise HTTPException(status_code=500, detail="合成失败：未生成音频文件")
            with open(tmp_path, "rb") as f:
                audio_bytes = f.read()
        finally:
            if os.path.isfile(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

        return Response(content=audio_bytes, media_type="audio/wav")
    except HTTPException:
        raise
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
    parser.add_argument("--device", type=str, default="auto", choices=["auto", "cpu", "cuda"],
                        help="推理设备: auto=自动检测, cpu=仅CPU, cuda=强制CUDA")
    args = parser.parse_args()

    DEVICE_ARG = args.device

    print(f"[tts_server] 模型目录: {MODEL_DIR}", flush=True)
    print(f"[tts_server] 设备: {DEVICE_ARG} -> {detect_device(DEVICE_ARG)}", flush=True)
    print(f"[tts_server] 启动 http://{args.host}:{args.port}", flush=True)

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
else:
    # 作为模块导入时（uvicorn 直接加载），提供 app 实例即可
    # uvicorn python-server.tts_server:app --port 9876
    pass


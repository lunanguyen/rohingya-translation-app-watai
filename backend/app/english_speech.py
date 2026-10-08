import io
import tempfile
from functools import lru_cache

import edge_tts
from faster_whisper import WhisperModel

from .config import settings

ENGLISH_VOICE = "en-US-AriaNeural"


@lru_cache
def _whisper() -> WhisperModel:
    # CPU-only: this backend has no GPU, that's what the Colab model server is for.
    return WhisperModel(settings.whisper_model_size, device="cpu", compute_type="int8")


def asr_english(audio_bytes: bytes) -> str:
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        tmp.write(audio_bytes)
        tmp.flush()
        segments, _ = _whisper().transcribe(tmp.name, language="en")
        return " ".join(seg.text.strip() for seg in segments).strip()


async def tts_english(text: str) -> bytes:
    communicate = edge_tts.Communicate(text, ENGLISH_VOICE)
    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    return buf.getvalue()

import httpx

from .config import settings


class ModelServerError(RuntimeError):
    pass


def _base_url() -> str:
    if not settings.model_server_url:
        raise ModelServerError(
            "MODEL_SERVER_URL is not set in backend/.env -- "
            "paste in the ngrok URL printed by the Colab notebook."
        )
    return settings.model_server_url.rstrip("/")


async def asr_rohingya(audio_bytes: bytes, filename: str = "audio.wav") -> str:
    """Sends audio to the Colab-hosted MMS ASR (rhg adapter) and returns the
    transcribed text, in whatever script the model actually outputs.
    """
    url = f"{_base_url()}/asr"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, files={"file": (filename, audio_bytes, "audio/wav")})
        resp.raise_for_status()
        data = resp.json()
        return data["text"]


async def tts_rohingya(text: str) -> bytes:
    """Sends text to the Colab-hosted MMS-TTS-rhg model, returns WAV bytes."""
    url = f"{_base_url()}/tts"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, json={"text": text})
        resp.raise_for_status()
        return resp.content


async def health_check() -> dict:
    url = f"{_base_url()}/health"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()

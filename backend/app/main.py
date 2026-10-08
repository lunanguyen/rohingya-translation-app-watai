import base64
import logging

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import english_speech, model_client
from .glossary import all_phrases, match_english, match_rohingya
from .translate import llm_translate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rohingya-backend")

app = FastAPI(title="Rohingya Voice Link Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    out = {"backend": "ok"}
    try:
        out["model_server"] = await model_client.health_check()
    except Exception as e:
        out["model_server"] = f"unreachable: {e}"
    return out


@app.get("/phrases")
async def phrases():
    return all_phrases()


class SynthesizeRequest(BaseModel):
    text: str


@app.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    """Fallback for Quick Cards entries with no pre-recorded audio_url: synthesizes
    the (human-verified) Rohingya text via the Colab-hosted MMS-TTS-rhg model.
    """
    try:
        audio = await model_client.tts_rohingya(req.text)
    except model_client.ModelServerError as e:
        raise HTTPException(503, str(e))
    return {"audio_base64": base64.b64encode(audio).decode("ascii")}


@app.post("/translate-speech")
async def translate_speech(file: UploadFile = File(...), direction: str = Form(...)):
    if direction not in ("rhg2en", "en2rhg"):
        raise HTTPException(400, "direction must be 'rhg2en' or 'en2rhg'")

    audio_bytes = await file.read()

    try:
        if direction == "rhg2en":
            input_text = await model_client.asr_rohingya(audio_bytes, file.filename or "audio.wav")
            hit = match_rohingya(input_text)
            if hit:
                output_text = hit["english"]
                source = "glossary"
                verified = True
            else:
                output_text = llm_translate(input_text, "rhg2en")
                source = "llm"
                verified = False
            audio_out = await english_speech.tts_english(output_text)

        else:  # en2rhg
            input_text = english_speech.asr_english(audio_bytes)
            hit = match_english(input_text)
            if hit:
                output_text = hit["rohingya_latin"]
                source = "glossary"
                verified = True
                if hit.get("audio_url"):
                    # Prefer the human-recorded TWB audio over synthesized TTS.
                    import httpx

                    async with httpx.AsyncClient(timeout=20.0) as client:
                        r = await client.get(hit["audio_url"])
                        if r.status_code == 200:
                            audio_out = r.content
                        else:
                            audio_out = await model_client.tts_rohingya(output_text)
                else:
                    audio_out = await model_client.tts_rohingya(output_text)
            else:
                output_text = llm_translate(input_text, "en2rhg")
                source = "llm"
                verified = False
                audio_out = await model_client.tts_rohingya(output_text)

    except model_client.ModelServerError as e:
        raise HTTPException(503, str(e))
    except Exception:
        logger.exception("translate-speech failed")
        raise HTTPException(500, "translation pipeline failed, check backend logs")

    return {
        "input_text": input_text,
        "output_text": output_text,
        "source": source,
        "verified": verified,
        "audio_base64": base64.b64encode(audio_out).decode("ascii"),
    }

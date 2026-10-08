from __future__ import annotations

import random
import time

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from .config import settings
from .glossary import all_phrases

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not set in backend/.env")
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _few_shot_examples(n: int = 12) -> str:
    """Grounds the LLM with real, human-verified glossary pairs so it has
    some signal on Rohingya vocabulary/orthography instead of translating
    from near-zero exposure. Sampled fresh each call for variety.
    """
    phrases = [p for p in all_phrases() if p.get("rohingya_latin")]
    sample = random.sample(phrases, min(n, len(phrases)))
    lines = [f"EN: {p['english']}\nRHG: {p['rohingya_latin']}" for p in sample]
    return "\n\n".join(lines)


SYSTEM_PROMPT = """You are translating between English and Rohingya (ISO 639-3: rhg), \
a low-resource Indo-Aryan language spoken by the Rohingya people, closely related to \
Chittagonian Bengali. There is no standardized orthography in wide digital use; write \
Rohingya output in the same romanized ("Rohingyalish") style shown in the examples below. \
You have very little training exposure to this language, so treat every translation as a \
rough best-effort, not a verified result. Output ONLY the translated text, nothing else \
-- no quotes, no notes, no explanation.

Verified example pairs (English / Rohingya):

{examples}
"""


def llm_translate(text: str, direction: str) -> str:
    """direction: 'en2rhg' or 'rhg2en'. Returns translated text only.
    Caller is responsible for flagging this as unverified to the end user.
    """
    client = _get_client()
    if direction == "en2rhg":
        instruction = f"Translate this English text to Rohingya:\n\n{text}"
    elif direction == "rhg2en":
        instruction = f"Translate this Rohingya text to English:\n\n{text}"
    else:
        raise ValueError(f"unknown direction: {direction}")

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT.format(examples=_few_shot_examples()),
        # Generous: the model's hidden thinking tokens count against this budget
        # and a small limit truncates the translation mid-word.
        max_output_tokens=4096,
    )
    last_err: Exception | None = None
    # 503s are short demand spikes (retry); 429s are per-model quotas. Either way, fall back.
    for model in (settings.gemini_model, settings.gemini_fallback_model):
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model=model, contents=instruction, config=config
                )
                return response.text.strip()
            except genai_errors.APIError as e:
                if e.code not in (429, 500, 503):
                    raise
                last_err = e
                if e.code == 429:
                    break  # rate-limited: go straight to the fallback model
                time.sleep(1.5 * (attempt + 1))
    raise last_err

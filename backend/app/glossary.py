from __future__ import annotations

import json
from pathlib import Path
from functools import lru_cache

from rapidfuzz import process, fuzz

DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "phrases.json"

# Matches below this score are treated as "no reliable glossary hit" and fall
# through to the LLM translator instead of returning a wrong verified phrase.
MATCH_THRESHOLD = 80


@lru_cache
def load_phrases() -> list[dict]:
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def _match(text: str, key: str) -> dict | None:
    phrases = load_phrases()
    choices = {i: p[key] for i, p in enumerate(phrases) if p.get(key)}
    if not choices:
        return None
    result = process.extractOne(text, choices, scorer=fuzz.WRatio, score_cutoff=MATCH_THRESHOLD)
    if result is None:
        return None
    _, score, idx = result
    match = dict(phrases[idx])
    match["match_score"] = score
    return match


def match_english(text: str) -> dict | None:
    return _match(text, "english")


def match_rohingya(text: str) -> dict | None:
    """Tries Latin-script Rohingya first, then Bangla-script, since we don't
    yet know for certain which script the MMS ASR/TTS checkpoints output.
    """
    return _match(text, "rohingya_latin") or _match(text, "rohingya_bangla")


def all_phrases() -> list[dict]:
    return load_phrases()

# Technical Journal — Rohingya Voice Link MVP

## 1. Executive Summary & Purpose

This app supports bidirectional voice translator (Rohingya ↔ English). It pairs live, AI-driven speech translation with a human-verified phrasebook, so that high-stakes communication doesn't depend entirely on unverified AI output. The phrasebook I found is for medical/COVID-19 terminology but ideally we would extend the phrasebook further with common words in daily lives.

## 2. Architecture & Data Flow Diagram

Two machines are involved: a local backend (no GPU) and a Colab-hosted GPU runtime,
bridged by an ngrok tunnel. Everything Rohingya-specific (ASR, TTS) runs on the GPU
machine; everything else runs locally.

```
┌──────────────┐        multipart/form-data         ┌───────────────────────┐
│ React Native │  POST /translate-speech             │  FastAPI backend      │
│ (Expo app)   │ ───────────────────────────────────▶│  (local, no GPU)      │
│              │                                      │                       │
│ hold-to-speak│◀──────────────────────────────────── │  base64 audio + text  │
└──────────────┘        JSON { input_text,            └──────────┬────────────┘
                           output_text, source,                   │
                           verified, audio_base64 }                │
                                                                    │
                     direction = "rhg2en"                          │     direction = "en2rhg"
                     ┌───────────────────────────────────────────┬─┴──────────────────────────────┐
                     ▼                                           ▼                                 │
         ┌─────────────────────────┐                 ┌─────────────────────────┐                   │
         │ model_client.asr_rohingya│                │ english_speech.asr_english│                  │
         │  → POST {ngrok}/asr      │                │  → faster-whisper (CPU)   │                  │
         └────────────┬─────────────┘                └────────────┬─────────────┘                  │
                       ▼                                           ▼                                 │
         ┌─────────────────────────┐                 ┌─────────────────────────┐                   │
         │ glossary.match_rohingya  │                │ glossary.match_english    │                  │
         │ (rapidfuzz vs TWB data)  │                │ (rapidfuzz vs TWB data)   │                  │
         └──┬───────────────────┬──┘                 └──┬───────────────────┬──┘                   │
      hit ✓ │              miss │                  hit ✓ │              miss │                      │
            ▼                   ▼                        ▼                   ▼                      │
     glossary["english"]  translate.llm_translate   glossary["rohingya_latin"]  translate.llm_translate│
     (verified: true)     (Gemini, verified: false)  (+ real TWB audio if        (Gemini, verified:  │
            │                   │                      available)                false)              │
            ▼                   ▼                        │                         │                 │
         ┌─────────────────────────┐                     ▼                         ▼                 │
         │ english_speech.tts_english│          ┌─────────────────────────┐                           │
         │  → edge-tts (local)       │          │ model_client.tts_rohingya │◀──────────────────────────┘
         └─────────────────────────┘           │  → POST {ngrok}/tts        │
                                                 └────────────┬────────────┘
                                                               │
┌──────────────────────────────────────────────────────────────┴──────────────────────────┐
│ Colab T4 GPU runtime (colab/mms_model_server.ipynb), exposed via ngrok                   │
│  - facebook/mms-1b-all (rhg adapter)  → ASR: Rohingya speech → Latin-script text          │
│  - facebook/mms-tts-rhg               → TTS: Rohingya text → speech                       │
│  - FastAPI + ngrok tunnel, started manually each session, URL pasted into backend/.env    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

The **Quick Cards** screen completely skips all the AI processing for its 31 common phrases. Instead, it pulls the saved phrase list directly from our database. When you tap a card, it immediately plays a real audio recording if one exists. If there isn't a recording, it quickly generates the spoken audio using our text-to-speech model. Because it skips transcription and AI translation, it works instantly with zero risk of the AI making things up.

## 3. Tech Stack & Model Selection

| Function | Model / Library | Where it runs |
|---|---|---|
| Rohingya ASR | `facebook/mms-1b-all`, `rhg` adapter | Colab T4 (GPU) |
| Rohingya TTS | `facebook/mms-tts-rhg` | Colab T4 (GPU) |
| English ASR | `faster-whisper` (CTranslate2 reimplementation of OpenAI's Whisper, `base` model) | Backend, local CPU |
| English TTS | `edge-tts` (Microsoft Edge neural voices, `en-US-AriaNeural`), free, no API key | Backend, local |
| Text translation fallback | Gemini (`gemini-3.8-flash` primary, `gemini-3.5-flash` fallback on 429/500/503), few-shot prompted | Backend, via Google's API |
| Glossary matching | `rapidfuzz` (`WRatio` scorer, cutoff 80) | Backend |

### Why not NLLB-200 / SeamlessM4T-v2 for translation

- **SeamlessM4T-v2** (speech-to-text): Rohingya (`rhg`) is absent from the official supported-language
  table in `facebookresearch/seamless_communication`.
- **NLLB-200** (text-translation): Rohingya is absent from FLORES-200, which defines NLLB-200's 200
  supported languages.
- **MMS, does support Rohingya** for both ASR (`facebook/mms-1b-all`,
  confirmed via its adapter list containing `rhg`) and TTS (`facebook/mms-tts-rhg`).

No open-source text translation model supports Rohingya. To avoid hallucination risks, the translation layer uses:
1. **TWB glossary exact/fuzzy match first** — human-verified, zero hallucination risk.
2. **Gemini few-shot fallback** — Used only when no glossary match meets the threshold. Results are flagged with `verified: false` and display a UI warning banner indicating a best-effort translation.


## 4. Data Strategy & Glossary Grounding

### Ingestion

`data/phrases.json` — 31 entries transcribed verbatim from **Translators Without
Borders**, *Rohingya Language Guidance Note on COVID-19 for Bangladesh* (Sept 2020,
EU ECHO / UK FCDO funded). Citation and extension notes in `data/SOURCES.md`.

| Category | Count |
|---|---|
| general | 6 |
| transmission | 7 |
| prevention | 5 |
| treatment | 7 |
| death_burial | 6 |

Medical/COVID terms only — no market/commerce phrases yet (prices, greetings,
quantities). That data lives behind a JS web app that couldn't be scraped
automatically; see `data/SOURCES.md` for how to extend it.

Each entry: `english`, `rohingya_latin`, `rohingya_bangla`, optional `audio_url`
(none populated yet), `verified: true` (all 31 share the same human-translated
source).

### Matching logic (`backend/app/glossary.py`)

`rapidfuzz.process.extractOne`, `WRatio` scorer, `score_cutoff` 80. `rhg2en` matches
ASR output against `rohingya_latin` first, then `rohingya_bangla`. `en2rhg` matches
Whisper output against `english`. Below cutoff = no match, falls through to Gemini
rather than risk a wrong "verified" result.

### Script/orthography finding

A diagnostic run on a real `freococo/rohingya_asr_audio` sample (VOA broadcast corpus)
showed the MMS `rhg` ASR model outputs **Latin script with diacritics** — e.g. a
station-ID clip came out as `gásof amérika wacíngthon` ("Voice of America,
Washington"). TWB's glossary uses **plain-ASCII** romanization (`Biaram`, `Fuk`, no
accents). Hanifi script was not observed.

**Open gap**: `match_rohingya` doesn't yet normalize away diacritics before
comparing, so real ASR output may score lower than it should against true glossary
matches. Fix: Unicode NFKD normalization + combining-mark stripping on the
ASR side before matching.

## 5. Repository Structure & File Directory

```
rohingya-translation-app-watai/
├── README.md                    Setup/run instructions for a new developer
├── TECHNICAL_JOURNAL.md         This file
├── .gitignore
│
├── backend/                     FastAPI orchestrator — runs locally, no GPU needed
│   ├── requirements.txt
│   ├── .env.example             Template for required secrets/config
│   ├── .env                     Actual local secrets (gitignored)
│   └── app/
│       ├── __init__.py
│       ├── main.py              FastAPI app: /health, /phrases, /synthesize, /translate-speech
│       ├── config.py             Pydantic settings (env var loading)
│       ├── glossary.py           Loads data/phrases.json; fuzzy-match English/Rohingya text
│       ├── translate.py          Gemini-based LLM translation fallback, few-shot grounded
│       ├── english_speech.py     English ASR (faster-whisper) + TTS (edge-tts), local/CPU
│       └── model_client.py       HTTP client for the Colab-hosted Rohingya ASR/TTS server
│
├── colab/
│   └── mms_model_server.ipynb   GPU model server: loads mms-1b-all (rhg) + mms-tts-rhg,
│                                 serves them over FastAPI + ngrok tunnel
│
├── data/
│   ├── phrases.json             31 TWB-verified English/Rohingya phrase pairs
│   └── SOURCES.md               Exact citation + how to extend the phrasebook
│
└── mobile/                      Expo (React Native + TypeScript) client
    ├── package.json
    ├── app.json                 Expo config (permissions, expo-audio plugin)
    ├── metro.config.js          Required Expo Metro bundler config
    ├── babel.config.js
    ├── tsconfig.json
    ├── App.tsx                  Root component: tab switch between Translate / Quick Cards
    └── src/
        ├── config.ts            BACKEND_URL constant (set to your machine's LAN IP)
        ├── api.ts                fetch() wrappers: translateSpeech, fetchPhrases, synthesize
        ├── audio.ts              Recording/playback via expo-audio + expo-file-system
        └── screens/
            ├── TranslateScreen.tsx    Dual hold-to-speak mic buttons + result display
            └── QuickCardsScreen.tsx   Phrasebook list with tap-to-play
```

Single responsibility per file. Backend has no shared mutable state beyond an
`lru_cache`'d phrase list and a lazily-constructed Gemini client. .

## 6. Execution Log & Verification Steps

**No automated test suite yet** (no `pytest`/`jest`) — next priority.
Verification so far:

- **Static checks**: `python3 -m py_compile` (backend) and `npx tsc --noEmit`
  (mobile) after every change, both clean; JSON validation of `phrases.json` and the
  notebook's `.ipynb` structure.
- **Manual Colab diagnostic**: a notebook cell streams a partial read of one real
  sample from `freococo/rohingya_asr_audio` (not a full 830MB shard) and round-trips
  it through MMS ASR + TTS, confirming both load and run on the T4.
- **Manual device testing** via Expo Go over ngrok (LAN mode was unreliable on the
  test network). Surfaced and fixed: missing `metro.config.js` (broke Metro's
  transformer construction), RN 0.86's FormData rejecting the old `{uri, name, type}`
  file-part shape (needs a real `Blob`), and a UI race where `onPressOut` could fire
  before async `startRecording()` resolved.

**Resolved**: `en2rhg` initially failed (`av.error.InvalidDataError`) because
`RecordingPresets.HIGH_QUALITY` records `.m4a`/AAC while the pipeline expects WAV
(`soundfile` can't decode AAC at all). Fixed by giving `audio.ts` explicit
`RecordingOptions` — `ios.outputFormat: IOSOutputFormat.LINEARPCM`, `.wav`, 16kHz
mono. Confirmed via `backend.log`: real `RIFF....WAVE` header, `200 OK` on both
directions.

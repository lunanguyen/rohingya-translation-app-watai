# Phrasebook data sources

`phrases.json` entries (31 terms, all `"verified": true`) are transcribed verbatim from:

**Translators Without Borders**, *Rohingya Language Guidance Note on COVID-19 for Bangladesh*,
September 2020. Published under the Common Service for Community Engagement and
Accountability (funded by EU ECHO and UK FCDO).
https://translatorswithoutborders.org/wp-content/uploads/2020/09/COM_CR_RohingyaLanguage-GuidanceNote-COVID-19_-Bangladesh_EN_FINAL.pdf

This covers COVID-19 / general medical terminology only (categories: general, transmission,
prevention, treatment, death_burial). It does NOT cover everyday market/commerce phrases
("how much", "do you have...", numbers, greetings) -- the proposal's other target use case.

## What's missing and how to get it

The full TWB Bangladesh glossary (1000+ terms across sectors, with audio) lives in a
JavaScript web app that can't be scraped automatically:
- Browse: https://glossaries.translatorswb.org/bangladesh/
- Text-only: https://glossaries.translatorswb.org/bangladesh_text/

To extend the phrasebook (market phrases, greetings, more medical terms) or get real
human-recorded audio instead of synthesized TTS:
1. Open the glossary web app above, find the relevant terms/sector.
2. Add entries to `phrases.json` following the existing schema.
3. If the app lets you download/export audio clips, save them somewhere the backend
   can serve (e.g. `data/audio/<id>.mp3`) and set `audio_url` accordingly.

Until then, the app's Quick Cards screen synthesizes audio on the fly via the
Colab-hosted `facebook/mms-tts-rhg` model (see `backend/app/main.py`'s `/synthesize`
endpoint) for any entry with `audio_url: null`. That's AI-generated speech from a
human-verified transcript -- much safer than AI-generated translation, but still not
the same as a native speaker's recording.

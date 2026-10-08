import { BACKEND_URL } from "./config";

export type Direction = "rhg2en" | "en2rhg";

export interface TranslateResult {
  input_text: string;
  output_text: string;
  source: "glossary" | "llm";
  verified: boolean;
  audio_base64: string;
}

export interface Phrase {
  id: string;
  category: string;
  english: string;
  rohingya_latin: string | null;
  rohingya_bangla: string | null;
  audio_url: string | null;
  verified: boolean;
}

export async function translateSpeech(
  fileUri: string,
  direction: Direction
): Promise<TranslateResult> {
  // RN's FormData no longer accepts a loose {uri, name, type} object as a
  // file part -- it needs a real Blob.
  const fileResp = await fetch(fileUri);
  const blob = await fileResp.blob();

  const form = new FormData();
  form.append("file", blob, "audio.wav");
  form.append("direction", direction);

  const resp = await fetch(`${BACKEND_URL}/translate-speech`, {
    method: "POST",
    body: form,
    headers: { "Content-Type": "multipart/form-data" },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`translate-speech failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

export async function fetchPhrases(): Promise<Phrase[]> {
  const resp = await fetch(`${BACKEND_URL}/phrases`);
  if (!resp.ok) throw new Error(`fetchPhrases failed (${resp.status})`);
  return resp.json();
}

export async function synthesize(text: string): Promise<string> {
  const resp = await fetch(`${BACKEND_URL}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) throw new Error(`synthesize failed (${resp.status})`);
  const data = await resp.json();
  return data.audio_base64;
}

import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { translateSpeech, Direction, TranslateResult } from "../api";
import { startRecording, stopRecording, playBase64Wav } from "../audio";

type Phase = "idle" | "recording" | "processing" | "done" | "error";

export default function TranslateScreen() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [direction, setDirection] = useState<Direction | null>(null);
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tracks the in-flight startRecording() call so handlePressOut can wait for
  // it instead of racing it -- onPressOut can fire before the async
  // permission prompt + startRecording() resolves, especially on the very
  // first use when the OS mic-permission dialog can interrupt the gesture.
  const startPromiseRef = useRef<Promise<void> | null>(null);

  const handlePressIn = (dir: Direction) => {
    setError(null);
    setResult(null);
    setDirection(dir);
    setPhase("recording");
    const p = startRecording();
    p.catch(() => {}); // avoid an "unhandled rejection" warning; handlePressOut awaits p below and surfaces the real error
    startPromiseRef.current = p;
  };

  const handlePressOut = async (dir: Direction) => {
    if (phase !== "recording" || direction !== dir) return;
    try {
      await startPromiseRef.current;
      startPromiseRef.current = null;
      setPhase("processing");
      const uri = await stopRecording();
      const res = await translateSpeech(uri, dir);
      setResult(res);
      setPhase("done");
      await playBase64Wav(res.audio_base64);
    } catch (e: any) {
      setError(e.message);
      setPhase("error");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Rohingya Voice Link</Text>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.micButton, phase === "recording" && direction === "rhg2en" && styles.micButtonActive]}
          onPressIn={() => handlePressIn("rhg2en")}
          onPressOut={() => handlePressOut("rhg2en")}
        >
          <Text style={styles.micLabel}>Hold to Speak{"\n"}Rohingya</Text>
        </Pressable>

        <Pressable
          style={[styles.micButton, phase === "recording" && direction === "en2rhg" && styles.micButtonActive]}
          onPressIn={() => handlePressIn("en2rhg")}
          onPressOut={() => handlePressOut("en2rhg")}
        >
          <Text style={styles.micLabel}>Hold to Speak{"\n"}English</Text>
        </Pressable>
      </View>

      {phase === "processing" && <ActivityIndicator size="large" style={styles.status} />}

      {phase === "error" && error && (
        <Text style={styles.errorText}>Error: {error}</Text>
      )}

      {phase === "done" && result && (
        <View style={styles.resultBox}>
          {!result.verified && (
            <Text style={styles.unverifiedBanner}>
              ⚠ AI best-effort translation, not human-verified
            </Text>
          )}
          <Text style={styles.resultLabel}>Heard:</Text>
          <Text style={styles.resultText}>{result.input_text}</Text>
          <Text style={styles.resultLabel}>Translation:</Text>
          <Text style={styles.resultText}>{result.output_text}</Text>
          <Pressable onPress={() => playBase64Wav(result.audio_base64)} style={styles.replayButton}>
            <Text style={styles.replayLabel}>🔊 Replay</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20, alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", marginTop: 20, marginBottom: 30 },
  buttonRow: { flexDirection: "row", gap: 16 },
  micButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonActive: { backgroundColor: "#dc2626" },
  micLabel: { color: "#fff", textAlign: "center", fontWeight: "600", fontSize: 16 },
  status: { marginTop: 30 },
  errorText: { color: "#dc2626", marginTop: 20, textAlign: "center" },
  resultBox: { marginTop: 30, width: "100%", backgroundColor: "#f3f4f6", borderRadius: 12, padding: 16 },
  unverifiedBanner: { color: "#92400e", backgroundColor: "#fef3c7", padding: 8, borderRadius: 8, marginBottom: 12, fontWeight: "600" },
  resultLabel: { fontSize: 12, color: "#6b7280", marginTop: 8 },
  resultText: { fontSize: 18, fontWeight: "500" },
  replayButton: { marginTop: 16, alignSelf: "flex-start" },
  replayLabel: { fontSize: 16, color: "#2563eb", fontWeight: "600" },
});

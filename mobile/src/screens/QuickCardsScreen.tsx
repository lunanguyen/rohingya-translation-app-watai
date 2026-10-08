import React, { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fetchPhrases, synthesize, Phrase } from "../api";
import { playRemoteAudio, playBase64Wav } from "../audio";

export default function QuickCardsScreen() {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPhrases()
      .then(setPhrases)
      .catch((e) => setError(e.message));
  }, []);

  const handlePress = async (item: Phrase) => {
    try {
      setError(null);
      setPlayingId(item.id);
      if (item.audio_url) {
        // Prefer human-recorded audio when we have it.
        await playRemoteAudio(item.audio_url);
      } else if (item.rohingya_latin) {
        // Fall back to synthesizing the verified transcript via MMS-TTS-rhg.
        const audioBase64 = await synthesize(item.rohingya_latin);
        await playBase64Wav(audioBase64);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPlayingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Emergency / Market Quick Cards</Text>
      {error && <Text style={styles.errorText}>Error: {error}</Text>}
      <FlatList
        data={phrases}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => handlePress(item)}>
            <Text style={styles.category}>{item.category}</Text>
            <Text style={styles.english}>{item.english}</Text>
            {item.rohingya_latin && <Text style={styles.rohingya}>{item.rohingya_latin}</Text>}
            {playingId === item.id && <Text style={styles.noAudio}>playing…</Text>}
            {!item.audio_url && playingId !== item.id && (
              <Text style={styles.noAudio}>(synthesized audio, tap to hear)</Text>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginVertical: 12 },
  errorText: { color: "#dc2626", marginBottom: 12 },
  card: {
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  category: { fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: "600" },
  english: { fontSize: 16, fontWeight: "600", marginTop: 2 },
  rohingya: { fontSize: 15, color: "#2563eb", marginTop: 2 },
  noAudio: { fontSize: 12, color: "#9ca3af", marginTop: 2, fontStyle: "italic" },
});

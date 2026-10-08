import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import TranslateScreen from "./src/screens/TranslateScreen";
import QuickCardsScreen from "./src/screens/QuickCardsScreen";

type Tab = "translate" | "cards";

export default function App() {
  const [tab, setTab] = useState<Tab>("translate");

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {tab === "translate" ? <TranslateScreen /> : <QuickCardsScreen />}
      </View>
      <View style={styles.tabBar}>
        <Pressable style={styles.tabButton} onPress={() => setTab("translate")}>
          <Text style={[styles.tabLabel, tab === "translate" && styles.tabLabelActive]}>Translate</Text>
        </Pressable>
        <Pressable style={styles.tabButton} onPress={() => setTab("cards")}>
          <Text style={[styles.tabLabel, tab === "cards" && styles.tabLabelActive]}>Quick Cards</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingBottom: 24,
    paddingTop: 10,
  },
  tabButton: { flex: 1, alignItems: "center" },
  tabLabel: { fontSize: 14, color: "#9ca3af", fontWeight: "600" },
  tabLabelActive: { color: "#2563eb" },
});

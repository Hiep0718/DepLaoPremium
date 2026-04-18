import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

interface GameItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  bgColor: string;
}

const GAMES: GameItem[] = [
  {
    id: "2048",
    name: "2048",
    emoji: "🔢",
    description: "Vuốt ghép số, thử thách IQ",
    color: "#f2b179",
    bgColor: "#FFF8F0",
  },
  {
    id: "memory",
    name: "Lật thẻ",
    emoji: "🧠",
    description: "Tìm cặp thẻ giống nhau",
    color: "#0068FF",
    bgColor: "#F0F6FF",
  },
];

interface GameHubScreenProps {
  onBack: () => void;
  onSelectGame: (gameId: string) => void;
}

export function GameHubScreen({ onBack, onSelectGame }: GameHubScreenProps) {
  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backText}>Khám phá</Text>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <View style={styles.titleSection}>
        <Text style={styles.title}>🎮 Game Mini</Text>
        <Text style={styles.subtitle}>Chọn game yêu thích và thư giãn nào!</Text>
      </View>

      {/* Game Cards */}
      <View style={styles.cardsRow}>
        {GAMES.map((game) => (
          <TouchableOpacity
            key={game.id}
            style={[styles.card, { backgroundColor: game.bgColor }]}
            activeOpacity={0.7}
            onPress={() => onSelectGame(game.id)}
          >
            <View style={[styles.emojiCircle, { backgroundColor: game.color }]}>
              <Text style={styles.emoji}>{game.emoji}</Text>
            </View>
            <Text style={styles.cardName}>{game.name}</Text>
            <Text style={styles.cardDesc}>{game.description}</Text>
            <View style={[styles.playBadge, { backgroundColor: game.color }]}>
              <Text style={styles.playText}>Chơi ngay</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Fun tip */}
      <View style={styles.tipBox}>
        <Text style={styles.tipEmoji}>💡</Text>
        <Text style={styles.tipText}>
          Chơi game giúp thư giãn đầu óc và tăng khả năng tập trung!
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingRight: 12,
  },
  backIcon: {
    fontSize: 28,
    color: "#0068FF",
    fontWeight: "300",
    marginRight: 4,
    marginTop: -2,
  },
  backText: {
    fontSize: 16,
    color: "#0068FF",
    fontWeight: "600",
  },
  titleSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#222",
  },
  subtitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
    fontWeight: "500",
  },
  cardsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  emojiCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emoji: {
    fontSize: 28,
  },
  cardName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#333",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 14,
  },
  playBadge: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  playText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  tipEmoji: {
    fontSize: 22,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
});

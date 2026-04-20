import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Modal,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_COLS = 4;
const GRID_ROWS = 4;
const TOTAL_PAIRS = (GRID_COLS * GRID_ROWS) / 2;
const CARD_GAP = 8;
const CARD_SIZE = (SCREEN_WIDTH - 32 - CARD_GAP * (GRID_COLS + 1)) / GRID_COLS;

const EMOJIS = [
  "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
  "🐨", "🦁", "🐯", "🐸", "🐵", "🦄", "🐙", "🦋",
  "🍎", "🍊", "🍋", "🍇", "🍉", "🍓", "🥝", "🍑",
];

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createCards(): Card[] {
  const selected = shuffleArray(EMOJIS).slice(0, TOTAL_PAIRS);
  const pairs = [...selected, ...selected];
  const shuffled = shuffleArray(pairs);
  return shuffled.map((emoji, idx) => ({
    id: idx,
    emoji,
    isFlipped: false,
    isMatched: false,
  }));
}

interface MemoryGameScreenProps {
  onBack: () => void;
}

export function MemoryGameScreen({ onBack }: MemoryGameScreenProps) {
  const [cards, setCards] = useState<Card[]>(createCards);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const flipAnims = useRef<Animated.Value[]>(
    Array.from({ length: GRID_COLS * GRID_ROWS }, () => new Animated.Value(0))
  ).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPlaying && !showWin) {
      timerRef.current = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, showWin]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const flipCard = (id: number) => {
    Animated.spring(flipAnims[id], {
      toValue: 1,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const unflipCard = (id: number) => {
    Animated.spring(flipAnims[id], {
      toValue: 0,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handleCardPress = useCallback(
    (id: number) => {
      if (isLocked) return;
      const card = cards[id];
      if (card.isFlipped || card.isMatched) return;

      if (!isPlaying) setIsPlaying(true);

      flipCard(id);
      const newCards = cards.map((c) =>
        c.id === id ? { ...c, isFlipped: true } : c
      );
      setCards(newCards);

      const newFlipped = [...flippedIds, id];
      setFlippedIds(newFlipped);

      if (newFlipped.length === 2) {
        setMoves((m) => m + 1);
        setIsLocked(true);

        const [firstId, secondId] = newFlipped;
        const firstCard = newCards[firstId];
        const secondCard = newCards[secondId];

        if (firstCard.emoji === secondCard.emoji) {
          // Match found
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.id === firstId || c.id === secondId
                  ? { ...c, isMatched: true }
                  : c
              )
            );
            const newMatched = matchedPairs + 1;
            setMatchedPairs(newMatched);
            setFlippedIds([]);
            setIsLocked(false);

            if (newMatched === TOTAL_PAIRS) {
              setShowWin(true);
              setIsPlaying(false);
              setBestTime((prev) =>
                prev === null ? timer : Math.min(prev, timer)
              );
            }
          }, 300);
        } else {
          // No match - flip back
          setTimeout(() => {
            unflipCard(firstId);
            unflipCard(secondId);
            setCards((prev) =>
              prev.map((c) =>
                c.id === firstId || c.id === secondId
                  ? { ...c, isFlipped: false }
                  : c
              )
            );
            setFlippedIds([]);
            setIsLocked(false);
          }, 800);
        }
      }
    },
    [cards, flippedIds, isLocked, isPlaying, matchedPairs, timer]
  );

  const resetGame = () => {
    flipAnims.forEach((anim) => anim.setValue(0));
    setCards(createCards());
    setFlippedIds([]);
    setMoves(0);
    setMatchedPairs(0);
    setTimer(0);
    setIsPlaying(false);
    setShowWin(false);
    setIsLocked(false);
  };

  const getStars = () => {
    if (moves <= TOTAL_PAIRS + 2) return 3;
    if (moves <= TOTAL_PAIRS + 6) return 2;
    return 1;
  };

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backText}>Game Mini</Text>
        </TouchableOpacity>
      </View>

      {/* Title + Stats */}
      <View style={styles.headerSection}>
        <View>
          <Text style={styles.gameTitle}>🧠 Lật thẻ</Text>
          <Text style={styles.subtitle}>Tìm cặp thẻ giống nhau</Text>
        </View>
        <TouchableOpacity onPress={resetGame} style={styles.resetBtn}>
          <Text style={styles.resetText}>Chơi lại</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>BƯỚC ĐI</Text>
          <Text style={styles.statValue}>{moves}</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxAccent]}>
          <Text style={styles.statLabel}>THỜI GIAN</Text>
          <Text style={styles.statValue}>{formatTime(timer)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>CẶP</Text>
          <Text style={styles.statValue}>
            {matchedPairs}/{TOTAL_PAIRS}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressWrapper}>
        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              { width: `${(matchedPairs / TOTAL_PAIRS) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Card Grid */}
      <View style={styles.gridWrapper}>
        <View style={styles.grid}>
          {cards.map((card) => {
            const row = Math.floor(card.id / GRID_COLS);
            const col = card.id % GRID_COLS;

            const frontInterpolate = flipAnims[card.id].interpolate({
              inputRange: [0, 1],
              outputRange: ["180deg", "360deg"],
            });
            const backInterpolate = flipAnims[card.id].interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "180deg"],
            });

            return (
              <TouchableOpacity
                key={card.id}
                activeOpacity={0.7}
                onPress={() => handleCardPress(card.id)}
                style={[
                  styles.cardContainer,
                  {
                    width: CARD_SIZE,
                    height: CARD_SIZE,
                    left: CARD_GAP + col * (CARD_SIZE + CARD_GAP),
                    top: CARD_GAP + row * (CARD_SIZE + CARD_GAP),
                  },
                ]}
              >
                {/* Card Back (face down - question mark) */}
                <Animated.View
                  style={[
                    styles.cardFace,
                    styles.cardBack,
                    card.isMatched && styles.cardMatched,
                    {
                      transform: [{ rotateY: backInterpolate }],
                      width: CARD_SIZE,
                      height: CARD_SIZE,
                    },
                  ]}
                >
                  <Text style={styles.cardBackText}>?</Text>
                </Animated.View>

                {/* Card Front (face up - emoji) */}
                <Animated.View
                  style={[
                    styles.cardFace,
                    styles.cardFront,
                    card.isMatched && styles.cardMatchedFront,
                    {
                      transform: [{ rotateY: frontInterpolate }],
                      width: CARD_SIZE,
                      height: CARD_SIZE,
                    },
                  ]}
                >
                  <Text style={styles.cardEmoji}>{card.emoji}</Text>
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Win Modal */}
      <Modal visible={showWin} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalStars}>
              {"⭐".repeat(getStars())}{"☆".repeat(3 - getStars())}
            </Text>
            <Text style={styles.modalTitle}>Tuyệt vời! 🎉</Text>
            <Text style={styles.modalDesc}>
              Bạn hoàn thành trong {moves} bước và {formatTime(timer)}
            </Text>
            {bestTime !== null && (
              <Text style={styles.modalBest}>
                Kỷ lục: {formatTime(bestTime)}
              </Text>
            )}
            <TouchableOpacity
              onPress={resetGame}
              style={styles.modalPlayBtn}
            >
              <Text style={styles.modalPlayText}>Chơi lại</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  gameTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#333",
  },
  subtitle: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
    marginTop: 2,
  },
  resetBtn: {
    backgroundColor: "#0068FF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  statBoxAccent: {
    backgroundColor: "#0068FF",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(0,0,0,0.4)",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#333",
    marginTop: 2,
  },
  progressWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  progressBg: {
    height: 6,
    backgroundColor: "#f0f0f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#0068FF",
    borderRadius: 3,
  },
  gridWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 8,
  },
  grid: {
    width: SCREEN_WIDTH - 32,
    height: GRID_ROWS * (CARD_SIZE + CARD_GAP) + CARD_GAP,
    position: "relative",
  },
  cardContainer: {
    position: "absolute",
  },
  cardFace: {
    position: "absolute",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backfaceVisibility: "hidden",
  },
  cardBack: {
    backgroundColor: "#0068FF",
    shadowColor: "#0068FF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cardBackText: {
    fontSize: 28,
    fontWeight: "800",
    color: "rgba(255,255,255,0.6)",
  },
  cardFront: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#e8e8e8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardMatched: {
    backgroundColor: "#E8F5E9",
    shadowOpacity: 0,
    elevation: 0,
  },
  cardMatchedFront: {
    backgroundColor: "#E8F5E9",
    borderColor: "#A5D6A7",
  },
  cardEmoji: {
    fontSize: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: SCREEN_WIDTH - 64,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalStars: {
    fontSize: 36,
    marginBottom: 8,
    letterSpacing: 4,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#333",
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 4,
  },
  modalBest: {
    fontSize: 13,
    color: "#0068FF",
    fontWeight: "600",
    marginBottom: 16,
  },
  modalPlayBtn: {
    backgroundColor: "#0068FF",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  modalPlayText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});

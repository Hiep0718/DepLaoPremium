import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  Modal,
} from "react-native";

const GRID_SIZE = 4;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BOARD_SIZE = SCREEN_WIDTH - 32;
const BOARD_PADDING = 10;
const CELL_GAP = 8;
const CELL_SIZE =
  (BOARD_SIZE - BOARD_PADDING * 2 - CELL_GAP * (GRID_SIZE - 1)) / GRID_SIZE;

type Grid = number[][];

const TILE_COLORS: Record<number, { bg: string; text: string; fontSize: number }> = {
  0: { bg: "rgba(255,255,255,0.15)", text: "#776e65", fontSize: 24 },
  2: { bg: "#eee4da", text: "#776e65", fontSize: 26 },
  4: { bg: "#ede0c8", text: "#776e65", fontSize: 26 },
  8: { bg: "#f2b179", text: "#fff", fontSize: 26 },
  16: { bg: "#f59563", text: "#fff", fontSize: 24 },
  32: { bg: "#f67c5f", text: "#fff", fontSize: 24 },
  64: { bg: "#f65e3b", text: "#fff", fontSize: 24 },
  128: { bg: "#edcf72", text: "#fff", fontSize: 22 },
  256: { bg: "#edcc61", text: "#fff", fontSize: 22 },
  512: { bg: "#edc850", text: "#fff", fontSize: 22 },
  1024: { bg: "#edc53f", text: "#fff", fontSize: 18 },
  2048: { bg: "#edc22e", text: "#fff", fontSize: 18 },
  4096: { bg: "#3c3a32", text: "#fff", fontSize: 18 },
  8192: { bg: "#3c3a32", text: "#fff", fontSize: 18 },
};

function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function addRandomTile(grid: Grid): Grid {
  const newGrid = grid.map((row) => [...row]);
  const emptyCells: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (newGrid[r][c] === 0) emptyCells.push([r, c]);
    }
  }
  if (emptyCells.length > 0) {
    const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    newGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
  }
  return newGrid;
}

function initializeGrid(): Grid {
  let grid = createEmptyGrid();
  grid = addRandomTile(grid);
  grid = addRandomTile(grid);
  return grid;
}

function rotateGrid(grid: Grid): Grid {
  const newGrid = createEmptyGrid();
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      newGrid[c][GRID_SIZE - 1 - r] = grid[r][c];
    }
  }
  return newGrid;
}

function slideRow(row: number[]): { newRow: number[]; score: number } {
  let score = 0;
  const filtered = row.filter((x) => x !== 0);
  const merged: number[] = [];
  let skip = false;
  for (let i = 0; i < filtered.length; i++) {
    if (skip) { skip = false; continue; }
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const mergedVal = filtered[i] * 2;
      merged.push(mergedVal);
      score += mergedVal;
      skip = true;
    } else {
      merged.push(filtered[i]);
    }
  }
  while (merged.length < GRID_SIZE) merged.push(0);
  return { newRow: merged, score };
}

function moveLeft(grid: Grid): { grid: Grid; score: number; moved: boolean } {
  let totalScore = 0;
  let moved = false;
  const newGrid = grid.map((row) => {
    const { newRow, score } = slideRow(row);
    totalScore += score;
    if (row.some((val, idx) => val !== newRow[idx])) moved = true;
    return newRow;
  });
  return { grid: newGrid, score: totalScore, moved };
}

function move(
  grid: Grid,
  direction: "left" | "right" | "up" | "down"
): { grid: Grid; score: number; moved: boolean } {
  let rotated = grid;
  let rotations = 0;
  switch (direction) {
    case "left": rotations = 0; break;
    case "down": rotations = 1; break;
    case "right": rotations = 2; break;
    case "up": rotations = 3; break;
  }
  for (let i = 0; i < rotations; i++) rotated = rotateGrid(rotated);
  const result = moveLeft(rotated);
  let finalGrid = result.grid;
  for (let i = 0; i < (4 - rotations) % 4; i++) finalGrid = rotateGrid(finalGrid);
  return { grid: finalGrid, score: result.score, moved: result.moved };
}

function isGameOver(grid: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 0) return false;
      if (c + 1 < GRID_SIZE && grid[r][c] === grid[r][c + 1]) return false;
      if (r + 1 < GRID_SIZE && grid[r][c] === grid[r + 1][c]) return false;
    }
  }
  return true;
}

function hasWon(grid: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 2048) return true;
    }
  }
  return false;
}

interface MiniGameScreenProps {
  onBack: () => void;
}

export function MiniGameScreen({ onBack }: MiniGameScreenProps) {
  const [grid, setGrid] = useState<Grid>(initializeGrid);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [keepPlaying, setKeepPlaying] = useState(false);
  const scoreAnim = useRef(new Animated.Value(1)).current;

  const animateScore = useCallback(() => {
    scoreAnim.setValue(1.2);
    Animated.spring(scoreAnim, {
      toValue: 1,
      friction: 3,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [scoreAnim]);

  const handleMove = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      if (gameOver) return;
      setGrid((prevGrid) => {
        const result = move(prevGrid, direction);
        if (!result.moved) return prevGrid;
        const newGrid = addRandomTile(result.grid);
        setScore((prev) => {
          const newScore = prev + result.score;
          if (result.score > 0) animateScore();
          setBestScore((best) => Math.max(best, newScore));
          return newScore;
        });
        if (!keepPlaying && hasWon(newGrid) && !won) {
          setWon(true);
          setShowWinModal(true);
        }
        if (isGameOver(newGrid)) {
          setGameOver(true);
        }
        return newGrid;
      });
    },
    [gameOver, won, keepPlaying, animateScore]
  );

  const panRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 || Math.abs(gs.dy) > 10,
      onPanResponderRelease: (_, gs) => {
        const { dx, dy } = gs;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          handleMove(dx > 0 ? "right" : "left");
        } else {
          handleMove(dy > 0 ? "down" : "up");
        }
      },
    })
  );

  useEffect(() => {
    panRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 || Math.abs(gs.dy) > 10,
      onPanResponderRelease: (_, gs) => {
        const { dx, dy } = gs;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          handleMove(dx > 0 ? "right" : "left");
        } else {
          handleMove(dy > 0 ? "down" : "up");
        }
      },
    });
  }, [handleMove]);

  const resetGame = () => {
    setGrid(initializeGrid());
    setScore(0);
    setGameOver(false);
    setWon(false);
    setKeepPlaying(false);
    setShowWinModal(false);
  };

  const getTileStyle = (value: number) => {
    return TILE_COLORS[value] || TILE_COLORS[8192];
  };

  return (
    <View style={styles.root}>
      {/* Top bar with back button */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backText}>Khám phá</Text>
        </TouchableOpacity>
      </View>

      {/* Score + Title row */}
      <View style={styles.infoRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.gameTitle}>2048</Text>
          <Text style={styles.subtitle}>Vuốt để ghép số!</Text>
        </View>
        <View style={styles.scoresRow}>
          <Animated.View
            style={[styles.scoreBox, { transform: [{ scale: scoreAnim }] }]}
          >
            <Text style={styles.scoreLabel}>ĐIỂM</Text>
            <Text style={styles.scoreNum}>{score}</Text>
          </Animated.View>
          <View style={[styles.scoreBox, styles.bestBox]}>
            <Text style={styles.scoreLabel}>BEST</Text>
            <Text style={styles.scoreNum}>{bestScore}</Text>
          </View>
        </View>
      </View>

      {/* New game button */}
      <TouchableOpacity onPress={resetGame} style={styles.newGameBtn}>
        <Text style={styles.newGameText}>Chơi lại</Text>
      </TouchableOpacity>

      {/* Game Board */}
      <View style={styles.boardWrapper}>
        <View style={styles.board} {...panRef.current.panHandlers}>
          {/* Background cells */}
          {Array.from({ length: GRID_SIZE }).map((_, r) =>
            Array.from({ length: GRID_SIZE }).map((_, c) => (
              <View
                key={`bg-${r}-${c}`}
                style={[
                  styles.cellBg,
                  {
                    left: BOARD_PADDING + c * (CELL_SIZE + CELL_GAP),
                    top: BOARD_PADDING + r * (CELL_SIZE + CELL_GAP),
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                  },
                ]}
              />
            ))
          )}

          {/* Tiles */}
          {grid.map((row, r) =>
            row.map((value, c) => {
              if (value === 0) return null;
              const ts = getTileStyle(value);
              return (
                <View
                  key={`tile-${r}-${c}`}
                  style={[
                    styles.tile,
                    {
                      left: BOARD_PADDING + c * (CELL_SIZE + CELL_GAP),
                      top: BOARD_PADDING + r * (CELL_SIZE + CELL_GAP),
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      backgroundColor: ts.bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tileText,
                      { color: ts.text, fontSize: ts.fontSize },
                    ]}
                  >
                    {value}
                  </Text>
                </View>
              );
            })
          )}

          {/* Game Over Overlay */}
          {gameOver && (
            <View style={styles.overlay}>
              <Text style={styles.overlayEmoji}>😵</Text>
              <Text style={styles.overlayTitle}>Game Over</Text>
              <Text style={styles.overlayScore}>Điểm của bạn: {score}</Text>
              <TouchableOpacity onPress={resetGame} style={styles.overlayBtn}>
                <Text style={styles.overlayBtnText}>Chơi lại</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Win Modal */}
      <Modal visible={showWinModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalEmoji}>🎉</Text>
            <Text style={styles.modalTitle}>Chúc mừng!</Text>
            <Text style={styles.modalDesc}>
              Bạn đã đạt 2048! Tiếp tục thử thách?
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => {
                  setKeepPlaying(true);
                  setShowWinModal(false);
                }}
                style={styles.modalBtnContinue}
              >
                <Text style={styles.modalBtnContinueText}>Tiếp tục</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowWinModal(false);
                  resetGame();
                }}
                style={styles.modalBtnReset}
              >
                <Text style={styles.modalBtnResetText}>Chơi lại</Text>
              </TouchableOpacity>
            </View>
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
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  titleBlock: {},
  gameTitle: {
    fontSize: 40,
    fontWeight: "900",
    color: "#776e65",
  },
  subtitle: {
    fontSize: 13,
    color: "#a09488",
    fontWeight: "500",
    marginTop: 2,
  },
  scoresRow: {
    flexDirection: "row",
    gap: 8,
  },
  scoreBox: {
    backgroundColor: "#bbada0",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 64,
  },
  bestBox: {
    backgroundColor: "#0068FF",
  },
  scoreLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  scoreNum: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 1,
  },
  newGameBtn: {
    alignSelf: "flex-end",
    marginRight: 16,
    marginBottom: 12,
    backgroundColor: "#0068FF",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newGameText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  boardWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 16,
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    backgroundColor: "#bbada0",
    borderRadius: 12,
    position: "relative",
    overflow: "hidden",
  },
  cellBg: {
    position: "absolute",
    backgroundColor: "rgba(238,228,218,0.35)",
    borderRadius: 8,
  },
  tile: {
    position: "absolute",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tileText: {
    fontWeight: "900",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(238, 228, 218, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  overlayEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  overlayTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#776e65",
    marginBottom: 4,
  },
  overlayScore: {
    fontSize: 16,
    color: "#a09488",
    marginBottom: 20,
    fontWeight: "600",
  },
  overlayBtn: {
    backgroundColor: "#0068FF",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  overlayBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
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
  modalEmoji: {
    fontSize: 52,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#776e65",
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 14,
    color: "#a09488",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  modalBtns: {
    flexDirection: "row",
    gap: 12,
  },
  modalBtnContinue: {
    backgroundColor: "#0068FF",
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
  },
  modalBtnContinueText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  modalBtnReset: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
  },
  modalBtnResetText: {
    color: "#776e65",
    fontSize: 14,
    fontWeight: "700",
  },
});

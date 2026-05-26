import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StyleSheet,
  StatusBar,
  Animated,
  ActivityIndicator,
  ViewToken,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Mock Data ───────────────────────────────────────────────
interface ClipItem {
  id: string;
  videoUrl: string;
  author: {
    name: string;
    avatar: string;
  };
  description: string;
  music: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
}

const MOCK_CLIPS: ClipItem[] = [
  {
    id: "1",
    videoUrl:
      "https://www.w3schools.com/html/mov_bbb.mp4",
    author: { name: "Nguyễn Văn An", avatar: "🧑" },
    description: "Cảnh đẹp thiên nhiên hoang dã 🌿🔥 #nature #explore",
    music: "♫ Nhạc nền - Original Sound",
    likes: 1245,
    comments: 89,
    shares: 34,
    isLiked: false,
  },
  {
    id: "2",
    videoUrl:
      "https://www.w3schools.com/html/movie.mp4",
    author: { name: "Trần Minh Tuấn", avatar: "👨" },
    description: "Cuộc phiêu lưu không giới hạn 🚀✨ #adventure #travel",
    music: "♫ Adventure Time - DJ Remix",
    likes: 3420,
    comments: 156,
    shares: 78,
    isLiked: false,
  },
  {
    id: "3",
    videoUrl:
      "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    author: { name: "Lê Thị Hương", avatar: "👩" },
    description: "Khoảnh khắc vui vẻ cùng bạn bè 😄🎉 #fun #friends",
    music: "♫ Happy Vibes - Summer Mix",
    likes: 892,
    comments: 45,
    shares: 12,
    isLiked: false,
  },
  {
    id: "4",
    videoUrl:
      "https://www.w3schools.com/html/mov_bbb.mp4",
    author: { name: "Phạm Đức Huy", avatar: "🧔" },
    description: "Road trip cuối tuần 🏎️💨 #roadtrip #weekend #driving",
    music: "♫ Speed - Fast & Furious OST",
    likes: 5670,
    comments: 234,
    shares: 189,
    isLiked: false,
  },
  {
    id: "5",
    videoUrl:
      "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    author: { name: "Hoàng Yến Nhi", avatar: "👧" },
    description: "Những điều thú vị trong cuộc sống 🌟 #life #moments",
    music: "♫ Chill Beats - Lo-fi Mix",
    likes: 2100,
    comments: 67,
    shares: 45,
    isLiked: false,
  },
];

// ─── Format Numbers ──────────────────────────────────────────
const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
};

// ─── Single Video Item Component ─────────────────────────────
interface VideoItemProps {
  item: ClipItem;
  isActive: boolean;
  onToggleLike: (id: string) => void;
}

const VideoItem = React.memo(({ item, isActive, onToggleLike }: VideoItemProps) => {
  const videoRef = useRef<Video>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [progress, setProgress] = useState(0);
  const pauseIconOpacity = useRef(new Animated.Value(0)).current;

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      // Video chưa load hoặc lỗi
      if ((status as any).error) {
        setHasError(true);
        setIsLoading(false);
      }
      return;
    }
    // Video đã load xong
    setIsLoading(false);
    setHasError(false);
    if (status.durationMillis && status.durationMillis > 0) {
      setProgress(status.positionMillis / status.durationMillis);
    }
  }, []);

  // Auto-play/pause based on visibility
  React.useEffect(() => {
    if (!videoRef.current) return;
    if (isActive && !isPaused) {
      videoRef.current.playAsync().catch(() => {});
    } else {
      videoRef.current.pauseAsync().catch(() => {});
    }
  }, [isActive, isPaused]);

  const handleVideoPress = useCallback(() => {
    if (hasError) return;
    setIsPaused((prev) => {
      const newVal = !prev;
      // Flash the pause/play icon
      Animated.sequence([
        Animated.timing(pauseIconOpacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.delay(400),
        Animated.timing(pauseIconOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      return newVal;
    });
  }, [pauseIconOpacity, hasError]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    if (videoRef.current) {
      videoRef.current.unloadAsync().then(() => {
        videoRef.current?.loadAsync({ uri: item.videoUrl }, { shouldPlay: isActive }).catch(() => {
          setHasError(true);
          setIsLoading(false);
        });
      });
    }
  }, [item.videoUrl, isActive]);

  const handleLike = useCallback(() => {
    onToggleLike(item.id);
  }, [item.id, onToggleLike]);

  return (
    <View style={styles.videoContainer}>
      {/* Video Player */}
      <TouchableOpacity activeOpacity={1} onPress={handleVideoPress} style={styles.videoTouchable}>
        <Video
          ref={videoRef}
          source={{ uri: item.videoUrl }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={isActive && !isPaused}
          isMuted={false}
          volume={1.0}
          progressUpdateIntervalMillis={250}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          onError={(error) => {
            console.log('Video error:', error);
            setHasError(true);
            setIsLoading(false);
          }}
        />
      </TouchableOpacity>

      {/* Loading Indicator */}
      {isLoading && isActive && (
        <View style={styles.bufferingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Đang tải video...</Text>
        </View>
      )}

      {/* Error State */}
      {hasError && isActive && (
        <View style={styles.bufferingOverlay}>
          <Ionicons name="cloud-offline-outline" size={48} color="#fff" />
          <Text style={styles.errorText}>Không thể tải video</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
            <Ionicons name="reload" size={18} color="#fff" />
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pause/Play Icon Flash */}
      <Animated.View style={[styles.pauseIconOverlay, { opacity: pauseIconOpacity }]}>
        <View style={styles.pauseIconBg}>
          <Ionicons name={isPaused ? "play" : "pause"} size={40} color="#fff" />
        </View>
      </Animated.View>

      {/* Bottom Gradient */}
      <View style={styles.bottomGradient}>
        <View style={styles.gradientInner} />
      </View>

      {/* Bottom Info */}
      <View style={styles.bottomInfo}>
        <View style={styles.authorRow}>
          <View style={styles.authorAvatarWrap}>
            <Text style={styles.authorAvatarEmoji}>{item.author.avatar}</Text>
          </View>
          <Text style={styles.authorName}>{item.author.name}</Text>
          <TouchableOpacity style={styles.followBtn}>
            <Text style={styles.followBtnText}>Theo dõi</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.musicRow}>
          <Ionicons name="musical-notes" size={14} color="#fff" />
          <Text style={styles.musicText} numberOfLines={1}>
            {item.music}
          </Text>
        </View>
      </View>

      {/* Right Sidebar */}
      <View style={styles.sidebar}>
        {/* Like */}
        <TouchableOpacity style={styles.sidebarBtn} onPress={handleLike}>
          <Ionicons
            name={item.isLiked ? "heart" : "heart-outline"}
            size={32}
            color={item.isLiked ? "#FF2D55" : "#fff"}
          />
          <Text style={styles.sidebarCount}>{formatNumber(item.likes)}</Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity style={styles.sidebarBtn}>
          <Ionicons name="chatbubble-ellipses-outline" size={30} color="#fff" />
          <Text style={styles.sidebarCount}>{formatNumber(item.comments)}</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity style={styles.sidebarBtn}>
          <Ionicons name="share-social-outline" size={30} color="#fff" />
          <Text style={styles.sidebarCount}>{formatNumber(item.shares)}</Text>
        </TouchableOpacity>

        {/* Music Disc */}
        <View style={styles.musicDisc}>
          <View style={styles.musicDiscInner}>
            <Ionicons name="musical-notes" size={16} color="#fff" />
          </View>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
});

// ─── Main ClipVideoScreen ────────────────────────────────────
interface ClipVideoScreenProps {
  onBack: () => void;
}

export function ClipVideoScreen({ onBack }: ClipVideoScreenProps) {
  const [clips, setClips] = useState<ClipItem[]>(MOCK_CLIPS);
  const [activeIndex, setActiveIndex] = useState(0);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const handleToggleLike = useCallback((id: string) => {
    setClips((prev) =>
      prev.map((clip) =>
        clip.id === id
          ? {
              ...clip,
              isLiked: !clip.isLiked,
              likes: clip.isLiked ? clip.likes - 1 : clip.likes + 1,
            }
          : clip
      )
    );
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: ClipItem; index: number }) => (
      <VideoItem
        item={item}
        isActive={index === activeIndex}
        onToggleLike={handleToggleLike}
      />
    ),
    [activeIndex, handleToggleLike]
  );

  const keyExtractor = useCallback((item: ClipItem) => item.id, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Video Feed */}
      <FlatList
        data={clips}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        removeClippedSubviews
        maxToRenderPerBatch={2}
        windowSize={3}
        initialNumToRender={1}
      />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Clip Video</Text>
        <TouchableOpacity style={styles.searchBtn}>
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
    position: "relative",
  },
  videoTouchable: {
    flex: 1,
  },
  video: {
    width: "100%",
    height: "100%",
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  loadingText: {
    color: "#fff",
    fontSize: 14,
    marginTop: 12,
    fontWeight: "500",
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 12,
    fontWeight: "600",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  pauseIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },
  pauseIconBg: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 250,
    pointerEvents: "none",
  },
  gradientInner: {
    flex: 1,
    backgroundColor: "transparent",
    // Simulating gradient with opacity layers
    borderTopWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -80 },
    shadowOpacity: 0.8,
    shadowRadius: 80,
  },
  bottomInfo: {
    position: "absolute",
    bottom: 80,
    left: 12,
    right: 80,
    paddingRight: 8,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  authorAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  authorAvatarEmoji: {
    fontSize: 20,
  },
  authorName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  followBtn: {
    borderWidth: 1.5,
    borderColor: "#FF2D55",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "rgba(255,45,85,0.15)",
  },
  followBtnText: {
    color: "#FF2D55",
    fontSize: 12,
    fontWeight: "700",
  },
  description: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  musicRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  musicText: {
    color: "#fff",
    fontSize: 13,
    marginLeft: 6,
    flex: 1,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sidebar: {
    position: "absolute",
    right: 10,
    bottom: 120,
    alignItems: "center",
  },
  sidebarBtn: {
    alignItems: "center",
    marginBottom: 20,
  },
  sidebarCount: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  musicDisc: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 8,
    borderColor: "#333",
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  musicDiscInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  progressBarBg: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 1.5,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 12,
    paddingBottom: 12,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  topBarTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
});

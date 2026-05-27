import React, { useState } from "react"
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Dimensions, RefreshControl } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useTimeline } from "@/hooks/useTimeline"
import { useSocket } from "@/contexts/SocketContext"

const { width } = Dimensions.get("window")

export function TimelineScreen() {
    const router = useRouter();
    const { currentUserId } = useSocket();
    const { posts, stories, loadingPosts, loadingStories, refreshPosts, refreshStories, toggleLike } = useTimeline(currentUserId);
    
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refreshPosts(), refreshStories()]);
        setRefreshing(false);
    };

    return (
        <View style={styles.container}>
            {/* Top Tabs */}
            <View style={styles.topTabs}>
                <TouchableOpacity style={[styles.tabItem, styles.activeTabItem]}>
                    <Text style={[styles.tabText, styles.activeTabText]}>Nhật Ký</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tabItem}>
                    <Text style={styles.tabText}>Zalo Video</Text>
                </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.scrollView} 
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0068FF"]} />}
            >
                {/* Create Post Section */}
                <View style={styles.createPostSection}>
                    <TouchableOpacity style={styles.createPostInputRow} onPress={() => router.push('/timeline/create-post')}>
                        <Image source={{ uri: "https://via.placeholder.com/100" }} style={styles.userAvatar} />
                        <Text style={styles.createPostPlaceholder}>Hôm nay bạn thế nào?</Text>
                    </TouchableOpacity>
                    
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionButtonsScroll}>
                        <View style={styles.actionButtonsRow}>
                            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/timeline/create-post')}>
                                <Ionicons name="image" size={18} color="#4CAF50" style={styles.actionIcon} />
                                <Text style={styles.actionButtonText}>Ảnh</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/timeline/create-post')}>
                                <Ionicons name="videocam" size={18} color="#E91E63" style={styles.actionIcon} />
                                <Text style={styles.actionButtonText}>Video</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton}>
                                <Ionicons name="images" size={18} color="#2196F3" style={styles.actionIcon} />
                                <Text style={styles.actionButtonText}>Album</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton}>
                                <Ionicons name="text" size={18} color="#2196F3" style={styles.actionIcon} />
                                <Text style={styles.actionButtonText}>Nền chữ</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* 24h Status Section */}
                <View style={styles.statusSection}>
                    <View style={styles.statusHeaderWrap}>
                        <TouchableOpacity style={styles.statusHeader}>
                            <Ionicons name="happy-outline" size={20} color="#666" />
                            <Text style={styles.statusHeaderText}>Cập nhật trạng thái 24 giờ</Text>
                            <View style={styles.flameWrap}>
                                <Ionicons name="flame" size={16} color="#888" />
                                <Text style={styles.flameText}>0</Text>
                                <Ionicons name="chevron-down" size={14} color="#888" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesContainer}>
                        {/* Create Story Card */}
                        <TouchableOpacity style={styles.storyCard} onPress={() => router.push('/timeline/create-story')}>
                            <Image source={{ uri: "https://via.placeholder.com/150x250" }} style={styles.storyImage} />
                            <View style={styles.storyOverlay} />
                            <View style={styles.createStoryIconWrap}>
                                <View style={styles.createStoryIcon}>
                                    <Ionicons name="camera" size={24} color="#fff" />
                                </View>
                            </View>
                            <Text style={styles.storyName}>Tạo mới</Text>
                        </TouchableOpacity>

                        {/* Other Stories */}
                        {stories.map(story => (
                          <TouchableOpacity key={story._id} style={styles.storyCard}>
                              <Image source={{ uri: story.mediaUrl }} style={styles.storyImage} />
                              <View style={styles.storyOverlay} />
                              <View style={styles.storyAvatarWrap}>
                                  <Image source={{ uri: story.author?.avatarUrl }} style={styles.storyAvatar} />
                              </View>
                              <Text style={styles.storyName} numberOfLines={1}>{story.author?.fullName}</Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Posts Feed */}
                <View style={styles.feedSection}>
                    {posts.length === 0 && !loadingPosts && (
                      <View style={{ padding: 40, alignItems: 'center' }}>
                        <Text style={{ color: '#999' }}>Chưa có bài viết nào</Text>
                      </View>
                    )}
                    
                    {posts.map((post) => {
                        const isLiked = currentUserId ? post.likes.includes(currentUserId) : false;
                        
                        return (
                          <View key={post._id} style={styles.postContainer}>
                              <View style={styles.postHeader}>
                                  <Image source={{ uri: post.author?.avatarUrl }} style={styles.postAvatar} />
                                  <View style={styles.postInfo}>
                                      <Text style={styles.postAuthor}>{post.author?.fullName}</Text>
                                      <Text style={styles.postTime}>{new Date(post.createdAt).toLocaleString('vi-VN')}</Text>
                                  </View>
                                  <TouchableOpacity style={styles.postMoreBtn}>
                                      <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
                                  </TouchableOpacity>
                              </View>
                              
                              {post.content ? (
                                <Text style={styles.postContent}>{post.content}</Text>
                              ) : null}
                              
                              {post.images && post.images.length > 0 && (
                                  <View style={post.images.length > 1 ? styles.multiImageGrid : null}>
                                    {post.images.map((img, idx) => (
                                      <Image key={idx} source={{ uri: img }} style={post.images.length > 1 ? styles.postMultiImage : styles.postImage} resizeMode="cover" />
                                    ))}
                                  </View>
                              )}
                              
                              <View style={styles.postStats}>
                                {post.likes.length > 0 && (
                                  <View style={styles.statItem}>
                                    <Ionicons name="heart" size={14} color="#E91E63" />
                                    <Text style={styles.statText}>{post.likes.length}</Text>
                                  </View>
                                )}
                              </View>

                              <View style={styles.postActions}>
                                  <TouchableOpacity style={styles.postActionBtn} onPress={() => toggleLike(post._id)}>
                                      <Ionicons name={isLiked ? "heart" : "heart-outline"} size={22} color={isLiked ? "#E91E63" : "#666"} />
                                      <Text style={[styles.postActionText, isLiked && { color: '#E91E63' }]}>Thích</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={styles.postActionBtn}>
                                      <Ionicons name="chatbubble-outline" size={20} color="#666" />
                                      <Text style={styles.postActionText}>Bình luận</Text>
                                  </TouchableOpacity>
                              </View>
                          </View>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    topTabs: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    tabItem: {
        flex: 1,
        paddingVertical: 14,
        alignItems: "center",
    },
    activeTabItem: {
        borderBottomWidth: 2,
        borderBottomColor: "#000",
    },
    tabText: {
        fontSize: 16,
        color: "#666",
        fontWeight: "500",
    },
    activeTabText: {
        color: "#000",
        fontWeight: "600",
    },
    scrollView: {
        flex: 1,
        backgroundColor: "#f4f5f7",
    },
    createPostSection: {
        backgroundColor: "#fff",
        paddingVertical: 12,
    },
    createPostInputRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    userAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
    },
    createPostPlaceholder: {
        fontSize: 16,
        color: "#666",
        flex: 1,
    },
    actionButtonsScroll: {
        paddingHorizontal: 16,
    },
    actionButtonsRow: {
        flexDirection: "row",
        gap: 12,
    },
    actionButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f5f5f5",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    actionIcon: {
        marginRight: 6,
    },
    actionButtonText: {
        fontSize: 14,
        color: "#333",
        fontWeight: "500",
    },
    divider: {
        height: 8,
        backgroundColor: "#f4f5f7",
    },
    statusSection: {
        backgroundColor: "#fff",
        paddingVertical: 16,
    },
    statusHeaderWrap: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    statusHeader: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#e0e0e0",
        borderStyle: "dashed",
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    statusHeaderText: {
        flex: 1,
        fontSize: 14,
        color: "#555",
        marginLeft: 8,
    },
    flameWrap: {
        flexDirection: "row",
        alignItems: "center",
        borderLeftWidth: 1,
        borderLeftColor: "#eee",
        paddingLeft: 12,
        gap: 4,
    },
    flameText: {
        fontSize: 14,
        color: "#555",
        fontWeight: "500",
    },
    storiesContainer: {
        paddingHorizontal: 16,
        gap: 12,
    },
    storyCard: {
        width: 100,
        height: 150,
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
        backgroundColor: '#e0e0e0',
    },
    storyImage: {
        width: "100%",
        height: "100%",
    },
    storyOverlay: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "50%",
        backgroundColor: "rgba(0,0,0,0.4)",
    },
    createStoryIconWrap: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
    },
    createStoryIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#0068FF",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "#fff",
    },
    storyAvatarWrap: {
        position: "absolute",
        bottom: 30,
        left: "50%",
        marginLeft: -16,
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: "#0068FF",
        overflow: "hidden",
        backgroundColor: '#fff',
    },
    storyAvatar: {
        width: "100%",
        height: "100%",
    },
    storyName: {
        position: "absolute",
        bottom: 8,
        left: 4,
        right: 4,
        color: "#fff",
        fontSize: 12,
        fontWeight: "500",
        textAlign: "center",
        textShadowColor: "rgba(0, 0, 0, 0.75)",
        textShadowOffset: {width: -1, height: 1},
        textShadowRadius: 10
    },
    feedSection: {
        backgroundColor: "#fff",
    },
    postContainer: {
        paddingVertical: 16,
        borderBottomWidth: 8,
        borderBottomColor: "#f4f5f7",
    },
    postHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    postAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
        backgroundColor: '#e0e0e0',
    },
    postInfo: {
        flex: 1,
    },
    postAuthor: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000",
        marginBottom: 2,
    },
    postTime: {
        fontSize: 13,
        color: "#666",
    },
    postMoreBtn: {
        padding: 4,
    },
    postContent: {
        fontSize: 15,
        color: "#111",
        lineHeight: 22,
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    postImage: {
        width: width,
        height: width * 0.6,
        marginBottom: 12,
    },
    multiImageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: width,
    },
    postMultiImage: {
        width: width / 2 - 2,
        height: width / 2,
        margin: 1,
    },
    postStats: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#eee',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statText: {
        fontSize: 13,
        color: '#666',
        marginLeft: 4,
    },
    postActions: {
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    postActionBtn: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 24,
    },
    postActionText: {
        fontSize: 14,
        color: "#666",
        marginLeft: 6,
        fontWeight: "500",
    },
})

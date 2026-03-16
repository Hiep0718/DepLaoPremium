import { View, Text, ScrollView, TouchableOpacity } from "react-native"

interface Post {
    id: string
    author: string
    avatar: string
    content: string
    time: string
    likes: number
}

export function TimelineScreen() {
    const posts: Post[] = [
        {
            id: "1",
            author: "Ngân Ngô",
            avatar: "👩",
            content: "Hôm nay thời tiết đẹp quá! 🌞",
            time: "2 giờ trước",
            likes: 24,
        },
        {
            id: "2",
            author: "Minh Anh",
            avatar: "👨",
            content: "Vừa hoàn thành dự án lớn 🎉",
            time: "4 giờ trước",
            likes: 156,
        },
        {
            id: "3",
            author: "Linh Chi",
            avatar: "👩‍🦰",
            content: "Du lịch tại Đà Nẵng thật tuyệt vời 🏖️",
            time: "1 ngày trước",
            likes: 89,
        },
    ]

    return (
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
            <View
                style={{
                    paddingTop: 16,
                    paddingHorizontal: 16,
                    paddingBottom: 12,
                    backgroundColor: "#fff",
                    borderBottomWidth: 1,
                    borderBottomColor: "#f0f0f0",
                }}
            >
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#000" }}>Tường nhà</Text>
            </View>
            <ScrollView style={{ padding: 16 }}>
                {posts.map((post) => (
                    <View
                        key={post.id}
                        style={{
                            marginBottom: 16,
                            borderRadius: 8,
                            backgroundColor: "#f8f8f8",
                            padding: 12,
                        }}
                    >
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginBottom: 10,
                            }}
                        >
                            <View
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: "#e8f0fe",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    marginRight: 10,
                                }}
                            >
                                <Text style={{ fontSize: 20 }}>{post.avatar}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: "600", color: "#000" }}>{post.author}</Text>
                                <Text style={{ fontSize: 12, color: "#999" }}>{post.time}</Text>
                            </View>
                        </View>
                        <Text style={{ fontSize: 14, color: "#333", lineHeight: 20 }}>{post.content}</Text>
                        <View
                            style={{
                                flexDirection: "row",
                                marginTop: 10,
                                paddingTop: 10,
                                borderTopWidth: 1,
                                borderTopColor: "#e0e0e0",
                            }}
                        >
                            <TouchableOpacity style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                                <Text style={{ fontSize: 16, marginRight: 6 }}>👍</Text>
                                <Text style={{ fontSize: 13, color: "#666" }}>Thích ({post.likes})</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                                <Text style={{ fontSize: 16, marginRight: 6 }}>💬</Text>
                                <Text style={{ fontSize: 13, color: "#666" }}>Bình luận</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    )
}

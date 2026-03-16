import { View, Text, FlatList, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"

interface Message {
    id: string
    name: string
    lastMessage: string
    avatar: string
    unread: boolean
}

interface ChatMessage {
    id: string
    sender: string
    text: string
    timestamp: string
    isOwn: boolean
}

interface MessagesScreenProps {
    selectedMessage: Message | null
    onSelectMessage: (message: Message | null) => void
}

export function MessagesScreen({ selectedMessage, onSelectMessage }: MessagesScreenProps) {
    const messages: Message[] = [
        { id: "1", name: "Ngân Ngô", lastMessage: "Ok được!", avatar: "👩", unread: true },
        { id: "2", name: "Minh Anh", lastMessage: "Có khỏe không?", avatar: "👨", unread: false },
        { id: "3", name: "Nhóm Dự Án", lastMessage: "Cập nhật: Task hoàn thành", avatar: "👥", unread: true },
        { id: "4", name: "Bố Mẹ", lastMessage: "Tối ăn cơm chưa?", avatar: "👴", unread: false },
    ]

    const chatMessages: ChatMessage[] = [
        { id: "1", sender: "other", text: "Có khỏe không?", timestamp: "10:30", isOwn: false },
        { id: "2", sender: "me", text: "Khỏe bình thường 😊", timestamp: "10:32", isOwn: true },
        { id: "3", sender: "other", text: "Ok được!", timestamp: "10:33", isOwn: false },
    ]

    if (selectedMessage) {
        return (
            <View style={{ flex: 1, backgroundColor: "#fff" }}>
                {/* Chat header */}
                <View
                    style={{
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: "#f0f0f0",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <TouchableOpacity onPress={() => onSelectMessage(null)}>
                            <Ionicons name="chevron-back" size={24} color="#0084FF" />
                        </TouchableOpacity>
                        <View style={{ marginLeft: 12 }}>
                            <Text style={{ fontSize: 16, fontWeight: "600", color: "#000" }}>{selectedMessage.name}</Text>
                            <Text style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Đang hoạt động</Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                        <TouchableOpacity>
                            <Ionicons name="call" size={20} color="#0084FF" />
                        </TouchableOpacity>
                        <TouchableOpacity>
                            <Ionicons name="information-circle" size={20} color="#0084FF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Chat messages */}
                <FlatList
                    data={chatMessages}
                    renderItem={({ item }) => (
                        <View
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                                flexDirection: item.isOwn ? "row-reverse" : "row",
                            }}
                        >
                            <View
                                style={{
                                    maxWidth: "70%",
                                    backgroundColor: item.isOwn ? "#0084FF" : "#f0f0f0",
                                    borderRadius: 12,
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                }}
                            >
                                <Text style={{ color: item.isOwn ? "#fff" : "#000", fontSize: 14 }}>{item.text}</Text>
                            </View>
                        </View>
                    )}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingVertical: 12 }}
                />

                {/* Input message */}
                <View
                    style={{
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        borderTopWidth: 1,
                        borderTopColor: "#f0f0f0",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <TouchableOpacity>
                        <Ionicons name="add-circle" size={24} color="#0084FF" />
                    </TouchableOpacity>
                    <View
                        style={{
                            flex: 1,
                            backgroundColor: "#f0f0f0",
                            borderRadius: 20,
                            paddingHorizontal: 12,
                            flexDirection: "row",
                            alignItems: "center",
                        }}
                    >
                        <Text style={{ color: "#999", fontSize: 14 }}>Aa</Text>
                    </View>
                    <TouchableOpacity>
                        <Ionicons name="send" size={20} color="#0084FF" />
                    </TouchableOpacity>
                </View>
            </View>
        )
    }

    const renderMessage = ({ item }: { item: Message }) => (
        <TouchableOpacity
            onPress={() => onSelectMessage(item)}
            style={{
                flexDirection: "row",
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: "#f0f0f0",
                alignItems: "center",
            }}
        >
            <View
                style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: "#e8f0fe",
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 12,
                }}
            >
                <Text style={{ fontSize: 24 }}>{item.avatar}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#000" }}>{item.name}</Text>
                <Text style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{item.lastMessage}</Text>
            </View>
            {item.unread && (
                <View
                    style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: "#0084FF",
                    }}
                />
            )}
        </TouchableOpacity>
    )

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
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#000" }}>Tin nhắn</Text>
            </View>
            <FlatList data={messages} renderItem={renderMessage} keyExtractor={(item) => item.id} />
        </View>
    )
}

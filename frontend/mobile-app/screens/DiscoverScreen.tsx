import { View, Text, ScrollView, TouchableOpacity } from "react-native"

interface Feature {
    id: string
    name: string
    icon: string
    description: string
}

export function DiscoverScreen() {
    const features: Feature[] = [
        {
            id: "1",
            name: "Clip Video",
            icon: "🎬",
            description: "Chia sẻ những khoảnh khắc đặc biệt",
        },
        {
            id: "2",
            name: "Game Mini",
            icon: "🎮",
            description: "Chơi game và nhận thưởng",
        },
        {
            id: "3",
            name: "Zalo Shop",
            icon: "🛍️",
            description: "Mua sắm trực tuyến tiện lợi",
        },
        {
            id: "4",
            name: "Official Account",
            icon: "📱",
            description: "Theo dõi các tài khoản chính thức",
        },
        {
            id: "5",
            name: "Tin Tức",
            icon: "📰",
            description: "Cập nhật tin tức mới nhất",
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
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#000" }}>Khám phá</Text>
            </View>
            <ScrollView style={{ padding: 16 }}>
                {features.map((feature) => (
                    <TouchableOpacity
                        key={feature.id}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 14,
                            borderBottomWidth: 1,
                            borderBottomColor: "#f0f0f0",
                        }}
                    >
                        <View
                            style={{
                                width: 50,
                                height: 50,
                                borderRadius: 12,
                                backgroundColor: "#f0f0f0",
                                justifyContent: "center",
                                alignItems: "center",
                                marginRight: 12,
                            }}
                        >
                            <Text style={{ fontSize: 28 }}>{feature.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: "600", color: "#000" }}>{feature.name}</Text>
                            <Text style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{feature.description}</Text>
                        </View>
                        <Text style={{ fontSize: 18, color: "#ccc" }}>›</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    )
}

import { View, Text, ScrollView, TouchableOpacity } from "react-native"

interface MenuItem {
    id: string
    name: string
    icon: string
}

export function ProfileScreen() {
    const menuItems: MenuItem[] = [
        { id: "1", name: "Chỉnh sửa hồ sơ", icon: "✏️" },
        { id: "2", name: "Cài đặt", icon: "⚙️" },
        { id: "3", name: "Quyền riêng tư", icon: "🔒" },
        { id: "4", name: "Tài khoản", icon: "👤" },
        { id: "5", name: "Giới thiệu Zalo", icon: "📤" },
        { id: "6", name: "Hỗ trợ", icon: "❓" },
        { id: "7", name: "Đăng xuất", icon: "🚪" },
    ]

    return (
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
            <ScrollView>
                <View
                    style={{
                        backgroundColor: "#0084FF",
                        paddingTop: 40,
                        paddingBottom: 30,
                        paddingHorizontal: 16,
                        alignItems: "center",
                    }}
                >
                    <View
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: "#fff",
                            justifyContent: "center",
                            alignItems: "center",
                            marginBottom: 12,
                        }}
                    >
                        <Text style={{ fontSize: 40 }}>👤</Text>
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 4 }}>Bạn</Text>
                    <Text style={{ fontSize: 13, color: "#e0e0ff" }}>user@example.com</Text>
                </View>

                <View style={{ padding: 16 }}>
                    {menuItems.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 14,
                                borderBottomWidth: 1,
                                borderBottomColor: "#f0f0f0",
                            }}
                        >
                            <Text style={{ fontSize: 20, marginRight: 12 }}>{item.icon}</Text>
                            <Text style={{ fontSize: 15, color: "#000", flex: 1 }}>{item.name}</Text>
                            <Text style={{ fontSize: 16, color: "#ccc" }}>›</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    )
}

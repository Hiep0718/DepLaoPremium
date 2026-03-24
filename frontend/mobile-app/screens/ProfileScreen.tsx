import { View, Text, ScrollView, TouchableOpacity } from "react-native"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"

interface MenuItem {
    id: string
    name: string
    icon: string
}

export function ProfileScreen() {
    const router = useRouter()
    const menuItems: MenuItem[] = [
        { id: "1", name: "Chỉnh sửa hồ sơ", icon: "pencil-outline" },
        { id: "2", name: "Cài đặt", icon: "settings-outline" },
        { id: "3", name: "Quyền riêng tư", icon: "lock-closed-outline" },
        { id: "4", name: "Tài khoản", icon: "person-outline" },
        { id: "5", name: "Giới thiệu Zalo", icon: "information-circle-outline" },
        { id: "6", name: "Hỗ trợ", icon: "help-circle-outline" },
        { id: "7", name: "Đăng xuất", icon: "log-out-outline" },
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
                            backgroundColor: "#d1d1d1",
                            justifyContent: "center",
                            alignItems: "center",
                            marginBottom: 12,
                            overflow: "hidden",
                        }}
                    >
                        <Ionicons name="person" size={56} color="#fff" style={{ marginTop: 8 }} />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 4 }}>Bạn</Text>
                    <Text style={{ fontSize: 13, color: "#e0e0ff" }}>user@example.com</Text>
                </View>

                <View style={{ padding: 16 }}>
                    {menuItems.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => {
                                if (item.name === "Đăng xuất") {
                                    router.replace("/welcome")
                                }
                            }}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingVertical: 14,
                                borderBottomWidth: 1,
                                borderBottomColor: "#f0f0f0",
                            }}
                        >
                            <Ionicons name={item.icon as any} size={24} color="#0068FF" style={{ marginRight: 16 }} />
                            <Text style={{ fontSize: 15, color: "#000", flex: 1 }}>{item.name}</Text>
                            <Text style={{ fontSize: 16, color: "#ccc" }}>›</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    )
}

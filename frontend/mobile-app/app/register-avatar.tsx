import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { ZaloColors } from "@/constants/zalo"

export default function RegisterAvatarScreen() {
    const router = useRouter()

    const completeRegistration = () => {
        // Go to main tabs screen
        router.replace("/(tabs)")
    }

    return (
        <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <Text style={styles.title}>Cập nhật ảnh đại diện</Text>
                <Text style={styles.subtitle}>Đặt ảnh đại diện để mọi người dễ nhận ra bạn</Text>
                
                {/* Mock Round Avatar Pick */}
                <TouchableOpacity style={styles.avatarCircle} activeOpacity={0.8}>
                    <Ionicons name="person" size={80} color="#fff" />
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity 
                    style={styles.updateBtn}
                    onPress={completeRegistration}
                    activeOpacity={0.8}
                >
                    <Text style={styles.updateBtnText}>Cập nhật</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipBtn} onPress={completeRegistration}>
                    <Text style={styles.skipBtnText}>Bỏ qua</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: { padding: 16 },
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
    title: { fontSize: 24, fontWeight: "700", textAlign: "center", marginBottom: 8, color: "#000" },
    subtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 40, lineHeight: 20 },
    avatarCircle: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: "#d1d1d1", // Gray background for empty avatar
        justifyContent: "center",
        alignItems: "center",
        alignSelf: "center",
        overflow: "hidden",
    },
    updateBtn: { backgroundColor: ZaloColors.blue, borderRadius: 24, paddingVertical: 14, alignItems: "center", marginBottom: 20 },
    updateBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    skipBtn: { alignItems: "center", paddingVertical: 14 },
    skipBtnText: { fontSize: 14, color: "#333", fontWeight: "600" },
})

import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useRouter } from "expo-router"
import { ZaloColors } from "@/constants/zalo"

export default function WelcomeScreen() {
    const router = useRouter()

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            
            {/* Top Bar */}
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.langBtn}>
                    <Text style={styles.langText}>Tiếng Việt ⌄</Text>
                </TouchableOpacity>
            </View>

            {/* Logo */}
            <Text style={styles.logoText}>Zalo</Text>

            {/* Carousel Content (Mock) */}
            <View style={styles.carouselWrap}>
                <View style={styles.imagePlaceholder}>
                    <Text style={{fontSize: 50}}>📞</Text>
                </View>
                <Text style={styles.title}>Gọi video ổn định</Text>
                <Text style={styles.subtitle}>Trò chuyện thật đã với chất lượng video ổn định mọi lúc, mọi nơi</Text>
                
                {/* Dots */}
                <View style={styles.dotsWrap}>
                    <View style={[styles.dot, styles.dotActive]} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                    <View style={styles.dot} />
                </View>
            </View>

            {/* Bottom Buttons */}
            <View style={styles.bottomWrap}>
                <TouchableOpacity 
                    style={styles.loginBtn}
                    onPress={() => router.push("/login")}
                >
                    <Text style={styles.loginBtnText}>Đăng nhập</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={styles.registerBtn}
                    onPress={() => router.push("/register")}
                >
                    <Text style={styles.registerBtnText}>Tạo tài khoản mới</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    topBar: {
        alignItems: "flex-end",
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    langBtn: {
        backgroundColor: "#f5f5f5",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    langText: {
        fontSize: 14,
        color: "#333",
        fontWeight: "500",
    },
    logoText: {
        fontSize: 48,
        fontWeight: "bold",
        color: ZaloColors.blue,
        textAlign: "center",
        marginTop: 20,
    },
    carouselWrap: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 30,
    },
    imagePlaceholder: {
        width: 150,
        height: 150,
        backgroundColor: "#e6f0ff",
        borderRadius: 75,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 30,
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 12,
        color: "#000",
    },
    subtitle: {
        fontSize: 14,
        color: "#666",
        textAlign: "center",
        lineHeight: 20,
        marginBottom: 30,
    },
    dotsWrap: {
        flexDirection: "row",
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#d1d1d1",
        marginHorizontal: 4,
    },
    dotActive: {
        backgroundColor: ZaloColors.blue,
    },
    bottomWrap: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    loginBtn: {
        backgroundColor: ZaloColors.blue,
        borderRadius: 24,
        paddingVertical: 14,
        alignItems: "center",
        marginBottom: 12,
    },
    loginBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    registerBtn: {
        backgroundColor: "#f5f5f5",
        borderRadius: 24,
        paddingVertical: 14,
        alignItems: "center",
    },
    registerBtnText: {
        color: "#333",
        fontSize: 16,
        fontWeight: "600",
    },
})

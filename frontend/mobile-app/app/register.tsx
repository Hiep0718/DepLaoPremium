import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { ZaloColors } from "@/constants/zalo"
import apiClient from "@/constants/api"

export default function RegisterPhoneScreen() {
    const router = useRouter()
    const [phone, setPhone] = useState("")
    const [email, setEmail] = useState("")
    const [agreed1, setAgreed1] = useState(false)
    const [agreed2, setAgreed2] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    const canContinue = phone.length > 8 && isValidEmail && agreed1 && agreed2 && !isLoading

    const handleContinue = async () => {
        if (!canContinue) return;
        setIsLoading(true);
        try {
            // Gửi OTP kèm email → BE sẽ gửi OTP qua email thật
            await apiClient.post('/auth/send-otp', { phone, email: email.trim() });
            // Chuyển sang trang nhập OTP, truyền SĐT và email theo
            router.push({ pathname: "/register-otp", params: { phone, email: email.trim() } });
        } catch (error: any) {
            console.log("Send OTP Error:", error);
            Alert.alert("Lỗi", error.response?.data?.message || "Không thể gửi mã OTP lúc này.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={isLoading}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
                <Text style={styles.title}>Tạo tài khoản</Text>
                
                {/* Nhập số điện thoại */}
                <View style={styles.inputContainer}>
                    <View style={styles.prefixBox}>
                        <Text style={styles.prefixText}>+84 ⌄</Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        keyboardType="phone-pad"
                        placeholder="Số điện thoại"
                        placeholderTextColor="#aaa"
                        value={phone}
                        onChangeText={setPhone}
                        autoFocus
                        editable={!isLoading}
                    />
                </View>

                {/* Nhập email */}
                <View style={styles.emailContainer}>
                    <Ionicons name="mail-outline" size={20} color="#0068FF" style={styles.emailIcon} />
                    <TextInput
                        style={styles.emailInput}
                        keyboardType="email-address"
                        placeholder="Email nhận mã OTP"
                        placeholderTextColor="#aaa"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                    />
                </View>
                {email.length > 0 && !isValidEmail && (
                    <Text style={styles.emailHint}>Vui lòng nhập email hợp lệ</Text>
                )}

                <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreed1(!agreed1)} disabled={isLoading}>
                    <View style={[styles.checkbox, agreed1 && styles.checkboxActive]} />
                    <Text style={styles.checkboxText}>
                        Tôi đồng ý với các <Text style={styles.linkText}>điều khoản sử dụng DepLao</Text>
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreed2(!agreed2)} disabled={isLoading}>
                    <View style={[styles.checkbox, agreed2 && styles.checkboxActive]} />
                    <Text style={styles.checkboxText}>
                        Tôi đồng ý với <Text style={styles.linkText}>điều khoản Mạng xã hội của DepLao</Text>
                    </Text>
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity 
                    style={[styles.btn, canContinue ? styles.btnActive : null]}
                    onPress={handleContinue}
                    disabled={!canContinue}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={[styles.btnText, canContinue ? styles.btnTextActive : null]}>Tiếp tục</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.loginLink} onPress={() => router.replace("/login")} disabled={isLoading}>
                    <Text style={styles.loginText}>Bạn đã có tài khoản? <Text style={styles.linkText}>Đăng nhập ngay</Text></Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: { padding: 16 },
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
    title: { fontSize: 24, fontWeight: "700", textAlign: "center", marginBottom: 30, color: "#000" },
    inputContainer: { flexDirection: "row", borderWidth: 1, borderColor: "#0068FF", borderRadius: 8, marginBottom: 16, overflow: "hidden" },
    prefixBox: { backgroundColor: "#eef2fb", paddingHorizontal: 16, justifyContent: "center", borderRightWidth: 1, borderRightColor: "#0068FF" },
    prefixText: { fontSize: 16, fontWeight: "500", color: "#333" },
    input: { flex: 1, paddingVertical: 14, paddingHorizontal: 12, fontSize: 18, color: "#000" },
    emailContainer: { 
        flexDirection: "row", 
        alignItems: "center", 
        borderWidth: 1, 
        borderColor: "#ccc", 
        borderRadius: 8, 
        marginBottom: 8, 
        paddingHorizontal: 12,
        backgroundColor: "#f9f9f9",
    },
    emailIcon: { marginRight: 10 },
    emailInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: "#000" },
    emailHint: { fontSize: 12, color: "#e74c3c", marginBottom: 12, marginLeft: 4 },
    checkboxRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
    checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: "#ccc", marginRight: 12, marginTop: 2 },
    checkboxActive: { backgroundColor: "#cce5ff", borderColor: "#0068FF" },
    checkboxText: { flex: 1, fontSize: 14, color: "#555", lineHeight: 20 },
    linkText: { color: "#0068FF", fontWeight: "600" },
    btn: { backgroundColor: "#e2e2e2", borderRadius: 24, paddingVertical: 14, alignItems: "center", marginBottom: 20 },
    btnActive: { backgroundColor: "#0068FF" },
    btnText: { color: "#999", fontSize: 16, fontWeight: "600" },
    btnTextActive: { color: "#fff" },
    loginLink: { alignItems: "center" },
    loginText: { fontSize: 14, color: "#555" },
})

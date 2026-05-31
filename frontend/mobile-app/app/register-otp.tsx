import { useState, useEffect } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useRouter, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { ZaloColors } from "@/constants/zalo"
import apiClient from "@/constants/api"

export default function RegisterOtpScreen() {
    const router = useRouter()
    const { phone, email } = useLocalSearchParams<{ phone: string; email: string }>()
    const [otp, setOtp] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [countdown, setCountdown] = useState(60)

    const canContinue = otp.length === 6 && !isLoading

    // Countdown timer cho nút gửi lại
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [countdown])

    const handleVerifyOtp = async () => {
        if (!canContinue) return;
        setIsLoading(true);
        try {
            await apiClient.post('/auth/verify-otp', { phone, otp });
            // Thành công => Chuyển sang màn gộp tên và mật khẩu
            router.push({ pathname: "/register-name", params: { phone, email } });
        } catch (error: any) {
            console.log("Verify OTP Error:", error);
            Alert.alert("Lỗi", error.response?.data?.message || "Mã OTP không hợp lệ.");
        } finally {
            setIsLoading(false);
        }
    }

    const handleResendOtp = async () => {
        if (countdown > 0) return;
        setIsLoading(true);
        try {
            await apiClient.post('/auth/send-otp', { phone, email });
            setCountdown(60);
            Alert.alert("Thành công", "Mã OTP mới đã được gửi đến email của bạn");
        } catch (error: any) {
            console.log("Resend OTP Error:", error);
            Alert.alert("Lỗi", error.response?.data?.message || "Gửi lại OTP thất bại");
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
                <Text style={styles.title}>Nhập mã xác thực</Text>
                <Text style={styles.subtitle}>
                    Mã OTP đã được gửi đến email{"\n"}
                    <Text style={{fontWeight: "bold", color: "#0068FF"}}>{email || "của bạn"}</Text>
                </Text>
                
                {/* OTP input with individual character visuals */}
                <View style={styles.otpWrapper}>
                    <TextInput
                        style={styles.hiddenInput}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp}
                        onChangeText={setOtp}
                        autoFocus
                        editable={!isLoading}
                    />
                    {Array.from({ length: 6 }).map((_, index) => (
                        <View key={index} style={[styles.otpBox, otp.length === index ? styles.otpBoxActive : null]}>
                            <Text style={styles.otpText}>{otp[index] || ""}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ flex: 1 }} />

                <TouchableOpacity 
                    style={[styles.btn, canContinue ? styles.btnActive : null]}
                    onPress={handleVerifyOtp}
                    disabled={!canContinue}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={[styles.btnText, canContinue ? styles.btnTextActive : null]}>Xác nhận</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.resendLink} 
                    disabled={isLoading || countdown > 0}
                    onPress={handleResendOtp}
                >
                    <Text style={styles.resendText}>
                        Bạn không nhận được mã?{" "}
                        <Text style={[styles.linkTextBlue, countdown > 0 && styles.linkTextGray]}>
                            {countdown > 0 ? `Gửi lại (${countdown}s)` : "Gửi lại"}
                        </Text>
                    </Text>
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
    title: { fontSize: 24, fontWeight: "700", textAlign: "center", marginBottom: 12, color: "#000" },
    subtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 30, paddingHorizontal: 10, lineHeight: 22 },
    otpWrapper: { flexDirection: "row", justifyContent: "space-between", position: "relative" },
    hiddenInput: { position: "absolute", width: "100%", height: "100%", opacity: 0, zIndex: 10 },
    otpBox: { width: 45, height: 55, borderWidth: 1, borderColor: "#d1d1d1", borderRadius: 8, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
    otpBoxActive: { borderColor: "#0068FF", borderWidth: 2 },
    otpText: { fontSize: 24, fontWeight: "600", color: "#000" },
    btn: { backgroundColor: "#e2e2e2", borderRadius: 24, paddingVertical: 14, alignItems: "center", marginBottom: 20 },
    btnActive: { backgroundColor: "#0068FF" },
    btnText: { color: "#999", fontSize: 16, fontWeight: "600" },
    btnTextActive: { color: "#fff" },
    resendLink: { alignItems: "center", marginBottom: 30 },
    resendText: { fontSize: 14, color: "#333", fontWeight: "600" },
    linkTextBlue: { color: "#0068FF", fontWeight: "600" },
    linkTextGray: { color: "#888", fontWeight: "400" },
})

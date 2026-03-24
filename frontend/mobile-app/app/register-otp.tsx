import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { ZaloColors } from "@/constants/zalo"

export default function RegisterOtpScreen() {
    const router = useRouter()
    const [otp, setOtp] = useState("")

    const canContinue = otp.length === 6

    return (
        <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
                <Text style={styles.title}>Nhập mã xác thực</Text>
                <Text style={styles.subtitle}>
                    Đang gọi đến số <Text style={{fontWeight: "bold"}}>0346 *** **53</Text>. Nghe máy để nhận mã xác thực gồm 6 chữ số.
                </Text>
                
                {/* Mock OTP input with individual character visuals */}
                <View style={styles.otpWrapper}>
                    <TextInput
                        style={styles.hiddenInput}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp}
                        onChangeText={setOtp}
                        autoFocus
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
                    onPress={() => router.push("/register-name")}
                    disabled={!canContinue}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.btnText, canContinue ? styles.btnTextActive : null]}>Tiếp tục</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.resendLink}>
                    <Text style={styles.resendText}>Bạn không nhận được mã? <Text style={styles.linkTextGray}>Gọi lại (57s)</Text></Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.helpLink}>
                    <Text style={styles.helpText}>? Tôi cần hỗ trợ thêm về mã xác thực</Text>
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
    subtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 30, paddingHorizontal: 10, lineHeight: 20 },
    otpWrapper: { flexDirection: "row", justifyContent: "space-between", position: "relative" },
    hiddenInput: { position: "absolute", width: "100%", height: "100%", opacity: 0, zIndex: 10 },
    otpBox: { width: 45, height: 55, borderWidth: 1, borderColor: "#d1d1d1", borderRadius: 8, justifyContent: "center", alignItems: "center" },
    otpBoxActive: { borderColor: "#0068FF", borderWidth: 2 },
    otpText: { fontSize: 24, fontWeight: "600", color: "#000" },
    btn: { backgroundColor: "#e2e2e2", borderRadius: 24, paddingVertical: 14, alignItems: "center", marginBottom: 20 },
    btnActive: { backgroundColor: "#cce5ff" },
    btnText: { color: "#999", fontSize: 16, fontWeight: "600" },
    btnTextActive: { color: "#0068FF" },
    resendLink: { alignItems: "center", marginBottom: 30 },
    resendText: { fontSize: 14, color: "#333", fontWeight: "600" },
    linkTextGray: { color: "#888", fontWeight: "400" },
    helpLink: { alignItems: "center" },
    helpText: { fontSize: 14, color: "#0068FF", fontWeight: "600" },
})

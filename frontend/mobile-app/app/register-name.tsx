import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useRouter, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import apiClient from "@/constants/api"

export default function RegisterNameScreen() {
    const router = useRouter()
    const { phone, email } = useLocalSearchParams<{ phone: string; email: string }>()
    const [name, setName] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const canContinue = name.trim().length >= 2 && password.length >= 6 && !isLoading

    const handleRegister = async () => {
        const p = phone ? phone.trim() : "";
        const n = name.trim();
        const pwd = password.trim();
        if (!n || pwd.length < 6) return;
        setIsLoading(true);
        try {
            await apiClient.post('/auth/register', { 
                phone: p, 
                fullName: n, 
                password: pwd,
                email: email || undefined,
            });
            Alert.alert("Thành công", "Đăng ký thành công! Hãy đăng nhập để tiếp tục.", [
                { text: "OK", onPress: () => router.replace("/login") }
            ]);
        } catch (error: any) {
            console.log("Register Error:", error);
            Alert.alert("Lỗi", error.response?.data?.message || "Đăng ký thất bại vui lòng thử lại.");
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
                <Text style={styles.title}>Thiết lập tài khoản</Text>
                <Text style={styles.subtitle}>Tài khoản dành cho số điện thoại {phone}</Text>
                
                <TextInput
                    style={styles.input}
                    placeholder="Nhập tên của bạn"
                    placeholderTextColor="#aaa"
                    value={name}
                    onChangeText={setName}
                    editable={!isLoading}
                />

                <TextInput
                    style={styles.input}
                    placeholder="Nhập mật khẩu (ít nhất 6 ký tự)"
                    placeholderTextColor="#aaa"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    editable={!isLoading}
                    autoCapitalize="none"
                    autoCorrect={false}
                />

                <View style={styles.rulesList}>
                    <Text style={styles.ruleItem}>• Dài từ 2 đến 40 ký tự</Text>
                    <Text style={styles.ruleItem}>• Yêu cầu mật khẩu an toàn</Text>
                </View>

                <View style={{ flex: 1 }} />

                <TouchableOpacity 
                    style={[styles.btn, canContinue ? styles.btnActive : null]}
                    onPress={handleRegister}
                    disabled={!canContinue}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={[styles.btnText, canContinue ? styles.btnTextActive : null]}>Hoàn tất & Đăng nhập</Text>
                    )}
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
    title: { fontSize: 24, fontWeight: "700", textAlign: "center", marginBottom: 8, color: "#000" },
    subtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 30, lineHeight: 20 },
    input: { 
        borderWidth: 1, 
        borderColor: "#ccc", 
        borderRadius: 8, 
        paddingVertical: 14, 
        paddingHorizontal: 16, 
        fontSize: 16, 
        color: "#000",
        backgroundColor: "#f9f9f9",
        marginBottom: 16
    },
    rulesList: { paddingLeft: 4, marginBottom: 20 },
    ruleItem: { fontSize: 13, color: "#555", marginBottom: 4 },
    linkText: { color: "#0068FF", fontWeight: "600" },
    btn: { backgroundColor: "#e2e2e2", borderRadius: 24, paddingVertical: 14, alignItems: "center", marginBottom: 20 },
    btnActive: { backgroundColor: "#0068FF" },
    btnText: { color: "#999", fontSize: 16, fontWeight: "600" },
    btnTextActive: { color: "#fff" },
})

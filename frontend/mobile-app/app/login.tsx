import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { ZaloColors } from "@/constants/zalo"
import AsyncStorage from "@react-native-async-storage/async-storage"
import apiClient from "@/constants/api"
import { useSocket } from "@/contexts/SocketContext"

export default function LoginScreen() {
    const router = useRouter()
    const { refreshUser } = useSocket()
    const [phone, setPhone] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleLogin = async () => {
        const p = phone.trim();
        const pwd = password.trim();
        if (!p || !pwd) return;
        setIsLoading(true);
        try {
            const response = await apiClient.post('/auth/login', { phone: p, password: pwd });
            
            // Xử lý JWT khi đăng nhập thành công
            const data = response.data.data; // Server trả về ApiResponse.success(data) -> data.data
            await AsyncStorage.setItem("accessToken", data.accessToken);
            await AsyncStorage.setItem("refreshToken", data.refreshToken);
            
            // Xac dinh UserId ngay sau khi dang nhap
            try {
                const profileRes = await apiClient.get('/users/profile', {
                    headers: { Authorization: `Bearer ${data.accessToken}` }
                });
                if (profileRes.data?.data?.id) {
                    await AsyncStorage.setItem("userId", profileRes.data.data.id.toString());
                    await refreshUser(); // Cập nhật lại Identity cho Socket và Chat
                }
            } catch (err) {
                console.log("Failed to fetch user profile upon login", err);
            }
            
            router.replace("/(tabs)")
        } catch (error: any) {
            console.log("Login Error:", error);
            Alert.alert("Đăng nhập thất bại", error.response?.data?.message || "Vui lòng kiểm tra lại số điện thoại và mật khẩu.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
            <StatusBar style="light" />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} disabled={isLoading}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Đăng nhập</Text>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
                <View style={styles.banner}>
                    <Text style={styles.bannerText}>Vui lòng nhập số điện thoại và mật khẩu để đăng nhập</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="Số điện thoại"
                        placeholderTextColor="#aaa"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                        editable={!isLoading}
                    />
                    <View style={styles.passwordWrapper}>
                        <TextInput
                            style={styles.inputInner}
                            placeholder="Mật khẩu"
                            placeholderTextColor="#aaa"
                            secureTextEntry={true}
                            value={password}
                            onChangeText={setPassword}
                            editable={!isLoading}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.loginBtn, phone && password ? styles.loginBtnActive : null]}
                        activeOpacity={0.8}
                        onPress={handleLogin}
                        disabled={!phone || !password || isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.loginText}>Đăng nhập</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.forgotWrap} onPress={() => router.push("/forgot-password")} disabled={isLoading}>
                        <Text style={styles.forgotTextBottom}>Quên mật khẩu?</Text>
                    </TouchableOpacity>

                    {/* Bottom Area: Register */}
                    <View style={styles.registerWrap}>
                        <Text style={styles.registerLabel}>Chưa có tài khoản? </Text>
                        <TouchableOpacity onPress={() => router.push("/register")} disabled={isLoading}>
                            <Text style={styles.registerLink}>Đăng ký ngay</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: ZaloColors.blue,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: ZaloColors.blue,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    backBtn: {
        marginRight: 16,
    },
    headerTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
    },
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    banner: {
        backgroundColor: "#f3f4f6",
        paddingVertical: 12,
        alignItems: "center",
    },
    bannerText: {
        fontSize: 14,
        color: "#555",
    },
    form: {
        padding: 20,
    },
    input: {
        fontSize: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#ccc",
        paddingVertical: 12,
        marginBottom: 20,
        color: "#000",
    },
    passwordWrapper: {
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#ccc",
        paddingBottom: 4,
        marginBottom: 30,
    },
    inputInner: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 8,
        color: "#000",
    },
    forgotWrap: {
        alignItems: "center",
        marginTop: 16,
    },
    forgotTextBottom: {
        color: "#555",
        fontSize: 14,
        fontWeight: "600",
    },
    loginBtn: {
        backgroundColor: "#cce5ff",
        borderRadius: 24,
        paddingVertical: 14,
        alignItems: "center",
        marginTop: 20,
    },
    loginBtnActive: {
        backgroundColor: ZaloColors.blue,
    },
    loginText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    registerWrap: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 40,
    },
    registerLabel: {
        fontSize: 14,
        color: "#555",
    },
    registerLink: {
        fontSize: 14,
        color: ZaloColors.blue,
        fontWeight: "600",
    },
})

import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { ZaloColors } from "@/constants/zalo"

export default function RegisterScreen() {
    const router = useRouter()
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")

    const handleRegister = () => {
        // Mock register: move to login
        router.back()
    }

    return (
        <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
            <StatusBar style="light" />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Tạo tài khoản</Text>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
                <View style={styles.banner}>
                    <Text style={styles.bannerText}>Nhập tên và số điện thoại để đăng ký</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="Tên nhóm / Tên Zalo"
                        placeholderTextColor="#aaa"
                        value={name}
                        onChangeText={setName}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Số điện thoại"
                        placeholderTextColor="#aaa"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                    />

                    <View style={styles.termsWrap}>
                        <Text style={styles.termsText}>
                            Bằng việc nhấn Tiếp tục, bạn đồng ý với các{" "}
                            <Text style={styles.termsLink}>Điều khoản sử dụng</Text> của Zalo.
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.btn, name && phone ? styles.btnActive : null]}
                        activeOpacity={0.8}
                        onPress={handleRegister}
                    >
                        <Text style={styles.btnText}>Tiếp tục</Text>
                    </TouchableOpacity>
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
    termsWrap: {
        marginBottom: 30,
    },
    termsText: {
        fontSize: 13,
        color: "#666",
        lineHeight: 20,
    },
    termsLink: {
        color: ZaloColors.blue,
        fontWeight: "500",
    },
    btn: {
        backgroundColor: "#cce5ff",
        borderRadius: 24,
        paddingVertical: 14,
        alignItems: "center",
    },
    btnActive: {
        backgroundColor: ZaloColors.blue,
    },
    btnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
})

import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"

export default function RegisterNameScreen() {
    const router = useRouter()
    const [name, setName] = useState("")

    const canContinue = name.trim().length >= 2

    return (
        <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
                <Text style={styles.title}>Nhập tên Zalo</Text>
                <Text style={styles.subtitle}>Hãy dùng tên thật để mọi người dễ nhận ra bạn</Text>
                
                <TextInput
                    style={styles.input}
                    placeholder="Nguyễn Văn A"
                    placeholderTextColor="#aaa"
                    value={name}
                    onChangeText={setName}
                    autoFocus
                />

                <View style={styles.rulesList}>
                    <Text style={styles.ruleItem}>• Dài từ 2 đến 40 ký tự</Text>
                    <Text style={styles.ruleItem}>• Không chứa số</Text>
                    <Text style={styles.ruleItem}>• Cần tuân thủ <Text style={styles.linkText}>quy định đặt tên Zalo</Text></Text>
                </View>

                <View style={{ flex: 1 }} />

                <TouchableOpacity 
                    style={[styles.btn, canContinue ? styles.btnActive : null]}
                    onPress={() => router.push("/register-info")}
                    disabled={!canContinue}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.btnText, canContinue ? styles.btnTextActive : null]}>Tiếp tục</Text>
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
        borderColor: "#ccc", /* When active in Zalo, it turns blue, keeping generic gray for mock */
        borderRadius: 8, 
        paddingVertical: 14, 
        paddingHorizontal: 16, 
        fontSize: 18, 
        color: "#000",
        backgroundColor: "#f9f9f9",
        marginBottom: 20
    },
    rulesList: { paddingLeft: 4 },
    ruleItem: { fontSize: 13, color: "#555", marginBottom: 4 },
    linkText: { color: "#0068FF", fontWeight: "600" },
    btn: { backgroundColor: "#e2e2e2", borderRadius: 24, paddingVertical: 14, alignItems: "center", marginBottom: 20 },
    btnActive: { backgroundColor: "#cce5ff" },
    btnText: { color: "#999", fontSize: 16, fontWeight: "600" },
    btnTextActive: { color: "#0068FF" },
})

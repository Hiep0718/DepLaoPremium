import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"

export default function RegisterInfoScreen() {
    const router = useRouter()
    const [dob, setDob] = useState("")
    const [gender, setGender] = useState("")

    const canContinue = true // Mock: always let continue since we don't have real pickers

    return (
        <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
                <Text style={styles.title}>Thêm thông tin cá nhân</Text>
                
                {/* Mock Date Picker Input */}
                <TouchableOpacity style={styles.inputBox} activeOpacity={0.7} onPress={() => setDob("01/01/2000")}>
                    <Text style={[styles.inputText, !dob && styles.placeholderText]}>{dob || "Sinh nhật"}</Text>
                    <Ionicons name="calendar-outline" size={20} color="#555" />
                </TouchableOpacity>

                {/* Mock Gender Picker Input */}
                <TouchableOpacity style={styles.inputBox} activeOpacity={0.7} onPress={() => setGender("Nam")}>
                    <Text style={[styles.inputText, !gender && styles.placeholderText]}>{gender || "Giới tính"}</Text>
                    <Ionicons name="chevron-down" size={20} color="#555" />
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity 
                    style={[styles.btn, canContinue ? styles.btnActive : null]}
                    onPress={() => router.push("/register-avatar")}
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
    title: { fontSize: 24, fontWeight: "700", textAlign: "center", marginBottom: 30, color: "#000" },
    inputBox: { 
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderWidth: 1, 
        borderColor: "#ccc",
        borderRadius: 8, 
        paddingVertical: 14, 
        paddingHorizontal: 16, 
        backgroundColor: "#f9f9f9",
        marginBottom: 16
    },
    inputText: { fontSize: 16, color: "#000" },
    placeholderText: { color: "#888" },
    btn: { backgroundColor: "#e2e2e2", borderRadius: 24, paddingVertical: 14, alignItems: "center", marginBottom: 20 },
    btnActive: { backgroundColor: "#cce5ff" },
    btnText: { color: "#999", fontSize: 16, fontWeight: "600" },
    btnTextActive: { color: "#0068FF" },
})

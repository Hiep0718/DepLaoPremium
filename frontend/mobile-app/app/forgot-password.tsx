import { useState, useRef, useEffect } from "react"
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    Animated,
    Keyboard,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { ZaloColors } from "@/constants/zalo"
import apiClient from "@/constants/api"

type Step = "phone" | "otp"

export default function ForgotPasswordScreen() {
    const router = useRouter()
    const [step, setStep] = useState<Step>("phone")
    const [phone, setPhone] = useState("")
    const [otp, setOtp] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [countdown, setCountdown] = useState(0)

    // Animation refs
    const fadeAnim = useRef(new Animated.Value(1)).current
    const slideAnim = useRef(new Animated.Value(0)).current

    // OTP input refs
    const otpInputRef = useRef<TextInput>(null)
    const passwordInputRef = useRef<TextInput>(null)

    // Countdown timer for resend OTP
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [countdown])

    const animateTransition = (callback: () => void) => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: -30,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => {
            callback()
            slideAnim.setValue(30)
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start()
        })
    }

    const handleSendOtp = async () => {
        const p = phone.trim()
        if (!p) {
            Alert.alert("Thông báo", "Vui lòng nhập số điện thoại")
            return
        }
        setIsLoading(true)
        try {
            const { data } = await apiClient.post("/auth/forgot-password/send-otp", { phone: p })
            if (data.success) {
                setCountdown(60)
                animateTransition(() => setStep("otp"))
                setTimeout(() => otpInputRef.current?.focus(), 400)
            } else {
                Alert.alert("Lỗi", data.message || "Không thể gửi mã OTP")
            }
        } catch (err: any) {
            Alert.alert(
                "Lỗi",
                err?.response?.data?.message || "Số điện thoại không tồn tại trong hệ thống"
            )
        } finally {
            setIsLoading(false)
        }
    }

    const handleResendOtp = async () => {
        if (countdown > 0) return
        setIsLoading(true)
        try {
            const { data } = await apiClient.post("/auth/forgot-password/send-otp", { phone: phone.trim() })
            if (data.success) {
                setCountdown(60)
                Alert.alert("Thành công", "Mã OTP mới đã được gửi")
            } else {
                Alert.alert("Lỗi", data.message || "Không thể gửi lại mã OTP")
            }
        } catch (err: any) {
            Alert.alert("Lỗi", err?.response?.data?.message || "Có lỗi xảy ra khi gửi lại mã OTP")
        } finally {
            setIsLoading(false)
        }
    }

    const handleResetPassword = async () => {
        const otpVal = otp.trim()
        const pwdVal = newPassword.trim()
        const confirmVal = confirmPassword.trim()

        if (!otpVal) {
            Alert.alert("Thông báo", "Vui lòng nhập mã OTP")
            return
        }
        if (!pwdVal) {
            Alert.alert("Thông báo", "Vui lòng nhập mật khẩu mới")
            return
        }
        if (pwdVal.length < 6) {
            Alert.alert("Thông báo", "Mật khẩu phải có ít nhất 6 ký tự")
            return
        }
        if (pwdVal !== confirmVal) {
            Alert.alert("Thông báo", "Mật khẩu xác nhận không khớp")
            return
        }

        Keyboard.dismiss()
        setIsLoading(true)
        try {
            const { data } = await apiClient.post("/auth/forgot-password/reset", {
                phone: phone.trim(),
                otp: otpVal,
                newPassword: pwdVal,
            })
            if (data.success) {
                Alert.alert(
                    "Thành công 🎉",
                    "Mật khẩu đã được đặt lại thành công!\nBạn có thể đăng nhập bằng mật khẩu mới.",
                    [
                        {
                            text: "Đăng nhập",
                            onPress: () => router.back(),
                        },
                    ]
                )
            } else {
                Alert.alert("Lỗi", data.message || "Không thể đổi mật khẩu")
            }
        } catch (err: any) {
            Alert.alert(
                "Lỗi",
                err?.response?.data?.message || "Mã OTP không đúng hoặc đã hết hạn"
            )
        } finally {
            setIsLoading(false)
        }
    }

    const handleGoBack = () => {
        if (step === "otp") {
            animateTransition(() => {
                setStep("phone")
                setOtp("")
                setNewPassword("")
                setConfirmPassword("")
            })
        } else {
            router.back()
        }
    }

    const renderStepIndicator = () => (
        <View style={styles.stepIndicator}>
            <View style={styles.stepRow}>
                <View style={[styles.stepDot, styles.stepDotActive]}>
                    <Ionicons name="phone-portrait-outline" size={14} color="#fff" />
                </View>
                <View style={[styles.stepLine, step === "otp" && styles.stepLineActive]} />
                <View style={[styles.stepDot, step === "otp" && styles.stepDotActive]}>
                    <Ionicons name="key-outline" size={14} color={step === "otp" ? "#fff" : "#aaa"} />
                </View>
            </View>
            <View style={styles.stepLabelRow}>
                <Text style={[styles.stepLabel, styles.stepLabelActive]}>Xác minh SĐT</Text>
                <Text style={[styles.stepLabel, step === "otp" && styles.stepLabelActive]}>
                    Đặt lại mật khẩu
                </Text>
            </View>
        </View>
    )

    const renderPhoneStep = () => (
        <View style={styles.stepContent}>
            <View style={styles.iconCircle}>
                <Ionicons name="call-outline" size={32} color={ZaloColors.blue} />
            </View>
            <Text style={styles.stepTitle}>Nhập số điện thoại</Text>
            <Text style={styles.stepDesc}>
                Nhập số điện thoại đã đăng ký tài khoản. Chúng tôi sẽ gửi mã OTP để xác minh.
            </Text>

            <View style={styles.inputGroup}>
                <View style={styles.inputWrap}>
                    <Ionicons
                        name="call-outline"
                        size={20}
                        color={ZaloColors.blue}
                        style={styles.inputIcon}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Số điện thoại"
                        placeholderTextColor="#aaa"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                        editable={!isLoading}
                        autoFocus
                    />
                </View>
            </View>

            <TouchableOpacity
                style={[styles.primaryBtn, phone.trim() ? styles.primaryBtnActive : null]}
                activeOpacity={0.8}
                onPress={handleSendOtp}
                disabled={!phone.trim() || isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <View style={styles.btnContent}>
                        <Text style={styles.primaryBtnText}>Gửi mã OTP</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </View>
                )}
            </TouchableOpacity>
        </View>
    )

    const renderOtpStep = () => (
        <View style={styles.stepContent}>
            <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark-outline" size={32} color={ZaloColors.blue} />
            </View>
            <Text style={styles.stepTitle}>Đặt lại mật khẩu</Text>
            <Text style={styles.stepDesc}>
                Nhập mã OTP đã gửi đến <Text style={styles.phoneBold}>{phone}</Text> và mật khẩu mới
                của bạn.
            </Text>

            <View style={styles.inputGroup}>
                {/* OTP Input */}
                <View style={styles.inputWrap}>
                    <Ionicons
                        name="keypad-outline"
                        size={20}
                        color={ZaloColors.blue}
                        style={styles.inputIcon}
                    />
                    <TextInput
                        ref={otpInputRef}
                        style={[styles.input, styles.otpInput]}
                        placeholder="Nhập mã OTP 6 số"
                        placeholderTextColor="#aaa"
                        keyboardType="number-pad"
                        value={otp}
                        onChangeText={(text) => {
                            if (text.length <= 6) setOtp(text)
                            if (text.length === 6) passwordInputRef.current?.focus()
                        }}
                        maxLength={6}
                        editable={!isLoading}
                    />
                    <TouchableOpacity
                        onPress={handleResendOtp}
                        disabled={countdown > 0 || isLoading}
                        style={styles.resendBtn}
                    >
                        <Text
                            style={[
                                styles.resendText,
                                countdown > 0 && styles.resendTextDisabled,
                            ]}
                        >
                            {countdown > 0 ? `${countdown}s` : "Gửi lại"}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* New Password */}
                <View style={styles.inputWrap}>
                    <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color={ZaloColors.blue}
                        style={styles.inputIcon}
                    />
                    <TextInput
                        ref={passwordInputRef}
                        style={styles.input}
                        placeholder="Mật khẩu mới"
                        placeholderTextColor="#aaa"
                        secureTextEntry={!showPassword}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        editable={!isLoading}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeBtn}
                    >
                        <Ionicons
                            name={showPassword ? "eye-outline" : "eye-off-outline"}
                            size={20}
                            color="#888"
                        />
                    </TouchableOpacity>
                </View>

                {/* Confirm Password */}
                <View style={styles.inputWrap}>
                    <Ionicons
                        name="lock-open-outline"
                        size={20}
                        color={ZaloColors.blue}
                        style={styles.inputIcon}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Xác nhận mật khẩu mới"
                        placeholderTextColor="#aaa"
                        secureTextEntry={!showConfirmPassword}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        editable={!isLoading}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.eyeBtn}
                    >
                        <Ionicons
                            name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                            size={20}
                            color="#888"
                        />
                    </TouchableOpacity>
                </View>

                {/* Password strength hint */}
                {newPassword.length > 0 && (
                    <View style={styles.hintRow}>
                        <Ionicons
                            name={newPassword.length >= 6 ? "checkmark-circle" : "close-circle"}
                            size={16}
                            color={newPassword.length >= 6 ? ZaloColors.success : ZaloColors.danger}
                        />
                        <Text
                            style={[
                                styles.hintText,
                                newPassword.length >= 6 ? styles.hintSuccess : styles.hintDanger,
                            ]}
                        >
                            Tối thiểu 6 ký tự
                        </Text>
                        {confirmPassword.length > 0 && (
                            <>
                                <View style={styles.hintSpacer} />
                                <Ionicons
                                    name={
                                        newPassword === confirmPassword
                                            ? "checkmark-circle"
                                            : "close-circle"
                                    }
                                    size={16}
                                    color={
                                        newPassword === confirmPassword
                                            ? ZaloColors.success
                                            : ZaloColors.danger
                                    }
                                />
                                <Text
                                    style={[
                                        styles.hintText,
                                        newPassword === confirmPassword
                                            ? styles.hintSuccess
                                            : styles.hintDanger,
                                    ]}
                                >
                                    Mật khẩu khớp
                                </Text>
                            </>
                        )}
                    </View>
                )}
            </View>

            <TouchableOpacity
                style={[
                    styles.primaryBtn,
                    otp.trim().length === 6 && newPassword.trim().length >= 6 && newPassword === confirmPassword
                        ? styles.primaryBtnActive
                        : null,
                ]}
                activeOpacity={0.8}
                onPress={handleResetPassword}
                disabled={
                    otp.trim().length !== 6 ||
                    newPassword.trim().length < 6 ||
                    newPassword !== confirmPassword ||
                    isLoading
                }
            >
                {isLoading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <View style={styles.btnContent}>
                        <Ionicons name="shield-checkmark" size={18} color="#fff" />
                        <Text style={styles.primaryBtnText}>Đặt lại mật khẩu</Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    )

    return (
        <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleGoBack} style={styles.backBtn} disabled={isLoading}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Quên mật khẩu</Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.container}
            >
                {renderStepIndicator()}

                <Animated.View
                    style={[
                        styles.animatedContainer,
                        { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
                    ]}
                >
                    {step === "phone" ? renderPhoneStep() : renderOtpStep()}
                </Animated.View>
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
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.15)",
        alignItems: "center",
        justifyContent: "center",
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

    /* Step Indicator */
    stepIndicator: {
        paddingHorizontal: 40,
        paddingTop: 24,
        paddingBottom: 8,
        backgroundColor: "#FAFBFC",
        borderBottomWidth: 1,
        borderBottomColor: "#F0F1F3",
    },
    stepRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    stepDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#E0E0E0",
        alignItems: "center",
        justifyContent: "center",
    },
    stepDotActive: {
        backgroundColor: ZaloColors.blue,
    },
    stepLine: {
        flex: 1,
        height: 3,
        backgroundColor: "#E0E0E0",
        marginHorizontal: 8,
        borderRadius: 2,
    },
    stepLineActive: {
        backgroundColor: ZaloColors.blue,
    },
    stepLabelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 8,
    },
    stepLabel: {
        fontSize: 12,
        color: "#aaa",
        fontWeight: "500",
    },
    stepLabelActive: {
        color: ZaloColors.blue,
        fontWeight: "600",
    },

    /* Animated Container */
    animatedContainer: {
        flex: 1,
    },

    /* Step Content */
    stepContent: {
        padding: 24,
        alignItems: "center",
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "rgba(0, 104, 255, 0.08)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    stepTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#111",
        marginBottom: 8,
    },
    stepDesc: {
        fontSize: 14,
        color: "#666",
        textAlign: "center",
        lineHeight: 20,
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    phoneBold: {
        fontWeight: "700",
        color: ZaloColors.blue,
    },

    /* Input */
    inputGroup: {
        width: "100%",
        gap: 12,
        marginBottom: 24,
    },
    inputWrap: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F6F7F9",
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: "#EBEBEB",
        paddingHorizontal: 14,
        minHeight: 50,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: "#111",
        paddingVertical: 12,
    },
    otpInput: {
        letterSpacing: 6,
        fontWeight: "600",
        fontSize: 18,
    },
    eyeBtn: {
        padding: 6,
    },
    resendBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    resendText: {
        fontSize: 13,
        fontWeight: "600",
        color: ZaloColors.blue,
    },
    resendTextDisabled: {
        color: "#aaa",
    },

    /* Hints */
    hintRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 4,
        gap: 4,
    },
    hintText: {
        fontSize: 12,
        fontWeight: "500",
    },
    hintSuccess: {
        color: ZaloColors.success,
    },
    hintDanger: {
        color: ZaloColors.danger,
    },
    hintSpacer: {
        width: 12,
    },

    /* Buttons */
    primaryBtn: {
        width: "100%",
        backgroundColor: "#B8D4FF",
        borderRadius: 25,
        paddingVertical: 15,
        alignItems: "center",
        justifyContent: "center",
    },
    primaryBtnActive: {
        backgroundColor: ZaloColors.blue,
        shadowColor: ZaloColors.blue,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    btnContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
})

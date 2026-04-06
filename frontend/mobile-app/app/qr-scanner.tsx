import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "@/constants/api";
import { useSocket } from "@/contexts/SocketContext";
import { ZaloColors } from "@/constants/zalo";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.65;

export default function QRScannerScreen() {
  const router = useRouter();
  const { socket, currentUserId } = useSocket();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scanLock = useRef(false);

  // Request camera permission on mount
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanLock.current || scanned) return;
    scanLock.current = true;
    setScanned(true);

    try {
      const parsed = JSON.parse(data);

      // Validate QR data
      if (parsed.type !== "qr_login" || !parsed.sessionId || parsed.app !== "deplao") {
        Alert.alert("QR không hợp lệ", "Mã QR này không phải là mã đăng nhập DepLao.", [
          {
            text: "Quét lại",
            onPress: () => {
              setScanned(false);
              scanLock.current = false;
            },
          },
        ]);
        return;
      }

      // Check if QR is expired (3 min)
      const age = Date.now() - parsed.timestamp;
      if (age > 180000) {
        Alert.alert("Mã QR hết hạn", "Mã QR đã hết hạn. Vui lòng tải lại mã trên máy tính.", [
          {
            text: "Quét lại",
            onPress: () => {
              setScanned(false);
              scanLock.current = false;
            },
          },
        ]);
        return;
      }

      setSessionId(parsed.sessionId);

      // Notify server that mobile scanned the QR
      if (socket?.connected && currentUserId) {
        socket.emit("qr_login_scan", {
          sessionId: parsed.sessionId,
          userId: currentUserId,
        });
      }

      // Show confirmation popup
      setShowConfirm(true);
    } catch (e) {
      Alert.alert("Lỗi", "Không thể đọc mã QR. Vui lòng thử lại.", [
        {
          text: "Quét lại",
          onPress: () => {
            setScanned(false);
            scanLock.current = false;
          },
        },
      ]);
    }
  };

  const handleConfirmLogin = async () => {
    if (!sessionId || isConfirming) return;
    setIsConfirming(true);

    try {
      const mobileToken = await AsyncStorage.getItem("accessToken");
      if (!mobileToken) {
        Alert.alert("Lỗi", "Bạn chưa đăng nhập. Vui lòng đăng nhập lại.");
        setIsConfirming(false);
        return;
      }

      // Call Spring Boot to generate web tokens
      const response = await apiClient.post("/auth/qr-login/confirm", {
        accessToken: mobileToken,
      });

      if (response.data?.success) {
        const { accessToken, refreshToken, user } = response.data.data;

        // Send tokens to web via socket
        if (socket?.connected) {
          socket.emit("qr_login_confirm", {
            sessionId,
            accessToken,
            refreshToken,
            user,
          });
        }

        setIsSuccess(true);

        // Show success briefly then go back
        setTimeout(() => {
          setShowConfirm(false);
          setIsSuccess(false);
          router.back();
        }, 1500);
      } else {
        throw new Error(response.data?.message || "Xác nhận thất bại");
      }
    } catch (error: any) {
      console.error("QR Login confirm error:", error);
      Alert.alert(
        "Xác nhận thất bại",
        error.response?.data?.message || error.message || "Có lỗi xảy ra"
      );
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setScanned(false);
    setSessionId(null);
    scanLock.current = false;
  };

  // Camera permission not granted
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={ZaloColors.blue} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={64} color="#999" />
          <Text style={styles.permissionTitle}>Cần quyền truy cập Camera</Text>
          <Text style={styles.permissionDesc}>
            Để quét mã QR đăng nhập, ứng dụng cần quyền truy cập camera.
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Cho phép truy cập</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancelLink}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.fullScreen}>
      <StatusBar style="light" />

      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Header */}
        <SafeAreaView edges={["top"]} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quét mã QR</Text>
          <View style={{ width: 40 }} />
        </SafeAreaView>

        {/* Top dark area */}
        <View style={styles.darkArea} />

        {/* Middle row with scan area */}
        <View style={styles.middleRow}>
          <View style={styles.darkArea} />
          <View style={styles.scanArea}>
            {/* Corner decorations */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />

            {/* Scanning line animation */}
            {!scanned && (
              <View style={styles.scanLineContainer}>
                <View style={styles.scanLine} />
              </View>
            )}
          </View>
          <View style={styles.darkArea} />
        </View>

        {/* Bottom area */}
        <View style={[styles.darkArea, styles.bottomInfo]}>
          <Text style={styles.hintText}>
            Đưa mã QR vào khung hình để quét
          </Text>
          <Text style={styles.subHintText}>
            Quét mã QR trên trang đăng nhập DepLao Web
          </Text>
        </View>
      </View>

      {/* Confirmation Modal */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {isSuccess ? (
              // Success state
              <View style={styles.modalContent}>
                <View style={[styles.iconCircle, { backgroundColor: "#e8f5e9" }]}>
                  <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
                </View>
                <Text style={styles.modalTitle}>Đăng nhập thành công!</Text>
                <Text style={styles.modalDesc}>
                  Máy tính đã được đăng nhập vào tài khoản của bạn.
                </Text>
              </View>
            ) : (
              // Confirm state
              <View style={styles.modalContent}>
                <View style={[styles.iconCircle, { backgroundColor: "#e3f2fd" }]}>
                  <Ionicons name="desktop-outline" size={48} color={ZaloColors.blue} />
                </View>
                <Text style={styles.modalTitle}>Xác nhận đăng nhập</Text>
                <Text style={styles.modalDesc}>
                  Bạn có muốn đăng nhập tài khoản trên máy tính không?
                </Text>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={handleCancel}
                    disabled={isConfirming}
                  >
                    <Text style={styles.cancelBtnText}>Hủy</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmBtn, isConfirming && { opacity: 0.7 }]}
                    onPress={handleConfirmLogin}
                    disabled={isConfirming}
                  >
                    {isConfirming ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.confirmBtnText}>Đăng nhập</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  darkArea: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  middleRow: {
    flexDirection: "row",
    height: SCAN_AREA_SIZE,
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: ZaloColors.blue,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanLineContainer: {
    position: "absolute",
    top: 0,
    left: 8,
    right: 8,
    bottom: 0,
    overflow: "hidden",
  },
  scanLine: {
    width: "100%",
    height: 2,
    backgroundColor: ZaloColors.blue,
    opacity: 0.7,
    position: "absolute",
    top: "50%",
  },
  bottomInfo: {
    alignItems: "center",
    paddingTop: 32,
    paddingHorizontal: 40,
  },
  hintText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  subHintText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    textAlign: "center",
  },
  // Permission screen
  permissionBox: {
    alignItems: "center",
    padding: 40,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  permissionDesc: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    lineHeight: 20,
  },
  permissionBtn: {
    backgroundColor: ZaloColors.blue,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 8,
  },
  permissionBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelLink: {
    color: "#999",
    fontSize: 14,
    marginTop: 8,
  },
  // Confirmation Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 340,
    overflow: "hidden",
  },
  modalContent: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
    marginBottom: 8,
    textAlign: "center",
  },
  modalDesc: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: ZaloColors.blue,
    alignItems: "center",
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});

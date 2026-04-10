import { useState, useEffect, useCallback } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import apiClient from "@/constants/api"
import { useSocket } from "@/contexts/SocketContext"
import { ZaloColors } from "@/constants/zalo"
import { useFocusEffect } from "@react-navigation/native"

export function FriendRequestsScreen() {
  const router = useRouter()
  const { socket } = useSocket()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null) // ID của request đang được xử lý

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const [pendingRes, sentRes] = await Promise.all([
        apiClient.get('/contacts/requests/pending'),
        apiClient.get('/contacts/requests/sent')
      ])

      const pendingData = (pendingRes.data?.data?.content || []).map((r: any) => ({ ...r, reqType: 'pending' }))
      const sentData = (sentRes.data?.data?.content || []).map((r: any) => ({ ...r, reqType: 'sent' }))

      const combined = [...pendingData, ...sentData].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      setRequests(combined)
    } catch (error: any) {
      console.log('Error fetching requests', error)
      Alert.alert("Lỗi", error.response?.data?.message || "Không thể tải danh sách lời mời.")
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchRequests()
    }, [])
  )

  useEffect(() => {
    if (!socket) return;
    
    // Khi socket nhận được tín hiệu (có người khác gửi yêu cầu hoặc phản hồi)
    const handleFriendAction = (data: any) => {
      fetchRequests()
    }
    
    socket.on('friend_action_received', handleFriendAction)
    return () => {
      socket.off('friend_action_received', handleFriendAction)
    }
  }, [socket])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchRequests()
    setRefreshing(false)
  }, [])

  const handleAccept = async (requestId: string) => {
    setActionLoading(requestId)
    try {
      await apiClient.post(`/contacts/requests/${requestId}/accept`)
      
      // ĐEmit socket cho người kia biết để họ cập nhật danh sách "Đã gửi" & Danh bạ
      const requestDetail = requests.find(r => r.id === requestId)
      if (requestDetail?.sender?.id) {
        socket?.emit('friend_action', { recipientId: requestDetail.sender.id, action: 'accept' })
      }

      setRequests(prev => prev.filter(r => r.id !== requestId))
    } catch (error: any) {
      console.log('Error accepting request', error)
      Alert.alert("Lỗi", "Không thể đồng ý kết bạn lúc này.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (requestId: string) => {
    setActionLoading(requestId)
    try {
      await apiClient.post(`/contacts/requests/${requestId}/reject`)

      const requestDetail = requests.find(r => r.id === requestId)
      if (requestDetail?.sender?.id) {
        socket?.emit('friend_action', { recipientId: requestDetail.sender.id, action: 'reject' })
      }

      setRequests(prev => prev.filter(r => r.id !== requestId))
    } catch (error: any) {
      console.log('Error rejecting request', error)
      Alert.alert("Lỗi", "Không thể từ chối lúc này.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async (requestId: string) => {
    setActionLoading(requestId)
    try {
      await apiClient.delete(`/contacts/requests/${requestId}/cancel`)

      const requestDetail = requests.find(r => r.id === requestId)
      if (requestDetail?.receiver?.id) {
        socket?.emit('friend_action', { recipientId: requestDetail.receiver.id, action: 'cancel' })
      }

      setRequests(prev => prev.filter(r => r.id !== requestId))
    } catch (error: any) {
      console.log('Error cancelling request', error)
      Alert.alert("Lỗi", "Không thể thu hồi lúc này.")
    } finally {
      setActionLoading(null)
    }
  }

  const renderItem = ({ item }: { item: any }) => {
    const isSentTab = item.reqType === 'sent'
    const otherUser = isSentTab ? item.receiver : item.sender
    const isLoading = actionLoading === item.id
    const message = item.message || "Xin chào, mình muốn kết bạn với bạn!"

    return (
      <View style={styles.requestItem}>
        <View style={styles.avatarContainer}>
          {otherUser?.avatarUrl ? (
            <Image source={{ uri: otherUser.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Ionicons name="person" size={28} color="#fff" />
          )}
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.nameText}>{otherUser?.nickname || otherUser?.fullName}</Text>
          <Text style={styles.dateText}>
            {isSentTab ? "Đã gửi yêu cầu kết bạn" : "Bạn có một yêu cầu kết bạn"} • {new Date(item.createdAt).toLocaleDateString('vi-VN')}
          </Text>
          <View style={styles.messageBox}>
            <Text style={styles.messageText} numberOfLines={2}>"{message}"</Text>
          </View>

          <View style={styles.actionsContainer}>
            {isSentTab ? (
              <TouchableOpacity
                style={[styles.btn, styles.rejectBtn]}
                onPress={() => handleCancel(item.id)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#666" size="small" />
                ) : (
                  <Text style={styles.rejectText}>Thu hồi</Text>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.btn, styles.rejectBtn]}
                  onPress={() => handleReject(item.id)}
                  disabled={isLoading}
                >
                  <Text style={styles.rejectText}>Từ chối</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.acceptBtn]}
                  onPress={() => handleAccept(item.id)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.acceptText}>Đồng ý</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lời mời kết bạn</Text>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.centerItem}>
          <ActivityIndicator size="large" color={ZaloColors.blue} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.centerItem}>
          <Ionicons name="people-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>Bạn không có lời mời kết bạn nào</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => `${item.reqType}-${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ZaloColors.blue]} />}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f2"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ZaloColors.blue,
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  backBtn: {
    marginRight: 16
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff"
  },
  centerItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  emptyText: {
    fontSize: 16,
    color: "#888",
    marginTop: 16
  },
  requestItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee"
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#d1d1d1",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginRight: 16
  },
  avatarImg: {
    width: "100%",
    height: "100%"
  },
  infoContainer: {
    flex: 1
  },
  nameText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2
  },
  dateText: {
    fontSize: 12,
    color: "#888",
    marginBottom: 8
  },
  messageBox: {
    backgroundColor: "#f5f5f5",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12
  },
  messageText: {
    fontSize: 14,
    color: "#333",
    fontStyle: "italic"
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  acceptBtn: {
    backgroundColor: ZaloColors.blue
  },
  rejectBtn: {
    backgroundColor: "#e5e7eb"
  },
  acceptText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14
  },
  rejectText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 14
  }
})

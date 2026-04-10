"use client"

import { useState, useEffect, useCallback } from "react"
import { View, Text, TouchableOpacity, TextInput, Modal, FlatList, ActivityIndicator, StyleSheet, Image, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import apiClient from "@/constants/api"
import { chatApiClient } from "@/constants/chatApi"
import { useSocket } from "@/contexts/SocketContext"
import { ZaloColors } from "@/constants/zalo"

const MENU_ITEMS = [
    { id: "1", icon: "person-add-outline", label: "Thêm bạn", color: "#666" },
    { id: "2", icon: "people-outline", label: "Tạo nhóm", color: "#666" },
    { id: "3", icon: "folder-outline", label: "My Documents", color: "#666" },
    { id: "4", icon: "calendar-outline", label: "Lịch Zalo", color: "#666" },
    { id: "5", icon: "videocam-outline", label: "Tạo cuộc gọi nhóm", color: "#666" },
    { id: "6", icon: "desktop-outline", label: "Thiết bị đăng nhập", color: "#666" },
]

interface ZaloHeaderProps {
    activeTab: string
}

export function ZaloHeader({ activeTab }: ZaloHeaderProps) {
    const router = useRouter()
    const { currentUserId } = useSocket()
    const [searchText, setSearchText] = useState("")
    const [showMenu, setShowMenu] = useState(false)
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showResults, setShowResults] = useState(false)
    
    // States for Friend Requests
    const [loadingRequests, setLoadingRequests] = useState<Set<string>>(new Set())
    const [sentRequests, setSentRequests] = useState<Set<string>>(new Set())

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchText.trim().length >= 2) {
                handleSearch(searchText.trim())
            } else {
                setSearchResults([])
                setShowResults(false)
            }
        }, 500)
        return () => clearTimeout(timer)
    }, [searchText])

    const handleSearch = async (query: string) => {
        setIsSearching(true)
        setShowResults(true)
        try {
            // 1. Tìm trong danh bạ (API đã filter LIKE fullname hoặc phone)
            const contactRes = await apiClient.get(`/contacts/search?search=${query}`)
            const friends = contactRes.data?.data?.content || []
            
            const finalFriends = friends.map((f: any) => ({ ...f, isFriend: true }))

            // 2. Chỉ tìm người lạ nếu query là số điện thoại (100% khớp)
            let nonFriends: any[] = []
            const isPhoneNumber = /^\d+$/.test(query)

            if (isPhoneNumber) {
                // Tối ưu: Nếu muốn nhanh, có thể vẫn gọi /users/search và filter
                const userRes = await apiClient.get(`/users/search?search=${query}`)
                const globalUsers = userRes.data?.data?.content || []
                
                // Lọc bỏ những người đã là bạn bè
                const friendsIds = new Set(friends.map((f: any) => f.contactUserId?.toString() || f.id?.toString()))
                
                // Lọc ra network strangers: KHÔNG phải hiện tại, CHƯA kết bạn, ĐÚNG 100% SĐT
                nonFriends = globalUsers.filter((u: any) => {
                    const uid = u.id?.toString()
                    const isSelf = uid === currentUserId?.toString()
                    const isFriend = friendsIds.has(uid)
                    const isExactPhoneMatch = u.phone === query
                    
                    return !isSelf && !isFriend && isExactPhoneMatch
                }).map((u: any) => ({ ...u, isFriend: false }))
            }

            const finalResults = [...finalFriends, ...nonFriends]

            setSearchResults(finalResults)
        } catch (error) {
            console.error("Search error:", error)
        } finally {
            setIsSearching(false)
        }
    }

    const handleSelectUser = async (user: any) => {
        const targetUserId = user.contactUserId || user.id
        const targetName = user.nickname || user.fullName
        
        if (!currentUserId || !targetUserId) return

        // 1. Tạo conversationId định danh: 1to1_minId_maxId
        const ids = [currentUserId.toString(), targetUserId.toString()].sort()
        const convId = `1to1_${ids[0]}_${ids[1]}`

        try {
            // 2. Đảm bảo Conversation đã tồn tại trên Node.js
            await chatApiClient.post('/conversation', {
                conversationId: convId,
                participants: [currentUserId.toString(), targetUserId.toString()],
                isGroup: false
            })

            // 3. Clear search và Navigate
            setSearchText("")
            setShowResults(false)
            router.push({
                pathname: "/chat/[id]",
                params: {
                    id: convId,
                    name: targetName,
                    recipientId: targetUserId.toString(),
                    avatar: user.avatarUrl || ""
                }
            })
        } catch (error) {
            console.error("Failed to start conversation", error)
        }
    }

    const handleClearSearch = () => {
        setSearchText("")
        setSearchResults([])
        setShowResults(false)
    }

    const handleSendFriendRequest = async (user: any) => {
        const targetUserId = user.id?.toString() || user.contactUserId?.toString();
        if (!targetUserId || !user.phone) return;

        setLoadingRequests(prev => new Set(prev).add(targetUserId));
        
        try {
            await apiClient.post('/contacts/requests', { 
                phone: user.phone, 
                message: "Xin chào, mình muốn kết bạn với bạn!" 
            });
            
            // Cập nhật trạng thái thành công
            setSentRequests(prev => new Set(prev).add(targetUserId));

            // Phát tín hiệu Real-time cho bên kia
            if (socket) {
                socket.emit('friend_action', { recipientId: targetUserId, action: 'new_request' });
            }

            Alert.alert("Thành công", `Đã gửi yêu cầu kết bạn tới ${user.nickname || user.fullName}`);
        } catch (error: any) {
            console.error("Gửi kết bạn lỗi:", error);
            const errorMsg = error.response?.data?.message || "Không thể gửi lời mời kết bạn vào lúc này.";
            
            // Nếu lỗi báo đã gửi rồi, auto cập nhật UI
            if (errorMsg.toLowerCase().includes('đã tồn tại') || errorMsg.toLowerCase().includes('already')) {
                setSentRequests(prev => new Set(prev).add(targetUserId));
            }
            
            Alert.alert("Lỗi", errorMsg);
        } finally {
            setLoadingRequests(prev => {
                const newSet = new Set(prev);
                newSet.delete(targetUserId);
                return newSet;
            });
        }
    }

    const renderHeaderIcons = () => {
        switch (activeTab) {
            case "messages":
                // Tin nhắn: icon quét QR và dấu cộng
                return (
                    <>
                        <TouchableOpacity onPress={() => router.push("/qr-scanner")}>
                            <Ionicons name="scan" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowMenu(true)}>
                            <Ionicons name="add-circle" size={22} color="#fff" />
                        </TouchableOpacity>
                    </>
                )

            case "contacts":
                // Danh bạ: icon người + dấu cộng (thêm bạn)
                return (
                    <>
                        <TouchableOpacity>
                            <Ionicons name="person-add" size={20} color="#fff" />
                        </TouchableOpacity>
                        {/* <TouchableOpacity onPress={() => setShowMenu(true)}>
                            <Ionicons name="add-circle" size={22} color="#fff" />
                        </TouchableOpacity> */}
                    </>
                )

            case "discover":
                // Khám phá: icon QR
                return (
                    <TouchableOpacity onPress={() => router.push("/qr-scanner")}>
                        <Ionicons name="scan" size={20} color="#fff" />
                    </TouchableOpacity>
                )

            case "feed":
                // Tường nhà: icon bộ sưu tập (upload hình) + icon chuông (thông báo)
                return (
                    <>
                        <TouchableOpacity>
                            <Ionicons name="images" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity>
                            <Ionicons name="notifications" size={20} color="#fff" />
                        </TouchableOpacity>
                    </>
                )

            case "profile":
                // Cá nhân: icon bánh răng (cài đặt)
                return (
                    <TouchableOpacity>
                        <Ionicons name="settings" size={20} color="#fff" />
                    </TouchableOpacity>
                )

            default:
                return null
        }
    }

    const renderMenuItem = ({ item }: { item: (typeof MENU_ITEMS)[0] }) => (
        <TouchableOpacity
            style={{
                flexDirection: "row",
                paddingVertical: 14,
                paddingHorizontal: 16,
                alignItems: "center",
            }}
            onPress={() => setShowMenu(false)}
        >
            <Ionicons name={item.icon as any} size={22} color={item.color} style={{ width: 32 }} />
            <Text style={{ fontSize: 16, color: "#333", marginLeft: 4 }}>{item.label}</Text>
        </TouchableOpacity>
    )

    return (
        <>
            <View
                style={{
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    paddingTop: 8,
                    backgroundColor: "#0068FF",
                }}
            >
                {/* Search bar container */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        borderRadius: 20,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        gap: 8,
                    }}
                >
                    {/* Search icon */}
                    <Ionicons name="search" size={18} color="#fff" />

                    {/* Search input */}
                    <TextInput
                        style={{
                            flex: 1,
                            fontSize: 14,
                            color: "#fff",
                            padding: 0,
                        }}
                        placeholder="Tìm kiếm"
                        placeholderTextColor="rgba(255, 255, 255, 0.7)"
                        value={searchText}
                        onChangeText={setSearchText}
                    />

                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={handleClearSearch} style={{ padding: 2 }}>
                            <Ionicons name="close-circle" size={16} color="rgba(255, 255, 255, 0.6)" />
                        </TouchableOpacity>
                    )}

                    {renderHeaderIcons()}
                </View>

                {/* Search Results Dropdown */}
                {showResults && (
                    <View style={styles.resultsContainer}>
                        {isSearching ? (
                            <View style={styles.centerItem}>
                                <ActivityIndicator size="small" color={ZaloColors.blue} />
                                <Text style={styles.subText}>Đang tìm kiếm...</Text>
                            </View>
                        ) : searchResults.length > 0 ? (
                            <FlatList
                                data={searchResults}
                                keyExtractor={(item, index) => index.toString()}
                                scrollEnabled={true}
                                keyboardShouldPersistTaps="handled"
                                renderItem={({ item }) => (
                                    <TouchableOpacity 
                                        style={styles.resultItem}
                                        onPress={() => handleSelectUser(item)}
                                    >
                                        <View style={styles.avatarMini}>
                                            {item.avatarUrl ? (
                                                <Image source={{ uri: item.avatarUrl }} style={styles.avatarImg} />
                                            ) : (
                                                <Ionicons name="person" size={20} color="#888" />
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={styles.resultName}>{item.nickname || item.fullName}</Text>
                                                {item.isFriend && (
                                                    <View style={styles.friendTag}>
                                                        <Text style={styles.friendTagText}>Bạn bè</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.resultPhone}>{item.phone}</Text>
                                        </View>
                                        
                                        {/* Hiển thị nút Kết bạn nếu không phải là bạn bè */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            {!item.isFriend && (
                                                <TouchableOpacity 
                                                    style={{ 
                                                        marginRight: 16,
                                                        padding: 8,
                                                        backgroundColor: sentRequests.has(item.id?.toString()) ? '#f0f0f0' : '#e1f5fe',
                                                        borderRadius: 20
                                                    }}
                                                    onPress={() => !sentRequests.has(item.id?.toString()) && handleSendFriendRequest(item)}
                                                    disabled={loadingRequests.has(item.id?.toString()) || sentRequests.has(item.id?.toString())}
                                                >
                                                    {loadingRequests.has(item.id?.toString()) ? (
                                                        <ActivityIndicator size="small" color={ZaloColors.blue} />
                                                    ) : sentRequests.has(item.id?.toString()) ? (
                                                        <Ionicons name="checkmark" size={18} color="#4caf50" />
                                                    ) : (
                                                        <Ionicons name="person-add-outline" size={18} color={ZaloColors.blue} />
                                                    )}
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity 
                                                style={{ padding: 8, marginLeft: item.isFriend ? 0 : 8 }}
                                                onPress={() => handleSelectUser(item)}
                                            >
                                                <Ionicons name="chatbubble-outline" size={22} color={ZaloColors.blue} />
                                            </TouchableOpacity>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            />
                        ) : (
                            <View style={styles.centerItem}>
                                <Text style={styles.subText}>Không tìm thấy kết quả</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            <Modal visible={showMenu} animationType="fade" transparent={true}>
                <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0)" }} 
                    activeOpacity={1} 
                    onPress={() => setShowMenu(false)}
                >
                    <View
                        style={{
                            position: "absolute",
                            top: 55, // Ngay dưới header
                            right: 12, // Canh phải
                            backgroundColor: "#fff",
                            borderRadius: 4,
                            width: 220,
                            elevation: 5,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 3.84,
                            paddingVertical: 4,
                        }}
                    >
                        <FlatList
                            data={MENU_ITEMS}
                            renderItem={renderMenuItem}
                            keyExtractor={(item) => item.id}
                            scrollEnabled={false}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    )
}

const styles = StyleSheet.create({
    resultsContainer: {
        position: 'absolute',
        top: 56, // Ngay dưới thanh search
        left: 12,
        right: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        maxHeight: 300,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        zIndex: 1000,
        overflow: 'hidden'
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: '#eee',
    },
    avatarMini: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden'
    },
    avatarImg: {
        width: 40,
        height: 40,
    },
    resultName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#000',
    },
    resultPhone: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    friendTag: {
        backgroundColor: '#e1f5fe',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    friendTagText: {
        fontSize: 10,
        color: '#0288d1',
        fontWeight: '700',
    },
    centerItem: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    subText: {
        fontSize: 14,
        color: '#888',
        marginTop: 8,
    }
});

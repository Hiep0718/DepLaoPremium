"use client"

import { useState, useEffect, useCallback } from "react"
import { View, Text, TouchableOpacity, TextInput, Modal, FlatList, ActivityIndicator, StyleSheet, Image } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import apiClient from "@/constants/api"
import { chatApiClient } from "@/constants/chatApi"
import { useSocket } from "@/contexts/SocketContext"
import { ZaloColors } from "@/constants/zalo"

const MENU_ITEMS = [
    { id: "1", icon: "person-add", label: "Thêm bạn", color: "#0084FF" },
    { id: "2", icon: "people", label: "Tạo nhóm", color: "#0084FF" },
    { id: "3", icon: "document-text", label: "My Documents", color: "#FF6B35" },
    { id: "4", icon: "calendar", label: "Lịch Zalo", color: "#FFB700" },
    { id: "5", icon: "phone", label: "Tạo cuộc gọi nhóm", color: "#00C851" },
    { id: "6", icon: "phone-portrait", label: "Thiết bị đăng nhập", color: "#7B68EE" },
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
            // 1. Tìm trong danh bạ (luôn gọi)
            const contactRes = await apiClient.get(`/contacts/search?search=${query}`)
            const friends = contactRes.data?.data?.content || []
            
            let finalResults = friends.map((f: any) => ({ ...f, isFriend: true }))

            // 2. Nếu là số điện thoại, tìm trong toàn bộ User
            const isNumeric = /^\d+$/.test(query)
            if (isNumeric) {
                const userRes = await apiClient.get(`/users/search?search=${query}`)
                const globalUsers = userRes.data?.data?.content || []
                
                // Lọc bỏ những người đã là bạn bè (để tránh trùng lặp)
                const friendsIds = new Set(friends.map((f: any) => f.contactUserId?.toString() || f.id?.toString()))
                
                const nonFriends = globalUsers.filter((u: any) => {
                    const uid = u.id?.toString()
                    return uid !== currentUserId?.toString() && !friendsIds.has(uid)
                }).map((u: any) => ({ ...u, isFriend: false }))

                finalResults = [...finalResults, ...nonFriends]
            }

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
                    avatar: user.avatarUrl
                }
            })
        } catch (error) {
            console.error("Failed to start conversation", error)
        }
    }

    const renderHeaderIcons = () => {
        switch (activeTab) {
            case "messages":
                // Tin nhắn: icon quét QR và dấu cộng
                return (
                    <>
                        <TouchableOpacity>
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
                    <TouchableOpacity>
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
                paddingVertical: 16,
                paddingHorizontal: 16,
                alignItems: "center",
                borderBottomWidth: 1,
                borderBottomColor: "#f0f0f0",
            }}
        >
            <View
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: item.color + "15",
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 12,
                }}
            >
                <Ionicons name={item.icon as any} size={20} color={item.color} />
            </View>
            <Text style={{ fontSize: 16, color: "#000", fontWeight: "500" }}>{item.label}</Text>
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
                                        <Ionicons name="chatbubble-outline" size={20} color={ZaloColors.blue} />
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

            <Modal visible={showMenu} animationType="slide" transparent={true}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <View
                        style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            backgroundColor: "#fff",
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                            maxHeight: "70%",
                        }}
                    >
                        <View
                            style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "center",
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                borderBottomWidth: 1,
                                borderBottomColor: "#f0f0f0",
                            }}
                        >
                            <Text style={{ fontSize: 18, fontWeight: "600", color: "#000" }}>Menu</Text>
                            <TouchableOpacity onPress={() => setShowMenu(false)}>
                                <Ionicons name="close" size={24} color="#000" />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={MENU_ITEMS}
                            renderItem={renderMenuItem}
                            keyExtractor={(item) => item.id}
                            scrollEnabled={true}
                        />
                    </View>
                </View>
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

"use client"

import { useState } from "react"
import { View, Text, TouchableOpacity, TextInput, Modal, FlatList } from "react-native"
import { Ionicons } from "@expo/vector-icons"

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
    const [searchText, setSearchText] = useState("")
    const [showMenu, setShowMenu] = useState(false)

    const renderHeaderIcons = () => {
        switch (activeTab) {
            case "messages":
                // Tin nhắn: icon quét QR và dấu cộng
                return (
                    <>
                        <TouchableOpacity>
                            <Ionicons name="scan" size={20} color="#0084FF" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowMenu(true)}>
                            <Ionicons name="add-circle" size={22} color="#0084FF" />
                        </TouchableOpacity>
                    </>
                )

            case "contacts":
                // Danh bạ: icon người + dấu cộng (thêm bạn)
                return (
                    <>
                        <TouchableOpacity>
                            <Ionicons name="person-add" size={20} color="#0084FF" />
                        </TouchableOpacity>
                        {/* <TouchableOpacity onPress={() => setShowMenu(true)}>
                            <Ionicons name="add-circle" size={22} color="#0084FF" />
                        </TouchableOpacity> */}
                    </>
                )

            case "discover":
                // Khám phá: icon QR
                return (
                    <TouchableOpacity>
                        <Ionicons name="scan" size={20} color="#0084FF" />
                    </TouchableOpacity>
                )

            case "feed":
                // Tường nhà: icon bộ sưu tập (upload hình) + icon chuông (thông báo)
                return (
                    <>
                        <TouchableOpacity>
                            <Ionicons name="images" size={20} color="#0084FF" />
                        </TouchableOpacity>
                        <TouchableOpacity>
                            <Ionicons name="notifications" size={20} color="#0084FF" />
                        </TouchableOpacity>
                    </>
                )

            case "profile":
                // Cá nhân: icon bánh răng (cài đặt)
                return (
                    <TouchableOpacity>
                        <Ionicons name="settings" size={20} color="#0084FF" />
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
                    backgroundColor: "#fff",
                    borderBottomWidth: 1,
                    borderBottomColor: "#f0f0f0",
                }}
            >
                {/* Search bar container */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#f0f0f0",
                        borderRadius: 20,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        gap: 8,
                    }}
                >
                    {/* Search icon */}
                    <Ionicons name="search" size={18} color="#999" />

                    {/* Search input */}
                    <TextInput
                        style={{
                            flex: 1,
                            fontSize: 14,
                            color: "#000",
                            padding: 0,
                        }}
                        placeholder="Tìm kiếm"
                        placeholderTextColor="#999"
                        value={searchText}
                        onChangeText={setSearchText}
                    />

                    {renderHeaderIcons()}
                </View>
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

import { View, TouchableOpacity, Text, StyleSheet, Dimensions, Platform, Keyboard } from "react-native"
import Ionicons from "@expo/vector-icons/Ionicons"
import { useState, useEffect } from "react"

const ZALO_BLUE = "#0068FF"
const INACTIVE_GRAY = "#8E8E93"
const BACKGROUND_COLOR = "#FFFFFF"

interface NavItem {
    id: string
    label: string
    iconName: keyof typeof Ionicons.glyphMap
}

const NAV_ITEMS: NavItem[] = [
    { id: "messages", label: "Tin nhắn", iconName: "chatbubble-outline" },
    { id: "contacts", label: "Danh bạ", iconName: "people-outline" },
    { id: "discover", label: "Khám phá", iconName: "compass-outline" },
    { id: "feed", label: "Nhật ký", iconName: "time-outline" },
    { id: "profile", label: "Cá nhân", iconName: "person-outline" },
]

const SCREEN_WIDTH = Dimensions.get("window").width
const ITEM_WIDTH = SCREEN_WIDTH / 5

interface ZaloBottomNavProps {
    onTabChange?: (tabId: string) => void
    activeTab?: string
}

export default function ZaloBottomNav({ onTabChange, activeTab = "messages" }: ZaloBottomNavProps) {
    const [isKeyboardVisible, setKeyboardVisible] = useState(false)

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setKeyboardVisible(true)
        )
        const keyboardDidHideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardVisible(false)
        )

        return () => {
            keyboardDidHideListener.remove()
            keyboardDidShowListener.remove()
        }
    }, [])

    const handleTabPress = (tabId: string) => {
        onTabChange?.(tabId)
    }

    if (isKeyboardVisible) return null

    return (
        <View style={styles.container}>
            {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id
                return (
                    <TouchableOpacity
                        key={item.id}
                        style={[styles.navItem, { width: ITEM_WIDTH }]}
                        onPress={() => handleTabPress(item.id)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name={item.iconName} size={24} color={isActive ? ZALO_BLUE : INACTIVE_GRAY} style={styles.icon} />
                        <Text style={[styles.label, { color: isActive ? ZALO_BLUE : INACTIVE_GRAY, fontWeight: isActive ? "600" : "500" }]} numberOfLines={1}>
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                )
            })}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        backgroundColor: BACKGROUND_COLOR,
        borderTopWidth: 1,
        borderTopColor: "#F0F0F0",
        paddingBottom: Platform.OS === "android" ? 8 : 4, // Add bottom padding for Android nav bar clearance
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    navItem: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
    },
    icon: {
        marginBottom: 4,
    },
    label: {
        fontSize: 10,
        fontWeight: "500",
    },
})

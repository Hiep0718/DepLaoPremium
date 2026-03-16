"use client"

import { useState } from "react"
import { View, SafeAreaView } from "react-native"
import { ZaloHeader } from "@/components/ZaloHeader"
import ZaloBottomNav from "@/components/ZaloBottomNav"
import { MessagesScreen, type Conversation } from "@/screens/MessagesScreen"
import { ContactsScreen } from "@/screens/ContactsScreen"
import { DiscoverScreen } from "@/screens/DiscoverScreen"
import { TimelineScreen } from "@/screens/TimelineScreen"
import { ProfileScreen } from "@/screens/ProfileScreen"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const [activeTab, setActiveTab] = useState<string>("messages")
  const [selectedMessage, setSelectedMessage] = useState<Conversation | null>(null)

  const renderContent = () => {
    switch (activeTab) {
      case "messages":
        return <MessagesScreen selectedMessage={selectedMessage} onSelectMessage={setSelectedMessage} />
      case "contacts":
        return <ContactsScreen />
      case "discover":
        return <DiscoverScreen />
      case "feed":
        return <TimelineScreen />
      case "profile":
        return <ProfileScreen />
      default:
        return <MessagesScreen selectedMessage={selectedMessage} onSelectMessage={setSelectedMessage} />
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ paddingTop: insets.top }}>
        <ZaloHeader activeTab={activeTab} />
      </View>
      <View style={{ flex: 1, paddingBottom: insets.bottom }}>{renderContent()}</View>
      <View style={{ paddingBottom: insets.bottom }}>
        <ZaloBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </View>
    </SafeAreaView>
  )
}

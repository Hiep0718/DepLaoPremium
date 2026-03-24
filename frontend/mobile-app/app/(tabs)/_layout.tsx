"use client"

import { useState } from "react"
import { View } from "react-native"
import { StatusBar } from "expo-status-bar"
import { ZaloHeader } from "@/components/ZaloHeader"
import ZaloBottomNav from "@/components/ZaloBottomNav"
import { MessagesScreen, type Conversation } from "@/screens/MessagesScreen"
import { ContactsScreen } from "@/screens/ContactsScreen"
import { DiscoverScreen } from "@/screens/DiscoverScreen"
import { TimelineScreen } from "@/screens/TimelineScreen"
import { ProfileScreen } from "@/screens/ProfileScreen"
import { SafeAreaView } from "react-native-safe-area-context"

export default function TabLayout() {
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
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#0068FF" }}>
      <StatusBar style="light" />
      <View style={{ backgroundColor: "#0068FF" }}>
        <ZaloHeader activeTab={activeTab} />
      </View>
      <View style={{ flex: 1, backgroundColor: "#fff" }}>{renderContent()}</View>
      <View style={{ backgroundColor: "#fff" }}>
        <ZaloBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </View>
    </SafeAreaView>
  )
}

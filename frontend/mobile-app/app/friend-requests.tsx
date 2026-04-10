import { Stack } from "expo-router"
import { FriendRequestsScreen } from "@/screens/FriendRequestsScreen"

export default function FriendRequests() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FriendRequestsScreen />
    </>
  )
}

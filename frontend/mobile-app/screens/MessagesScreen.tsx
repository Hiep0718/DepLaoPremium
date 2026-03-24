import { useMemo, useState } from "react"
import { View, Text, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { ZaloColors } from "@/constants/zalo"

export interface Conversation {
  id: string
  name: string
  lastMessage: string
  avatarEmoji: string
  unread: boolean
  time: string
}

interface ChatMessage {
  id: string
  text: string
  time: string
  isOwn: boolean
}

interface MessagesScreenProps {
  selectedMessage: Conversation | null
  onSelectMessage: (message: Conversation | null) => void
}

export function MessagesScreen({ selectedMessage, onSelectMessage }: MessagesScreenProps) {
  const conversations: Conversation[] = useMemo(
    () => [
      { id: "1", name: "Ngân Ngô", lastMessage: "Ok được!", avatarEmoji: "👩", unread: true, time: "10:33" },
      { id: "2", name: "Minh Anh", lastMessage: "Có khỏe không?", avatarEmoji: "👨", unread: false, time: "Hôm qua" },
      { id: "3", name: "Nhóm Dự Án", lastMessage: "Cập nhật: Task hoàn thành ✅", avatarEmoji: "👥", unread: true, time: "09:12" },
      { id: "4", name: "Bố Mẹ", lastMessage: "Tối ăn cơm chưa?", avatarEmoji: "👵", unread: false, time: "T2" },
      { id: "5", name: "Lớp CNTT", lastMessage: "Mai nộp slide nha mọi người", avatarEmoji: "🧑‍💻", unread: false, time: "T2" },
    ],
    []
  )

  const [draft, setDraft] = useState("")

  const chatMessages: ChatMessage[] = useMemo(
    () => [
      { id: "m1", text: "Có khỏe không?", time: "10:30", isOwn: false },
      { id: "m2", text: "Khỏe bình thường 😊", time: "10:32", isOwn: true },
      { id: "m3", text: "Ok được!", time: "10:33", isOwn: false },
      { id: "m4", text: "Chiều mình họp nhóm 15 phút nha", time: "10:34", isOwn: false },
      { id: "m5", text: "Ok mình vào đúng giờ", time: "10:35", isOwn: true },
    ],
    []
  )

  // ---------------- Chat view ----------------
  if (selectedMessage) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.chatHeader}>
          <View style={styles.chatHeaderLeft}>
            <TouchableOpacity onPress={() => onSelectMessage(null)} style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={24} color={ZaloColors.blue} />
            </TouchableOpacity>

            <View style={styles.chatTitleWrap}>
              <Text style={styles.chatTitle} numberOfLines={1}>
                {selectedMessage.name}
              </Text>
              <Text style={styles.chatSubtitle}>Đang hoạt động</Text>
            </View>
          </View>

          <View style={styles.chatHeaderRight}>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="call" size={20} color={ZaloColors.blue} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="videocam" size={20} color={ZaloColors.blue} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="information-circle" size={20} color={ZaloColors.blue} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={chatMessages}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.chatList}
          renderItem={({ item }) => (
            <View style={[styles.bubbleRow, item.isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
              <View style={[styles.bubble, item.isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, item.isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>{item.text}</Text>
                <Text style={[styles.bubbleTime, item.isOwn ? styles.bubbleTimeOwn : styles.bubbleTimeOther]}>{item.time}</Text>
              </View>
            </View>
          )}
        />

        <View style={styles.composer}>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name="add-circle" size={26} color={ZaloColors.blue} />
          </TouchableOpacity>

          <View style={styles.inputWrap}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Tin nhắn…"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              multiline
            />
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="happy-outline" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name="send" size={20} color={ZaloColors.blue} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

  // ---------------- List view ----------------
  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => onSelectMessage(item)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.avatarEmoji}</Text>
      </View>

      <View style={styles.rowMid}>
        <View style={styles.rowTopLine}>
          <Text style={[styles.rowName, item.unread && { fontWeight: "800" }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.rowTime, item.unread && { color: ZaloColors.text, fontWeight: "600" }]}>{item.time}</Text>
        </View>
        <View style={styles.rowBottomLine}>
          <Text style={[styles.rowLastMsg, item.unread && { color: ZaloColors.text, fontWeight: "600" }]} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {item.unread && <View style={styles.dot} />}
        </View>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.flex}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Tin nhắn</Text>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="list" size={20} color={ZaloColors.subText} />
        </TouchableOpacity>
      </View>

      <FlatList data={conversations} keyExtractor={(i) => i.id} renderItem={renderConversation} />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: ZaloColors.bg },

  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ZaloColors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listTitle: { fontSize: 20, fontWeight: "800", color: ZaloColors.text },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: ZaloColors.bg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E8F0FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { fontSize: 24 },

  rowMid: { flex: 1 },
  rowTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowName: { fontSize: 15, fontWeight: "700", color: ZaloColors.text, flex: 1, marginRight: 10 },
  rowTime: { fontSize: 12, color: ZaloColors.subText },

  rowBottomLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  rowLastMsg: { fontSize: 13, color: ZaloColors.subText, flex: 1, marginRight: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: ZaloColors.danger },

  chatHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: ZaloColors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: ZaloColors.bg,
  },
  chatHeaderLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  chatTitleWrap: { marginLeft: 6, flex: 1 },
  chatTitle: { fontSize: 16, fontWeight: "800", color: ZaloColors.text },
  chatSubtitle: { fontSize: 12, color: ZaloColors.subText, marginTop: 2 },
  chatHeaderRight: { flexDirection: "row", alignItems: "center", gap: 2 },

  iconBtn: { padding: 6 },

  chatList: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: ZaloColors.bgAlt },
  bubbleRow: { marginVertical: 6, flexDirection: "row" },
  bubbleRowOwn: { justifyContent: "flex-end" },
  bubbleRowOther: { justifyContent: "flex-start" },
  bubble: { maxWidth: "78%", borderRadius: 14, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  bubbleOwn: { backgroundColor: ZaloColors.blue, borderTopRightRadius: 6 },
  bubbleOther: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 6, borderWidth: 1, borderColor: "#EEF2F7" },
  bubbleText: { fontSize: 14, lineHeight: 19 },
  bubbleTextOwn: { color: "#FFFFFF" },
  bubbleTextOther: { color: ZaloColors.text },
  bubbleTime: { fontSize: 11, marginTop: 6 },
  bubbleTimeOwn: { color: "#E5E7EB", textAlign: "right" },
  bubbleTimeOther: { color: "#9CA3AF", textAlign: "left" },

  composer: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: ZaloColors.line,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    backgroundColor: ZaloColors.bg,
  },
  inputWrap: {
    flex: 1,
    minHeight: 40,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  input: { flex: 1, fontSize: 14, color: ZaloColors.text, padding: 0, margin: 0, maxHeight: 96 },
})

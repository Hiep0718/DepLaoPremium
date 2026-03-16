import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"

interface Group {
  id: string
  name: string
  lastMessage: string
  time: string
  avatar: string
}

const groups: Group[] = [
  {
    id: "1",
    name: "CÔNG NGHỆ MỚI",
    lastMessage: "dự kiến tuần sau mình kết thúc môn...",
    time: "1 giờ",
    avatar: "https://i.pravatar.cc/150?img=1",
  },
  {
    id: "2",
    name: "Bạn tao đéo tới 💀💀💀",
    lastMessage: "Tội tay trời",
    time: "6 giờ",
    avatar: "https://i.pravatar.cc/150?img=2",
  },
  {
    id: "3",
    name: "Big Data ❌❌❌",
    lastMessage: "Hiền đã đổi ảnh đại diện nhóm",
    time: "9 giờ",
    avatar: "https://i.pravatar.cc/150?img=3",
  },
  {
    id: "4",
    name: "QLDACNTT Lò Nhóm 4",
    lastMessage: "[Link] Folder để upload bài thuyết...",
    time: "9 giờ",
    avatar: "https://i.pravatar.cc/150?img=4",
  },
]

export function GroupsScreen() {
  const renderItem = ({ item }: { item: Group }) => (
    <TouchableOpacity style={styles.row}>
      <Image source={{ uri: item.avatar }} style={styles.avatar} />

      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.message} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>

      <Text style={styles.time}>{item.time}</Text>
    </TouchableOpacity>
  )

  return (
    <View style={{ flex: 1, backgroundColor: "#f2f2f2" }}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="search-outline" size={22} color="#fff" />
        <TextInput
          placeholder="Tìm kiếm"
          placeholderTextColor="#d0e6ff"
          style={styles.search}
        />
        <Ionicons name="person-add-outline" size={24} color="#fff" />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Text style={styles.tab}>Bạn bè</Text>
        <Text style={styles.tabActive}>Nhóm</Text>
        <Text style={styles.tab}>OA</Text>
      </View>

      {/* Create group */}
      <TouchableOpacity style={styles.createRow}>
        <View style={styles.createIcon}>
          <Ionicons name="people-outline" size={26} color="#1e88e5" />
        </View>
        <Text style={styles.createText}>Tạo nhóm mới</Text>
      </TouchableOpacity>

      {/* Title */}
      <Text style={styles.section}>Nhóm đang tham gia (106)</Text>

      <FlatList data={groups} renderItem={renderItem} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#1e88e5",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  search: {
    flex: 1,
    color: "#fff",
  },
  tabs: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    paddingVertical: 10,
  },
  tab: {
    color: "#777",
  },
  tabActive: {
    color: "#1e88e5",
    fontWeight: "600",
    borderBottomWidth: 2,
    borderBottomColor: "#1e88e5",
    paddingBottom: 4,
  },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    marginTop: 8,
  },
  createIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e3f2fd",
    justifyContent: "center",
    alignItems: "center",
  },
  createText: {
    marginLeft: 12,
    fontSize: 16,
  },
  section: {
    marginTop: 10,
    marginLeft: 16,
    fontWeight: "600",
    color: "#555",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
  },
  message: {
    color: "#777",
    marginTop: 2,
  },
  time: {
    fontSize: 12,
    color: "#999",
  },
})

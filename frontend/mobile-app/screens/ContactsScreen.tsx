import { useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { ZaloColors } from "@/constants/zalo"

type Tab = "friends" | "groups" | "oa"

export function ContactsScreen() {
  const [tab, setTab] = useState<Tab>("friends")

  return (
    <View style={{ flex: 1, backgroundColor: "#f2f2f2" }}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {["friends", "groups", "oa"].map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t as Tab)}>
            <Text style={tab === t ? styles.tabActive : styles.tab}>
              {t === "friends" ? "Bạn bè" : t === "groups" ? "Nhóm" : "OA"}
            </Text>
            {tab === t && <View style={styles.indicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {tab === "friends" && <Friends />}
      {tab === "groups" && <Groups />}
      {tab === "oa" && <OA />}
    </View>
  )
}

/* ------------------ FRIENDS ------------------ */

function Friends() {
  const data = ["Ngọc Đăng", "Thanh Hiệp", "Viết Hiếu", "Văn Khang"]

  return (
    <View>
      <View style={styles.quickBox}>
        <Item icon="person-add-outline" color={ZaloColors.blue} text="Lời mời kết bạn (7)" />
        <Item icon="gift-outline" color="#ff7043" text="Sinh nhật" />
      </View>

      <Text style={styles.section}>A</Text>

      {data.map((name, i) => (
        <Row key={i} name={name} />
      ))}
    </View>
  )
}

/* ------------------ GROUPS ------------------ */

function Groups() {
  const groups = [
    {
      name: "CÔNG NGHỆ MỚI",
      msg: "Dự kiến tuần sau mình kết thúc môn...",
      time: "1 giờ",
    },
    {
      name: "Bạn tao đéo tới 💀💀",
      msg: "Tội vậy trời",
      time: "6 giờ",
    },
    {
      name: "Big Data ❌❌❌",
      msg: "Hiền đã đổi ảnh đại diện nhóm",
      time: "9 giờ",
    },
  ]

  return (
    <View>
      <View style={styles.createGroup}>
        <View style={styles.createIcon}>
          <Ionicons name="people-outline" size={26} color={ZaloColors.blue} />
        </View>
        <Text style={{ fontSize: 16 }}>Tạo nhóm mới</Text>
      </View>

      <View style={styles.groupHeader}>
        <Text style={{ fontWeight: "600" }}>Nhóm đang tham gia (106)</Text>
        <Text style={{ color: "#888" }}>⇅ Sắp xếp</Text>
      </View>

      {groups.map((g, i) => (
        <View key={i} style={styles.groupRow}>
          <View style={styles.avatar}>
            <Ionicons name="people" size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "600" }}>{g.name}</Text>
            <Text style={{ color: "#666" }}>{g.msg}</Text>
          </View>
          <Text style={{ color: "#999" }}>{g.time}</Text>
        </View>
      ))}
    </View>
  )
}

/* ------------------ OA ------------------ */

function OA() {
  const oa = [
    "Acecook Việt Nam",
    "Báo Mới",
    "Cộng đồng Cờ Tướng Zagoo",
    "Cộng đồng Game Online",
    "Cổng Game Zalo",
  ]

  return (
    <View>
      <View style={styles.findOA}>
        <View style={styles.findIcon}>
          <Ionicons name="radio-outline" size={26} color="#fff" />
        </View>
        <Text style={{ fontSize: 16 }}>Tìm thêm Official Account</Text>
      </View>

      <Text style={styles.section}>Official Account đã quan tâm</Text>

      {oa.map((name, i) => (
        <View key={i} style={styles.oaRow}>
          <View style={styles.avatar}>
            <Ionicons name="business" size={22} color="#fff" />
          </View>
          <Text style={{ flex: 1 }}>{name}</Text>
          <Ionicons name="checkmark-circle" size={18} color="#f6a623" />
        </View>
      ))}
    </View>
  )
}

/* ------------------ COMPONENTS ------------------ */

function Item({ icon, color, text }: any) {
  return (
    <View style={styles.quickItem}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={{ marginLeft: 12 }}>{text}</Text>
    </View>
  )
}

function Row({ name }: { name: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={28} color="#fff" style={{ marginTop: 6 }} />
      </View>

      <Text style={{ flex: 1 }}>{name}</Text>

      {/* Nút gọi */}
      <TouchableOpacity
        style={styles.callBtn}
        onPress={() => console.log("Gọi cho", name)}
      >
        <Ionicons name="call-outline" size={22} color="#1a1a1a" />
      </TouchableOpacity>

      {/* Nút gọi video */}
      <TouchableOpacity
        style={styles.callBtn}
        onPress={() => console.log("Gọi video cho", name)}
      >
        <Ionicons name="videocam-outline" size={22} color="#1a1a1a" />
      </TouchableOpacity>
    </View>
  )
}

/* ------------------ STYLES ------------------ */

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    paddingVertical: 10,
  },
  tab: { color: ZaloColors.subText },
  tabActive: { color: ZaloColors.text, fontWeight: "600" },
  indicator: {
    height: 2,
    backgroundColor: ZaloColors.blue,
    marginTop: 6,
  },

  quickBox: { backgroundColor: "#fff" },
  quickItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  section: { margin: 12, fontWeight: "600", color: "#888" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#d1d1d1",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden"
  },

  callBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  createGroup: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  createIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e3f2fd",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },

  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  findOA: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
  },
  findIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#7b2ff7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  oaRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
})

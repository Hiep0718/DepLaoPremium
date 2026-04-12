import { useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Image
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useFocusEffect } from "@react-navigation/native"
import { useCallback, useEffect } from "react"
import apiClient from "@/constants/api"
import { useSocket } from "@/contexts/SocketContext"
import { ZaloColors } from "@/constants/zalo"
import CreateGroupModal from "@/components/CreateGroupModal"

type Tab = "friends" | "groups" | "oa"

export function ContactsScreen() {
  const [tab, setTab] = useState<Tab>("friends")
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    // Cập nhật key để ép các component con (Friends, Groups, OA) render lại và gọi lại API
    setRefreshKey(prev => prev + 1)
    setTimeout(() => {
      setRefreshing(false)
    }, 1000)
  }, [])

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

      <ScrollView 
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ZaloColors.blue]} />}
      >
        {tab === "friends" && <Friends key={`friends-${refreshKey}`} />}
        {tab === "groups" && <Groups key={`groups-${refreshKey}`} />}
        {tab === "oa" && <OA key={`oa-${refreshKey}`} />}
      </ScrollView>
    </View>
  )
}

/* ------------------ FRIENDS ------------------ */

function Friends() {
  const router = useRouter()
  const { socket } = useSocket()
  const [contacts, setContacts] = useState<any[]>([])
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  const fetchData = async () => {
    try {
      const [pendingRes, contactsRes] = await Promise.all([
        apiClient.get('/contacts/requests/pending'),
        apiClient.get('/contacts')
      ])
      
      setPendingCount(pendingRes.data?.data?.totalElements || 0)
      setContacts(contactsRes.data?.data?.content || [])
    } catch (error) {
      console.log("Error fetching contacts data:", error)
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchData()
    }, [])
  )

  useEffect(() => {
    if (!socket) return;
    
    const handleFriendAction = (data: any) => {
      // Whenever a friend request is sent to us, or accepted, reload lists
      fetchData()
    }

    socket.on('friend_action_received', handleFriendAction)
    
    return () => {
      socket.off('friend_action_received', handleFriendAction)
    }
  }, [socket])

  // Phân nhóm bạn bè theo chữ cái đầu giống Web App
  const groupedContacts = contacts.reduce((acc, contact) => {
    const name = contact.nickname || contact.fullName || '?';
    const letter = name.charAt(0).toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(contact);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedLetters = Object.keys(groupedContacts).sort();

  return (
    <View>
      <View style={styles.quickBox}>
        <TouchableOpacity onPress={() => router.push("/friend-requests")}>
          <Item 
            icon="person-add-outline" 
            color={ZaloColors.blue} 
            text="Lời mời kết bạn"
            badgeCount={pendingCount} 
          />
        </TouchableOpacity>
        <Item icon="gift-outline" color="#ff7043" text="Sinh nhật" />
      </View>

      {contacts.length === 0 && !loading && (
        <View style={{ padding: 30, alignItems: 'center' }}>
          <Text style={{ color: '#888' }}>Bạn chưa có bạn bè nào.</Text>
        </View>
      )}

      {sortedLetters.map(letter => (
        <View key={letter}>
          <Text style={styles.section}>{letter}</Text>
          {groupedContacts[letter].map((c: any) => (
            <Row 
               key={c.id} 
               name={c.nickname || c.fullName} 
               avatarUrl={c.avatarUrl} 
               onPress={async () => {
                 const targetUserId = c.contactUserId || c.id;
                 if (!currentUserId || !targetUserId) return;
                 const ids = [currentUserId.toString(), targetUserId.toString()].sort();
                 const convId = `1to1_${ids[0]}_${ids[1]}`;
                 try {
                     const { chatApiClient } = await import('@/constants/chatApi');
                     await chatApiClient.post('/conversation', {
                         conversationId: convId,
                         participants: [currentUserId.toString(), targetUserId.toString()],
                         isGroup: false
                     });
                     router.push({
                         pathname: "/chat/[id]",
                         params: {
                             id: convId,
                             name: c.nickname || c.fullName,
                             recipientId: targetUserId.toString(),
                             avatar: c.avatarUrl || ""
                         }
                     });
                 } catch (error) {
                     console.error("Failed to start conversation", error);
                 }
               }}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

/* ------------------ GROUPS ------------------ */

function Groups() {
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const { currentUserId, socket } = useSocket();
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);

  const fetchGroups = async () => {
    if (!currentUserId) return;
    try {
      const { chatApiClient } = await import('@/constants/chatApi');
      const res = await chatApiClient.get(`/conversations/${currentUserId}`);
      const allConvs = res.data?.data || [];
      const groupConvs = allConvs.filter((c: any) => c.isGroup);
      setGroups(groupConvs);
    } catch (err) {
      console.log('Error fetching groups', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, [currentUserId])
  );

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchGroups();
    socket.on('receive_message', handleUpdate);
    socket.on('message_sent', handleUpdate);
    return () => {
      socket.off('receive_message', handleUpdate);
      socket.off('message_sent', handleUpdate);
    };
  }, [socket]);

  return (
    <View>
      <TouchableOpacity style={styles.createGroup} onPress={() => setShowCreateGroupModal(true)} activeOpacity={0.7}>
        <View style={styles.createIcon}>
          <Ionicons name="people-outline" size={26} color={ZaloColors.blue} />
        </View>
        <Text style={{ fontSize: 16 }}>Tạo nhóm mới</Text>
      </TouchableOpacity>

      <View style={styles.groupHeader}>
        <Text style={{ fontWeight: "600" }}>Nhóm đang tham gia ({groups.length})</Text>
        <Text style={{ color: "#888" }}>⇅ Sắp xếp</Text>
      </View>

      {groups.length === 0 ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ color: '#888' }}>Bạn chưa tham gia nhóm nào</Text>
        </View>
      ) : (
        groups.map((g, i) => (
          <TouchableOpacity 
            key={g.conversationId || i} 
            style={styles.groupRow}
            onPress={() => {
              router.push({
                pathname: "/chat/[id]",
                params: {
                  id: g.conversationId,
                  name: g.groupName || 'Nhóm',
                  recipientId: "",
                  avatar: ""
                }
              });
            }}
          >
            <View style={[styles.avatar, { backgroundColor: '#e1bee7' }]}>
              <Ionicons name="people" size={24} color="#8e24aa" />
            </View>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontWeight: "600", fontSize: 16 }} numberOfLines={1}>{g.groupName || 'Nhóm'}</Text>
              <Text style={{ color: "#666", marginTop: 2 }} numberOfLines={1}>
                {g.lastMessage?.content || 'Chưa có tin nhắn'}
              </Text>
            </View>
            <Text style={{ color: "#999", fontSize: 12 }}>
              {g.lastMessage?.timestamp 
                ? new Date(g.lastMessage.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                : ''}
            </Text>
          </TouchableOpacity>
        ))
      )}

      <CreateGroupModal 
        visible={showCreateGroupModal} 
        onClose={() => {
          setShowCreateGroupModal(false);
          fetchGroups(); // refresh groups after modal closes
        }} 
      />
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

function Item({ icon, color, text, badgeCount }: any) {
  return (
    <View style={styles.quickItem}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={{ marginLeft: 12, flex: 1 }}>{text}</Text>
      {badgeCount > 0 && (
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      )}
    </View>
  )
}

function Row({ name, avatarUrl, onPress }: { name: string; avatarUrl?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.avatar}>
        {avatarUrl ? (
           <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
        ) : (
           <Ionicons name="person" size={28} color="#fff" style={{ marginTop: 6 }} />
        )}
      </View>

      <Text style={{ flex: 1, fontWeight: '500' }}>{name}</Text>

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
    </TouchableOpacity>
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
  badgeContainer: {
    backgroundColor: '#ff3b30',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  FlatList, TextInput, Image, ActivityIndicator, Dimensions, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ZaloColors } from '@/constants/zalo';
import { useSocket } from '@/contexts/SocketContext';
import { chatApiClient } from '@/constants/chatApi';
import apiClient from '@/constants/api';

interface Contact {
  id: string; // fallback
  contactUserId: string;
  fullName: string;
  avatarUrl?: string;
  phone: string;
}

interface AddMemberModalProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  onConfirm: (userIds: string[]) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AddMemberModal({ visible, onClose, conversationId, onConfirm }: AddMemberModalProps) {
  const { currentUserId } = useSocket();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [existingMemberIds, setExistingMemberIds] = useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Initialization: load contacts and existing members
  useEffect(() => {
    if (!visible || !currentUserId) return;

    // Reset state
    setSearchTerm('');
    setSelectedUserIds(new Set());

    const initData = async () => {
      setIsLoading(true);
      try {
        // 1. Load contacts (with size=100 to get all friends, matching web app)
        let contactsData: Contact[] = [];
        try {
          const resContacts = await apiClient.get('/contacts?page=0&size=100');
          contactsData = resContacts.data?.data?.content || [];
        } catch (err) {
          console.log('Error loading contacts:', err);
        }

        // 2. Load conversation to find existing members
        const existingIds = new Set<string>();
        try {
          const resConversations = await chatApiClient.get(`/conversations/${currentUserId}`);
          // API returns { success: true, data: [...conversations] }
          const conversationsRaw = resConversations.data?.data || resConversations.data;
          const conversations = Array.isArray(conversationsRaw) ? conversationsRaw : [];
          const currentConv = conversations.find((c: any) => c.conversationId === conversationId);

          if (currentConv && currentConv.participants) {
            currentConv.participants.forEach((p: any) => {
              // participants are objects with { userId: "...", role: "..." }
              const pid = typeof p === 'string' ? p : String(p.userId || p.id || '');
              if (pid && pid !== 'undefined') {
                existingIds.add(pid);
              }
            });
          }
        } catch (err) {
          console.log('Error loading conversation members:', err);
        }
        setExistingMemberIds(existingIds);

        // Remove existing members from contacts list
        const validContacts = contactsData.filter((c: Contact) => {
          const uid = String(c.contactUserId || c.id);
          return !existingIds.has(uid);
        });
        setContacts(validContacts);
        setFilteredContacts(validContacts);

      } catch (err) {
        console.log('Error init AddMemberModal:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, [visible, currentUserId, conversationId]);

  // Handle Search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredContacts(contacts);
      return;
    }
    const lower = searchTerm.toLowerCase();
    const filtered = contacts.filter((c) => {
      const name = (c.fullName || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      return name.includes(lower) || phone.includes(lower);
    });
    setFilteredContacts(filtered);
  }, [searchTerm, contacts]);

  const toggleSelectUser = (user: Contact) => {
    const uid = String(user.contactUserId || user.id);
    if (!uid) return;

    setSelectedUserIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(uid)) {
        newSet.delete(uid);
      } else {
        newSet.add(uid);
      }
      return newSet;
    });
  };

  const handleConfirm = async () => {
    if (!currentUserId || selectedUserIds.size === 0) return;

    setIsAdding(true);
    try {
      await onConfirm(Array.from(selectedUserIds));
      onClose();
    } catch (error) {
      console.log('Error confirm AddMemberModal:', error);
      Alert.alert('Lỗi', 'Thêm thành viên thất bại.');
    } finally {
      setIsAdding(false);
    }
  };

  const selectedUsersList = contacts.filter((c) => selectedUserIds.has(String(c.contactUserId || c.id)));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
            <Text style={{ fontSize: 16, color: '#000' }}>Hủy</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thêm thành viên</Text>
          <TouchableOpacity
            style={[styles.headerBtn, { alignItems: 'flex-end' }]}
            onPress={handleConfirm}
            disabled={selectedUserIds.size === 0 || isAdding}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color={ZaloColors.blue} />
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: selectedUserIds.size > 0 ? ZaloColors.blue : '#999'
                }}
              >
                Xong
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* SEARCH BOX */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#888" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm tên hoặc số điện thoại"
            placeholderTextColor="#888"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        {/* SELECTED USERS PREVIEW BAR */}
        {selectedUsersList.length > 0 && (
          <View style={styles.selectedBar}>
            <FlatList
              horizontal
              data={selectedUsersList}
              keyExtractor={(item) => String(item.contactUserId || item.id)}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const name = item.fullName || '?';
                return (
                  <TouchableOpacity
                    style={styles.selectedAvatarWrap}
                    onPress={() => toggleSelectUser(item)}
                  >
                    {item.avatarUrl ? (
                      <Image source={{ uri: item.avatarUrl }} style={styles.selectedAvatar} />
                    ) : (
                      <View style={[styles.selectedAvatar, styles.defaultAvatar]}>
                        <Text style={styles.firstLetter}>{name.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.removeIconWrap}>
                      <Ionicons name="close-circle" size={16} color="#444" />
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        <View style={styles.listHeaderRow}>
          <Text style={styles.listSectionTitle}>Danh bạ (chưa tham gia)</Text>
          <Text style={styles.selectedCountText}>Đã chọn: {selectedUserIds.size}</Text>
        </View>

        {/* CONTACTS LIST */}
        <View style={styles.listContainer}>
          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color={ZaloColors.blue} />
          ) : filteredContacts.length === 0 ? (
            <Text style={styles.emptyText}>Không có bạn bè khả dụng</Text>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => String(item.contactUserId || item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const uid = String(item.contactUserId || item.id);
                const isSelected = selectedUserIds.has(uid);
                const name = item.fullName || '?';

                return (
                  <TouchableOpacity
                    style={styles.contactRow}
                    activeOpacity={0.7}
                    onPress={() => toggleSelectUser(item)}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                      {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>

                    {item.avatarUrl ? (
                      <Image source={{ uri: item.avatarUrl }} style={styles.contactAvatar} />
                    ) : (
                      <View style={[styles.contactAvatar, styles.defaultAvatar]}>
                        <Text style={styles.firstLetter}>{name.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}

                    <Text style={styles.contactName} numberOfLines={1}>{name}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50, // SafeArea roughly
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  headerBtn: {
    width: 60,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
    color: '#000',
  },
  selectedBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedAvatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  selectedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  removeIconWrap: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fafafa',
    borderRadius: 10,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  listSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  selectedCountText: {
    fontSize: 14,
    color: ZaloColors.blue,
    fontWeight: '500',
  },
  listContainer: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 30,
    color: '#888',
    fontSize: 15,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f3f3',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#c0c0c0',
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: ZaloColors.blue,
    borderColor: ZaloColors.blue,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  defaultAvatar: {
    backgroundColor: '#0068FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  firstLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactName: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
});

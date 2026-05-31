import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  FlatList, TextInput, Image, ActivityIndicator, Dimensions, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ZaloColors } from '@/constants/zalo';
import { useSocket } from '@/contexts/SocketContext';
import { chatApiClient } from '@/constants/chatApi';
import apiClient from '@/constants/api';

interface Contact {
  id: string; // fallback
  contactUserId: string;
  fullName: string;
  nickname?: string;
  avatarUrl?: string;
  phone: string;
}

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CreateGroupModal({ visible, onClose }: CreateGroupModalProps) {
  const router = useRouter();
  const { socket, currentUserId } = useSocket();
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [groupName, setGroupName] = useState('');
  
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Load contacts
  useEffect(() => {
    if (!visible) return;
    
    const loadContacts = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get('/contacts');
        const data = res.data?.data?.content || [];
        setContacts(data);
        setFilteredContacts(data);
      } catch (err) {
        console.log('Error loading contacts for group creation', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadContacts();
  }, [visible]);

  // Reset state when closing/opening
  useEffect(() => {
    if (visible) {
      setSearchTerm('');
      setGroupName('');
      setSelectedUserIds(new Set());
    }
  }, [visible]);

  // Handle Search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredContacts(contacts);
      return;
    }
    const lower = searchTerm.toLowerCase();
    const filtered = contacts.filter((c) => {
      const name = (c.nickname || c.fullName || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      return name.includes(lower) || phone.includes(lower);
    });
    setFilteredContacts(filtered);
  }, [searchTerm, contacts]);

  const toggleSelectUser = (user: Contact) => {
    const uid = user.contactUserId || user.id;
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

  const handleCreateGroup = async () => {
    if (!currentUserId) return;
    if (selectedUserIds.size < 2) {
      Alert.alert('Thông báo', 'Cần chọn ít nhất 2 người để tạo nhóm.');
      return;
    }
    if (!groupName.trim()) {
      Alert.alert('Thông báo', 'Vui lòng đặt tên cho nhóm.');
      return;
    }

    setIsCreating(true);
    try {
      // conversationId format: group_timestamp_creatorId
      const convId = `group_${Date.now()}_${currentUserId}`;
      const participants = [currentUserId.toString(), ...Array.from(selectedUserIds)];

      const res = await chatApiClient.post('/conversation', {
        conversationId: convId,
        participants,
        isGroup: true,
        groupName: groupName.trim()
      });



      // Navigate to chat
      router.push({
        pathname: "/chat/[id]",
        params: {
          id: convId,
          name: groupName.trim(),
          recipientId: "", // Nhóm thì không có recipientId cụ thể
          avatar: ""
        }
      });
      // Đóng modal sau
      setTimeout(() => {
        onClose();
      }, 100);
      
    } catch (err: any) {
      console.log('Error creating group:', err);
      Alert.alert('Lỗi', 'Tạo nhóm thất bại. Vui lòng thử lại sau.');
    } finally {
      setIsCreating(false);
    }
  };

  const selectedUsersList = contacts.filter((c) => selectedUserIds.has(c.contactUserId || c.id));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
            <Text style={{ fontSize: 16, color: '#000' }}>Hủy</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tạo nhóm mới</Text>
          <TouchableOpacity 
            style={[styles.headerBtn, { alignItems: 'flex-end' }]} 
            onPress={handleCreateGroup}
            disabled={selectedUserIds.size < 2 || isCreating}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color={ZaloColors.blue} />
            ) : (
              <Text 
                style={{ 
                  fontSize: 16, 
                  fontWeight: '600', 
                  color: selectedUserIds.size >= 2 ? ZaloColors.blue : '#999' 
                }}
              >
                Tạo
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* TOP SECTION: Group Name Input */}
        <View style={styles.topSection}>
          <View style={styles.avatarPickerPlaceholder}>
            <Ionicons name="camera-outline" size={24} color="#888" />
          </View>
          <TextInput 
            style={styles.nameInput}
            placeholder="Đặt tên nhóm"
            placeholderTextColor="#999"
            value={groupName}
            onChangeText={setGroupName}
            maxLength={100}
          />
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
              keyExtractor={(item) => item.contactUserId || item.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const name = item.nickname || item.fullName || '?';
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
          <Text style={styles.listSectionTitle}>Danh bạ</Text>
          <Text style={styles.selectedCountText}>Đã chọn: {selectedUserIds.size}</Text>
        </View>

        {/* CONTACTS LIST */}
        <View style={styles.listContainer}>
          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color={ZaloColors.blue} />
          ) : filteredContacts.length === 0 ? (
            <Text style={styles.emptyText}>Không tìm thấy bạn bè nào</Text>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.contactUserId || item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const uid = item.contactUserId || item.id;
                const isSelected = selectedUserIds.has(uid);
                const name = item.nickname || item.fullName || '?';

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
  
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarPickerPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e6e6e6',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    padding: 0,
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

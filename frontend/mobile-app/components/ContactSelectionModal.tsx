import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Modal, ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/constants/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Contact {
  id: number;
  contactUserId: number;
  phone: string;
  fullName: string;
  avatarUrl: string;
  nickname: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface ContactSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (contact: Contact) => void;
}

const ContactSelectionModal = ({ visible, onClose, onSelect }: ContactSelectionModalProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      const fetchContacts = async () => {
        setLoading(true);
        try {
          const res = await apiClient.get('/contacts?page=0&size=100');
          const data = res.data?.data?.content || res.data?.data || [];
          setContacts(data);
        } catch (error) {
          console.log('Failed to load contacts for contact card', error);
        } finally {
          setLoading(false);
        }
      };
      fetchContacts();
      setSearchTerm('');
    }
  }, [visible]);

  const filteredContacts = contacts.filter(c => {
    const displayName = c.nickname || c.fullName || '';
    return displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           c.phone?.includes(searchTerm);
  });

  const renderContact = useCallback(({ item }: { item: Contact }) => {
    const displayName = item.nickname || item.fullName || 'Người dùng';
    const avatar = item.avatarUrl;

    return (
      <TouchableOpacity
        style={styles.contactItem}
        activeOpacity={0.7}
        onPress={() => {
          onSelect(item);
          onClose();
        }}
      >
        <View style={styles.contactLeft}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.contactAvatar} />
          ) : (
            <View style={styles.contactAvatarDefault}>
              <Text style={styles.contactAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.contactInfo}>
            <Text style={styles.contactName} numberOfLines={1}>{displayName}</Text>
            {item.phone ? (
              <Text style={styles.contactPhone} numberOfLines={1}>{item.phone}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.sendBtnSmall}>
          <Text style={styles.sendBtnSmallText}>Gửi</Text>
        </View>
      </TouchableOpacity>
    );
  }, [onSelect, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Gửi danh thiếp</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm bạn bè..."
              placeholderTextColor="#999"
              value={searchTerm}
              onChangeText={setSearchTerm}
              autoCorrect={false}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <Ionicons name="close-circle" size={18} color="#ccc" />
              </TouchableOpacity>
            )}
          </View>

          {/* Contact List */}
          {loading ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator size="large" color="#0068FF" />
              <Text style={styles.loadingText}>Đang tải danh bạ...</Text>
            </View>
          ) : filteredContacts.length === 0 ? (
            <View style={styles.centerWrap}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                {searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có bạn bè'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => String(item.contactUserId || item.id)}
              renderItem={renderContact}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    minHeight: '50%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  closeBtn: {
    padding: 4,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#222',
    paddingVertical: 2,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 34,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  contactAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  contactAvatarDefault: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0068FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  contactInfo: {
    marginLeft: 12,
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 13,
    color: '#888',
  },
  sendBtnSmall: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,104,255,0.1)',
  },
  sendBtnSmallText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0068FF',
  },
});

export default ContactSelectionModal;

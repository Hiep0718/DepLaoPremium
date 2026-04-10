import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  FlatList, TextInput, Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ZaloColors } from '@/constants/zalo';
import { useSocket } from '@/contexts/SocketContext';
import { chatApiClient } from '@/constants/chatApi';
import apiClient from '@/constants/api';

interface ForwardMessage {
  _id: string;
  content: string;
  messageType?: string;
  fileUrl?: string;
}

interface Conversation {
  conversationId: string;
  participants: { userId: string }[];
  isGroup: boolean;
  groupName?: string;
  otherUser?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
}

interface ForwardModalProps {
  visible: boolean;
  message: ForwardMessage | null;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ForwardModal({ visible, message, onClose }: ForwardModalProps) {
  const { socket, currentUserId } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  // Load danh sách cuộc trò chuyện khi modal mở
  useEffect(() => {
    if (!visible || !currentUserId) return;
    const loadConversations = async () => {
      setIsLoading(true);
      try {
        const res = await chatApiClient.get(`/conversations/${currentUserId}`);
        let convs: Conversation[] = res.data?.data || [];

        // Enrich: lấy tên & avatar cho mỗi cuộc hội thoại 1-1
        const enriched = await Promise.all(
          convs.map(async (conv) => {
            if (!conv.isGroup) {
              const otherUserId = conv.participants.find(
                (p) => p.userId !== currentUserId
              )?.userId;
              if (otherUserId) {
                try {
                  const userRes = await apiClient.get(`/users/${otherUserId}`);
                  conv.otherUser = userRes.data?.data;
                } catch {
                  conv.otherUser = { id: otherUserId, fullName: 'Người dùng Zalo' };
                }
              }
            }
            return conv;
          })
        );

        setConversations(enriched);
      } catch (err) {
        console.log('Error loading conversations for forward', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadConversations();
  }, [visible, currentUserId]);

  // Reset khi đóng
  useEffect(() => {
    if (!visible) {
      setSearchTerm('');
      setSendingTo(null);
    }
  }, [visible]);

  const getDisplayName = (conv: Conversation) => {
    if (conv.isGroup) return conv.groupName || 'Nhóm';
    return conv.otherUser?.fullName || 'Người dùng';
  };

  const getAvatar = (conv: Conversation) => {
    return conv.otherUser?.avatarUrl;
  };

  const getMessagePreview = () => {
    if (!message) return '';
    if (message.messageType === 'sticker') return '[Nhãn dán]';
    if (message.messageType === 'image') return '[Hình ảnh]';
    if (message.messageType === 'video') return '[Video]';
    if (message.messageType === 'file') return '[Tệp]';
    if (message.messageType === 'audio') return '[Tin nhắn thoại]';
    if (message.messageType === 'contact') return '[Danh thiếp]';
    return message.content || '';
  };

  const handleForward = useCallback(async (conv: Conversation) => {
    if (!socket || !currentUserId || !message) return;

    setSendingTo(conv.conversationId);

    const recipientId = conv.participants.find(
      (p) => p.userId !== currentUserId
    )?.userId;

    const messagePayload = {
      conversationId: conv.conversationId,
      senderId: currentUserId,
      recipientId: recipientId,
      text: message.messageType === 'sticker' ? '[Nhãn dán]'
        : message.messageType === 'contact' ? '[Danh thiếp]'
        : message.content,
      messageType: message.messageType || 'text',
      fileUrl: message.fileUrl,
    };

    socket.emit('send_message', messagePayload);

    // Delay để hiện trạng thái "Đang gửi..."
    setTimeout(() => {
      setSendingTo(null);
      onClose();
    }, 500);
  }, [socket, currentUserId, message, onClose]);

  const filteredConversations = conversations.filter((conv) => {
    const name = getDisplayName(conv);
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const renderConversation = ({ item }: { item: Conversation }) => {
    const name = getDisplayName(item);
    const avatarUri = getAvatar(item);
    const isSending = sendingTo === item.conversationId;

    return (
      <View style={s.convRow}>
        <View style={s.convLeft}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={s.convAvatar} />
          ) : (
            <View style={[s.convAvatar, s.convAvatarDefault]}>
              <Text style={s.convAvatarLetter}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={s.convName} numberOfLines={1}>{name}</Text>
        </View>
        <TouchableOpacity
          style={[s.sendButton, isSending && s.sendButtonDisabled]}
          onPress={() => handleForward(item)}
          disabled={isSending}
          activeOpacity={0.7}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.sendButtonText}>Gửi</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.container}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Chuyển tiếp tin nhắn</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Message Preview */}
          <View style={s.previewRow}>
            <View style={s.previewBorder} />
            <Text style={s.previewText} numberOfLines={2}>
              {getMessagePreview()}
            </Text>
          </View>

          {/* Search */}
          <View style={s.searchRow}>
            <Ionicons name="search" size={18} color="#999" style={{ marginRight: 8 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Tìm kiếm trò chuyện..."
              placeholderTextColor="#999"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>

          {/* Conversation List */}
          {isLoading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={ZaloColors.blue} />
            </View>
          ) : (
            <FlatList
              data={filteredConversations}
              keyExtractor={(item) => item.conversationId}
              renderItem={renderConversation}
              contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
              ListEmptyComponent={
                <View style={s.emptyWrap}>
                  <Text style={s.emptyText}>Không tìm thấy kết quả</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    minHeight: 300,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  closeBtn: {
    padding: 4,
  },

  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  previewBorder: {
    width: 3,
    height: '100%',
    minHeight: 20,
    backgroundColor: ZaloColors.blue,
    borderRadius: 2,
    marginRight: 10,
  },
  previewText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    paddingVertical: 0,
  },

  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  convLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  convAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  convAvatarDefault: {
    backgroundColor: ZaloColors.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  convAvatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  convName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
    flex: 1,
  },

  sendButton: {
    backgroundColor: ZaloColors.blue,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#a0c4ff',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  loadingWrap: {
    padding: 40,
    alignItems: 'center',
  },
  emptyWrap: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
});

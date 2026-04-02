import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ZaloColors } from '@/constants/zalo';
import { useSocket } from '@/contexts/SocketContext';
import { chatApiClient } from '@/constants/chatApi';

interface Message {
  _id: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp?: string;
  createdAt?: string; 
}

export default function ChatScreen() {
  const router = useRouter();
  // Nhận avatar từ params để hiển thị chân thực hơn
  const { id, name, recipientId, avatar } = useLocalSearchParams<{ 
    id: string, 
    name: string, 
    recipientId: string,
    avatar?: string 
  }>();
  
  const { socket, currentUserId: socketUserId, onlineUsers } = useSocket();
  const [currentUserId, setCurrentUserId] = useState<string | null>(socketUserId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Luôn lấy userId mới nhất từ AsyncStorage khi vào màn hình Chat
  useEffect(() => {
    const fetchMyId = async () => {
        const uid = await AsyncStorage.getItem('userId');
        console.log("Current User ID in Chat:", uid); // Debug log
        if (uid) {
            setCurrentUserId(uid);
        } else if (socketUserId) {
            setCurrentUserId(socketUserId);
        }
    };
    fetchMyId();
  }, [id, socketUserId]);

  const isOnline = onlineUsers.includes(recipientId);

  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await chatApiClient.get(`/conversation/${id}?page=1&limit=50`);
        const history = res.data?.data || [];
        // Đảo ngược mảng để dùng với 'inverted' FlatList (mới nhất ở index 0)
        setMessages(history.reverse());

        if (socket && currentUserId) {
             const lastMsg = history[0]; // Sau khi reverse, history[0] là tin mới nhất
             if (lastMsg && String(lastMsg.senderId) !== String(currentUserId)) {
                 socket.emit('mark_as_seen', {
                    messageId: lastMsg._id,
                    conversationId: id,
                    userId: currentUserId
                 });
             }
        }
      } catch (err) {
        console.log("Fetch history error", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchHistory();
  }, [id, socket, currentUserId]);

  useEffect(() => {
    if (!socket) return;
    
    const handleNewMessage = (data: any) => {
      if (data.conversationId === id) {
        setMessages(prev => {
          // CHỐNG TRÙNG LẶP: Nếu ID đã tồn tại trong danh sách thì không thêm nữa
          const exists = prev.some(m => String(m._id) === String(data.messageId));
          if (exists) return prev;

          const newMessage: Message = {
              _id: data.messageId || Math.random().toString(),
              senderId: data.senderId,
              recipientId: data.recipientId || '',
              content: data.text,
              createdAt: data.timestamp || new Date().toISOString()
          };
          
          return [newMessage, ...prev];
        });

        if (String(data.senderId) !== String(currentUserId)) {
            socket.emit('mark_as_seen', {
                messageId: data.messageId,
                conversationId: id,
                userId: currentUserId
            });
        }
      }
    };

    const handleUserTyping = (data: any) => {
        if (data.conversationId === id && String(data.userId) !== String(currentUserId)) {
            setIsOtherTyping(data.isTyping);
        }
    }

    socket.on('message_received', handleNewMessage);
    socket.on('message_sent', handleNewMessage);
    socket.on('user_typing', handleUserTyping);

    return () => {
      socket.off('message_received', handleNewMessage);
      socket.off('message_sent', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
    };
  }, [socket, id, currentUserId]);

  const handleTextChange = (val: string) => {
      setText(val);
      if (!socket || !currentUserId) return;

      if (!isTyping) {
        setIsTyping(true);
        socket.emit('typing', { conversationId: id, userId: currentUserId, isTyping: true });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        socket.emit('typing', { conversationId: id, userId: currentUserId, isTyping: false });
      }, 1500) as any;
  }

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !socket || !currentUserId) return;

    socket.emit('send_message', {
      conversationId: id,
      senderId: currentUserId,
      recipientId: recipientId,
      text: trimmed
    });

    setText('');
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = String(item.senderId) === String(currentUserId);
    
    return (
      <View style={[styles.msgWrapper, isMine ? styles.myMsgWrapper : styles.theirMsgWrapper]}>
        {/* Hiện Avatar đối phương ở bên trái tin nhắn họ gửi */}
        {!isMine && (
          <View style={styles.avatarWrap}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.miniAvatar} />
            ) : (
                <View style={styles.defaultAvatar}>
                    <Ionicons name="person" size={14} color="#888" />
                </View>
            )}
          </View>
        )}

        <View style={[styles.msgBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
          <Text style={[styles.msgContent, isMine ? styles.myMsgContent : styles.theirMsgContent]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <StatusBar style="light" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
          {isOtherTyping ? (
            <Text style={styles.headerStatus}>Đang gõ...</Text>
          ) : isOnline ? (
            <Text style={styles.headerStatus}>Vừa mới truy cập</Text>
          ) : null}
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="call-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="videocam-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="menu" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat Area */}
      <KeyboardAvoidingView 
        style={styles.chatArea} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isLoading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={ZaloColors.blue} />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={item => item._id}
            renderItem={renderMessage}
            inverted={true} // Đảo ngược để hỗ trợ trải nghiệm chat mượt mà
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input Area */}
        <View style={styles.inputArea}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="happy-outline" size={26} color="#666" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Tin nhắn"
            placeholderTextColor="#888"
            value={text}
            onChangeText={handleTextChange}
            multiline
            maxLength={1000}
          />
          {text.trim().length > 0 ? (
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Ionicons name="send" size={22} color={ZaloColors.blue} />
            </TouchableOpacity>
          ) : (
            <View style={{flexDirection: 'row'}}>
              <TouchableOpacity style={styles.iconBtn}>
                <Ionicons name="mic-outline" size={26} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn}>
                <Ionicons name="image-outline" size={26} color="#666" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e2e9f1' },
  header: {
    backgroundColor: ZaloColors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  headerBtn: { padding: 8 },
  headerTitleWrap: { flex: 1, paddingHorizontal: 4, justifyContent: 'center' },
  headerName: { color: '#fff', fontSize: 18, fontWeight: '600' },
  headerStatus: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  chatArea: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingVertical: 16 },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  msgWrapper: { marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end' },
  myMsgWrapper: { justifyContent: 'flex-end' },
  theirMsgWrapper: { justifyContent: 'flex-start' },
  
  avatarWrap: { marginRight: 8 },
  miniAvatar: { width: 30, height: 30, borderRadius: 15 },
  defaultAvatar: { 
      width: 30, 
      height: 30, 
      borderRadius: 15, 
      backgroundColor: '#ccc', 
      justifyContent: 'center', 
      alignItems: 'center' 
  },

  msgBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  myMsgBubble: { backgroundColor: '#cce5ff', borderTopRightRadius: 4 },
  theirMsgBubble: { backgroundColor: '#fff', borderTopLeftRadius: 4 },
  msgContent: { fontSize: 15, lineHeight: 22 },
  myMsgContent: { color: '#000' },
  theirMsgContent: { color: '#000' },
  
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    color: '#000',
    marginHorizontal: 8,
  },
  iconBtn: { padding: 8, justifyContent: 'center', alignItems: 'center' },
  sendBtn: { padding: 8, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
});

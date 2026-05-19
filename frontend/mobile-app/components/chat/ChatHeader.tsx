import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ZaloColors } from '@/constants/zalo';
import { useGroupCallStore } from '@/stores/groupCallStore';
import { useSocket } from '@/contexts/SocketContext';

interface ChatHeaderProps {
  id: string;
  name: string;
  avatar?: string;
  recipientId?: string;
  isGroup: boolean;
  groupMemberCount?: number;
  isOnline: boolean;
  isOtherTyping: boolean;
}

export default function ChatHeader({
  id,
  name,
  avatar,
  recipientId,
  isGroup,
  groupMemberCount,
  isOnline,
  isOtherTyping,
}: ChatHeaderProps) {
  const router = useRouter();
  const { currentUserId, socket } = useSocket();
  const isCloud = id?.startsWith('cloud_');

  const handleStartCall = (isVideo: boolean) => {
    if (!socket || !currentUserId || !id) return;
    // Emit group_call_start to notify others and create the call message
    socket.emit('group_call_start', {
      conversationId: id,
      callerInfo: { id: currentUserId },
      isVideo,
    });
    // Set store state → CallManager will auto-init stream then emit group_call_join
    useGroupCallStore.getState().setOutgoingCall(id, currentUserId.toString(), isVideo);
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <View style={styles.headerTitleWrap}>
        {isCloud ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.headerName} numberOfLines={1}>My Documents</Text>
            <Ionicons name="checkmark-circle" size={16} color="#FFB000" />
          </View>
        ) : (
          <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
        )}
        {isCloud ? (
          <Text style={styles.headerStatus}>Lưu trữ cá nhân • Đồng bộ</Text>
        ) : isOtherTyping ? (
          <Text style={styles.headerStatus}>Đang gõ...</Text>
        ) : isGroup && (groupMemberCount || 0) > 0 ? (
          <Text style={styles.headerStatus}>{groupMemberCount} thành viên</Text>
        ) : isOnline ? (
          <Text style={styles.headerStatus}>Vừa mới truy cập</Text>
        ) : null}
      </View>
      <View style={styles.headerActions}>
        {isCloud ? (
          <TouchableOpacity style={styles.headerBtn} onPress={() => Alert.alert('Tìm kiếm', 'Tìm kiếm tin nhắn trong My Documents')}>
            <Ionicons name="search-outline" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.headerBtn} onPress={() => handleStartCall(false)}>
              <Ionicons name="call-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => handleStartCall(true)}>
              <Ionicons name="videocam-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity 
          style={styles.headerBtn} 
          onPress={() => router.push({
            pathname: '/chat/options', 
            params: {
              id,
              name: 'My Documents',
              avatar: avatar as string,
              recipientId: recipientId as string,
              isGroup: isGroup ? 'true' : 'false'
            }
          })}
        >
          <Ionicons name={isCloud ? "list-outline" : "menu"} size={26} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    backgroundColor: ZaloColors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 8,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  headerStatus: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
  },
});

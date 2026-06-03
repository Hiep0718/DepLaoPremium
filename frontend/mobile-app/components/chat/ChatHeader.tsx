import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ZaloColors } from '@/constants/zalo';
import { useGroupCallStore } from '@/stores/groupCallStore';
import { useCallStore } from '@/stores/callStore';
import { useSocket } from '@/contexts/SocketContext';

import apiClient from '@/constants/api';

interface ChatHeaderProps {
  id: string;
  name: string;
  avatar?: string;
  recipientId?: string;
  isGroup: boolean;
  groupMemberCount?: number;
  isOnline: boolean;
  isOtherTyping: boolean;
  onOpenSearch?: () => void;
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
  onOpenSearch,
}: ChatHeaderProps) {
  const router = useRouter();
  const { currentUserId, socket } = useSocket();
  const isCloud = id?.startsWith('cloud_');

  const handleStartCall = async (isVideo: boolean) => {
    if (!socket || !currentUserId || !id) return;

    // Fetch my profile info to send in callerInfo
    let myFullName = 'Người dùng';
    let myAvatar = '';
    try {
      const res = await apiClient.get(`/users/${currentUserId}`);
      if (res.data?.data) {
        myFullName = res.data.data.fullName || 'Người dùng';
        myAvatar = res.data.data.avatarUrl || '';
      }
    } catch (err) {
      console.log('[ChatHeader] Failed to fetch my profile for call', err);
    }

    if (isGroup) {
      // ═══ Group Call: dùng group_call_start + groupCallStore ═══
      socket.emit('group_call_start', {
        conversationId: id,
        callerInfo: { id: currentUserId.toString(), fullName: myFullName, avatarUrl: myAvatar },
        isVideo,
      });
      useGroupCallStore.getState().setOutgoingCall(id, currentUserId.toString(), isVideo);
    } else {
      // ═══ 1-1 Call: dùng call_request + callStore (giống web-app) ═══
      if (!recipientId) {
        console.warn('[ChatHeader] recipientId is required for 1-1 call');
        return;
      }
      const callerInfo = {
        id: currentUserId.toString(),
        fullName: myFullName,
        avatarUrl: myAvatar,
      };
      useCallStore.getState().setOutgoingCall(
        recipientId,
        { id: recipientId, fullName: name, avatarUrl: avatar },
        isVideo,
        id
      );
      socket.emit('call_request', {
        recipientId,
        callerInfo,
        isVideo,
        conversationId: id,
      });
    }
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
          <TouchableOpacity style={styles.headerBtn} onPress={onOpenSearch || (() => Alert.alert('Tìm kiếm', 'Tìm kiếm tin nhắn trong My Documents'))}>
            <Ionicons name="search-outline" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.headerBtn} onPress={onOpenSearch}>
              <Ionicons name="search-outline" size={22} color="#fff" />
            </TouchableOpacity>
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
              name: isCloud ? 'My Documents' : name,
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

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatApiClient } from '@/constants/chatApi';

export default function JoinGroupScreen() {
  const { inviteCode } = useLocalSearchParams<{ inviteCode: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending' | 'login_required'>('loading');
  const [message, setMessage] = useState('');
  const [groupData, setGroupData] = useState<any>(null);

  useEffect(() => {
    const performJoin = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) {
          setStatus('login_required');
          setMessage('Bạn cần đăng nhập để tham gia nhóm.');
          return;
        }

        if (!inviteCode) {
          setStatus('error');
          setMessage('Link tham gia không hợp lệ.');
          return;
        }

        const res = await chatApiClient.post(`/join/${inviteCode}`, { userId });

        if (res.data.approvalRequired) {
          setStatus('pending');
          setMessage('Yêu cầu tham gia của bạn đã được gửi. Vui lòng chờ Admin duyệt.');
        } else {
          setStatus('success');
          setMessage('Tham gia nhóm thành công!');
          setGroupData(res.data.data);
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(
          err.response?.data?.message || 'Không thể tham gia nhóm. Link có thể đã hết hạn hoặc không tồn tại.'
        );
      }
    };

    performJoin();
  }, [inviteCode]);

  const handleGoToChat = () => {
    if (groupData?.conversationId) {
      router.replace({
        pathname: '/chat/[id]',
        params: {
          id: groupData.conversationId,
          isGroup: 'true',
          name: groupData.groupName || 'Nhóm',
        },
      });
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Loading */}
        {status === 'loading' && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#0068FF" />
            <Text style={styles.title}>Đang xử lý tham gia nhóm...</Text>
          </View>
        )}

        {/* Success */}
        {status === 'success' && (
          <View style={styles.centerContent}>
            <View style={styles.iconCircleGreen}>
              <Ionicons name="checkmark-circle" size={48} color="#10b981" />
            </View>
            <Text style={styles.title}>Thành công!</Text>
            <Text style={styles.subtitle}>{message}</Text>

            {groupData && (
              <View style={styles.groupInfo}>
                <View style={styles.groupAvatar}>
                  {groupData.groupAvatar ? (
                    <Image source={{ uri: groupData.groupAvatar }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="people" size={28} color="#0068FF" />
                  )}
                </View>
                <View style={styles.groupTextWrap}>
                  <Text style={styles.groupName}>{groupData.groupName || 'Nhóm mới'}</Text>
                  <Text style={styles.groupMemberCount}>
                    {groupData.participants?.length || 0} thành viên
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.primaryBtn} onPress={handleGoToChat}>
              <Text style={styles.primaryBtnText}>Vào trò chuyện</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pending Approval */}
        {status === 'pending' && (
          <View style={styles.centerContent}>
            <View style={styles.iconCircleOrange}>
              <Ionicons name="time" size={48} color="#f59e0b" />
            </View>
            <Text style={styles.title}>Chờ duyệt</Text>
            <Text style={styles.subtitle}>{message}</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.secondaryBtnText}>Về trang chủ</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error */}
        {status === 'error' && (
          <View style={styles.centerContent}>
            <View style={styles.iconCircleRed}>
              <Ionicons name="alert-circle" size={48} color="#ef4444" />
            </View>
            <Text style={styles.title}>Thất bại</Text>
            <Text style={styles.subtitle}>{message}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.primaryBtnText}>Quay lại</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Login Required */}
        {status === 'login_required' && (
          <View style={styles.centerContent}>
            <View style={styles.iconCircleOrange}>
              <Ionicons name="log-in" size={48} color="#f59e0b" />
            </View>
            <Text style={styles.title}>Yêu cầu đăng nhập</Text>
            <Text style={styles.subtitle}>{message}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/login')}>
              <Text style={styles.primaryBtnText}>Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  centerContent: {
    alignItems: 'center',
  },
  iconCircleGreen: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircleOrange: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircleRed: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginBottom: 24,
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e6f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  groupTextWrap: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  groupMemberCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  primaryBtn: {
    backgroundColor: '#0068FF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '700',
  },
});

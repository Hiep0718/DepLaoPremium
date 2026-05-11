import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter, useSegments, useGlobalSearchParams } from 'expo-router';
import { useSocket } from '../contexts/SocketContext';
import apiClient from '../constants/api';

// Cấu hình hiển thị thông báo khi app đang chạy (Foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function NotificationManager() {
  const { socket, currentUserId } = useSocket();
  const router = useRouter();
  const segments = useSegments();
  const params = useGlobalSearchParams();
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // Yêu cầu quyền thông báo khi khởi động
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Tin nhắn mới',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0068FF',
        });
      }
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Quyền thông báo bị từ chối');
      }
    })();

    // Xử lý khi người dùng nhấn vào thông báo
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data && data.conversationId) {
        // Điều hướng vào màn hình chat
        router.push({
          pathname: '/chat/[id]',
          params: {
            id: data.conversationId,
            name: data.name || 'Trò chuyện',
            recipientId: data.recipientId || '',
            avatar: data.avatar || '',
            isOnline: 'false'
          }
        });
      }
    });

    return () => {
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
    };
  }, []);

  // Lắng nghe tin nhắn mới từ Socket để bắn thông báo Local
  useEffect(() => {
    if (!socket || !currentUserId) return;

    const handleNewMessage = async (msg: any) => {
      // 1. Không thông báo tin nhắn của chính mình
      if (String(msg.senderId) === String(currentUserId)) return;

      // 2. Không thông báo nếu đang mở màn hình chat đó
      // segments sẽ có dạng: ['chat', '[id]']
      const isChatScreen = segments.length > 0 && segments[segments.length - 1] === '[id]';
      if (isChatScreen && params.id === msg.conversationId) {
        return; // Bỏ qua không thông báo
      }

      // 3. Chuẩn bị nội dung thông báo
      let title = 'Tin nhắn mới';
      let bodyText = msg.content || msg.text || '';
      let avatar = '';
      let isGroup = false;

      // Xử lý các loại tin nhắn đặc biệt
      if (msg.messageType === 'image') bodyText = '[Hình ảnh]';
      else if (msg.messageType === 'video') bodyText = '[Video]';
      else if (msg.messageType === 'voice') bodyText = '[Tin nhắn thoại]';
      else if (msg.messageType === 'document') bodyText = '[Tệp đính kèm]';
      else if (msg.messageType === 'location') bodyText = '[Vị trí]';
      else if (msg.messageType === 'reminder') bodyText = '[Nhắc hẹn]';
      else if (msg.messageType === 'contact') bodyText = '[Danh thiếp]';

      // 4. Lấy thông tin tên người gửi hoặc tên nhóm để hiển thị
      try {
        // Mặc định gọi API lấy thông tin người gửi
        const userRes = await apiClient.get(`/users/${msg.senderId}`);
        const senderName = userRes.data?.data?.fullName || userRes.data?.data?.nickname || 'Ai đó';
        title = senderName;
        avatar = userRes.data?.data?.avatarUrl || '';

        // Có thể cần lấy tên nhóm nếu message này từ nhóm
        // Vì message socket thường không gửi isGroup, ta dùng logic đơn giản:
        // Nếu conversationId không chứa senderId và không có prefix "ai_" thì có thể là nhóm
        // (Tuy nhiên app sẽ tự xử lý lấy dữ liệu nhóm ở màn hình chat, ta chỉ cần truyền param cơ bản)
      } catch (e) {
        console.log('Failed to fetch sender info for notification', e);
      }

      // 5. Bắn Local Notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: bodyText,
          data: {
            conversationId: msg.conversationId,
            name: title,
            recipientId: msg.senderId,
            avatar: avatar,
          },
          sound: true,
        },
        trigger: null, // Gửi ngay lập tức
      });
    };

    socket.on('message_received', handleNewMessage);

    return () => {
      socket.off('message_received', handleNewMessage);
    };
  }, [socket, currentUserId, segments, params]);

  return null; // Component này chỉ chạy ngầm, không render UI
}

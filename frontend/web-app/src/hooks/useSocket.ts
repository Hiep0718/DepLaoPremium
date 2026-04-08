import { useEffect } from 'react';
import { socket, connectSocket, disconnectSocket } from '../services/socket';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore'; // Đã thêm
import type { Message } from '../stores/chatStore';
import {
  requestNotificationPermission,
  showMessageNotification,
  showToast,
  playNotificationSound,
} from '../services/notification.service';

export const useSocketSetup = () => {
  const { user } = useAuthStore();
  const addMessage = useChatStore((state) => state.addMessage);

  useEffect(() => {
    if (user?.id) {
      connectSocket(user.id);
      requestNotificationPermission();

      // ═══ FORCE LOGOUT: Single Session trên Web ═══
      socket.on('force_logout', (data: { message: string }) => {
        console.warn('[Socket] Force logout:', data.message);
        showToast('Phiên đăng nhập', data.message, 'warning');
        useAuthStore.getState().logout();
        disconnectSocket();
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      });

      // ═══ LẮNG NGHE TIN NHẮN ═══
      socket.on('message_received', (data: Message) => {
        const chatState = useChatStore.getState();
        const settingsState = useSettingsStore.getState().settings; // Lấy settings hiện tại

        // 1. Cập nhật vào màn hình chat nếu đang mở
        if (chatState.activeConversation?.conversationId === data.conversationId) {
          const incomingId = (data as any).messageId || data._id || data.id;
          const exists = incomingId ? chatState.messages.find(m => m.id === incomingId || m._id === incomingId) : false;

          if (!exists) {
            const normalizedMsg = {
              ...data,
              _id: incomingId,
              id: incomingId,
              content: data.content || data.text,
              fileUrl: (data as any).fileUrl,
              fileName: (data as any).fileName,
              fileSize: (data as any).fileSize,
              messageType: (data as any).messageType || 'text',
            };
            chatState.addMessage(normalizedMsg);
          }
        }

        // 2. Cập nhật số lượng tin nhắn chưa đọc bên Sidebar
        const updatedConversations = chatState.conversations.map(c => {
          if (c.conversationId === data.conversationId) {
            return { ...c, lastMessage: data.content || data.text, unreadCount: (c.unreadCount || 0) + 1 };
          }
          return c;
        });
        chatState.setConversations(updatedConversations);

        // 3. ═══ NOTIFICATIONS ═══
        // Dừng lại nếu người dùng đã tắt thông báo tin nhắn trong cài đặt
        if (!settingsState.notifyMessages) return;

        const msgType = (data as any).messageType || 'text';

        // Nếu user tắt preview (ẩn nội dung), thay thế bằng dòng chữ chung chung
        const msgContent = settingsState.notifyPreview ? (data.content || data.text || '') : 'Bạn có một tin nhắn mới';

        let senderName = 'Tin nhắn mới';
        let senderAvatar: string | undefined;
        const conv = chatState.conversations.find(c => c.conversationId === data.conversationId);

        if (conv?.participants) {
          const sender = conv.participants.find((p: any) => {
            const pId = p.userId || p.contactUserId || p.id || p;
            return pId?.toString() === data.senderId;
          });
          if (sender) {
            senderName = sender.nickname || sender.fullName || sender.name || senderName;
            senderAvatar = sender.avatarUrl;
          }
        }

        const isInActiveConv = chatState.activeConversation?.conversationId === data.conversationId;

        // Hành động khi Click vào Toast / Notification
        const handleNotificationClick = () => {
          const targetConv = useChatStore.getState().conversations.find(c => c.conversationId === data.conversationId);
          if (targetConv) {
            useChatStore.getState().setActiveConversation(targetConv);
            window.focus(); // Đưa trình duyệt lên trên cùng nếu bị thu nhỏ
          }
        };

        // Browser desktop notification (chỉ khi tab mất focus)
        showMessageNotification(senderName, msgContent, msgType, senderAvatar, handleNotificationClick);

        // In-app toast (khi đang ở conversation khác)
        if (!isInActiveConv) {
          let toastMsg = msgContent;
          if (settingsState.notifyPreview) {
            if (msgType === 'image') toastMsg = '📷 Đã gửi một hình ảnh';
            else if (msgType === 'video') toastMsg = '🎬 Đã gửi một video';
            else if (msgType === 'file') toastMsg = '📎 Đã gửi một tệp';
            else if (msgType === 'sticker') toastMsg = '😊 Đã gửi một nhãn dán';
          }

          showToast(senderName, toastMsg, 'info', senderAvatar, handleNotificationClick);

          // Phát âm thanh nếu user không tắt
          if (settingsState.notifySound) {
            playNotificationSound();
          }
        }
      });

      socket.on('message_sent', (data: any) => {
        const state = useChatStore.getState();
        if (data.tempId && data.messageId) {
          state.updateMessage(data.tempId, {
            id: data.messageId,
            _id: data.messageId,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileSize: data.fileSize,
            messageType: data.messageType,
          });
        }
      });

      socket.on('user_online', (data) => {
        console.log('User online:', data);
      });

      return () => {
        socket.off('force_logout');
        socket.off('message_received');
        socket.off('message_sent');
        socket.off('user_online');
        disconnectSocket();
      };
    }
  }, [user, addMessage]);
};
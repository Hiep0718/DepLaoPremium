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
        // 2. Cập nhật số lượng tin nhắn chưa đọc bên Sidebar VÀ ĐẨY LÊN ĐẦU
        const updatedConversations = [...chatState.conversations];
        const targetIndex = updatedConversations.findIndex(c => c.conversationId === data.conversationId);

        if (targetIndex !== -1) {
          // TẠO BẢN SAO MỚI CỦA OBJECT (Deep clone) ĐỂ REACT NHẬN DIỆN SỰ THAY ĐỔI
          const targetConv = { ...updatedConversations[targetIndex] };

          // Rút ra khỏi mảng hiện tại
          updatedConversations.splice(targetIndex, 1);

          // Cập nhật nội dung (Để đồng bộ với logic hiển thị "Người dùng: Nội dung" ở Sidebar)
          targetConv.lastMessage = {
            content: data.content || data.text,
            senderId: data.senderId,
            messageType: (data as any).messageType || 'text',
            timestamp: data.timestamp || new Date().toISOString()
          };

          // Chỉ tăng biến đếm nếu KHÔNG ĐANG MỞ cửa sổ chat đó
          if (chatState.activeConversation?.conversationId !== data.conversationId) {
            targetConv.unreadCount = (targetConv.unreadCount || 0) + 1;
            console.log(`[Socket] Đã tăng unreadCount của ${targetConv.conversationId} lên:`, targetConv.unreadCount);
          }

          // Đẩy object MỚI lên đầu mảng
          updatedConversations.unshift(targetConv);
          chatState.setConversations(updatedConversations);
        } else {
          // Cuộc trò chuyện mới hoặc đã bị xóa trước đó -> Load lại toàn bộ danh sách hội thoại
          import('../services/message.service').then(({ getConversationsList }) => {
            if (user?.id) {
              getConversationsList(user.id.toString()).then(res => {
                if (res.data?.success) {
                  chatState.setConversations(res.data.data);
                }
              });
            }
          });
        }
        // 3. ═══ REFRESH CONVERSATION DATA FOR GROUP CHANGES ═══
        const msgType = (data as any).messageType || 'text';
        const msgContent = (data as any).content || '';
        const isGroupChange = msgType === 'system' && (
          msgContent.startsWith('added_members:') ||
          msgContent.startsWith('member_left:') ||
          msgContent.startsWith('member_removed:') ||
          msgContent.startsWith('group_disbanded:') ||
          msgContent.startsWith('role_') ||
          msgContent.startsWith('group_updated:') ||
          msgContent === 'Nhóm đã được tạo'
        );

        if (isGroupChange) {
          // Reload conversation list to get fresh participant/role data
          import('../services/message.service').then(({ getConversationsList }) => {
            if (user?.id) {
              getConversationsList(user.id.toString()).then(res => {
                const list = res.data?.data || res.data;
                if (Array.isArray(list)) {
                  const freshState = useChatStore.getState();
                  freshState.setConversations(list);

                  // If the active conversation is affected, update it with fresh data
                  if (freshState.activeConversation?.conversationId === data.conversationId) {
                    const freshConv = list.find((c: any) => c.conversationId === data.conversationId);
                    if (freshConv) {
                      freshState.setActiveConversation(freshConv);
                    } else if (msgContent.startsWith('group_disbanded:')) {
                      // Group was disbanded, clear active
                      freshState.setActiveConversation(null);
                    }
                  }
                }
              }).catch(console.error);
            }
          });
        }

        // 4. ═══ NOTIFICATIONS ═══
        // Dừng lại nếu người dùng đã tắt thông báo tin nhắn trong cài đặt
        if (!settingsState.notifyMessages) return;

        // Nếu user tắt preview (ẩn nội dung), thay thế bằng dòng chữ chung chung
        const notifyContent = settingsState.notifyPreview ? (data.content || data.text || '') : 'Bạn có một tin nhắn mới';

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
        showMessageNotification(senderName, notifyContent, msgType, senderAvatar, handleNotificationClick);

        // In-app toast (khi đang ở conversation khác)
        if (!isInActiveConv) {
          let toastMsg = notifyContent;
          if (settingsState.notifyPreview) {
            if (msgType === 'image') toastMsg = '📷 Đã gửi một hình ảnh';
            else if (msgType === 'video') toastMsg = '🎬 Đã gửi một video';
            else if (msgType === 'audio') toastMsg = '🎤 Đã gửi một tin nhắn thoại';
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

      socket.on('message_reacted', (data: any) => {
        const state = useChatStore.getState();
        const msgId = data.messageId;
        const currentMsg = state.messages.find(m => m.id === msgId || m._id === msgId);
        
        state.updateMessage(msgId, { 
          reactions: data.reactions, 
          content: data.content || currentMsg?.content 
        });
      });

      socket.on('message_revoked', (data: any) => {
        const state = useChatStore.getState();
        state.updateMessage(data.messageId, { isRevoked: true });
      });

      socket.on('message_deleted', (data: any) => {
        const state = useChatStore.getState();
        const currentMessages = state.messages;
        const filtered = currentMessages.filter(m => m.id !== data.messageId && m._id !== data.messageId);
        state.setMessages(filtered);
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

        // Cập nhật lastMessage và đẩy hội thoại lên đầu danh sách
        const updatedConversations = [...state.conversations];
        const targetIndex = updatedConversations.findIndex(c => c.conversationId === data.conversationId);
        
        if (targetIndex !== -1) {
          const targetConv = { ...updatedConversations[targetIndex] };
          updatedConversations.splice(targetIndex, 1);
          
          targetConv.lastMessage = {
            content: data.content || data.text,
            senderId: data.senderId,
            messageType: data.messageType || 'text',
            timestamp: data.timestamp || new Date().toISOString()
          };
          
          updatedConversations.unshift(targetConv);
          state.setConversations(updatedConversations);
        } else {
          // Nếu không tìm thấy, fetch lại danh sách
          import('../services/message.service').then(({ getConversationsList }) => {
            if (user?.id) {
              getConversationsList(user.id.toString()).then(res => {
                if (res.data?.success) {
                  state.setConversations(res.data.data);
                }
              });
            }
          });
        }
      });

      socket.on('user_online', (data) => {
        console.log('User online:', data);
      });

      socket.on('group_settings_updated', (data: { conversationId: string, settings: any }) => {
        const state = useChatStore.getState();
        if (state.activeConversation?.conversationId === data.conversationId) {
          state.updateActiveConversation(data.settings);
        } else {
          // Update in conversations list
          state.setConversations(state.conversations.map(c => 
            c.conversationId === data.conversationId ? { ...c, ...data.settings } : c
          ));
        }
      });

      socket.on('pending_members_updated', (data: { conversationId: string, pendingMembers: any[] }) => {
        const state = useChatStore.getState();
        if (state.activeConversation?.conversationId === data.conversationId) {
          state.updateActiveConversation({ pendingMembers: data.pendingMembers });
        } else {
          // Update in conversations list
          state.setConversations(state.conversations.map(c => 
            c.conversationId === data.conversationId ? { ...c, pendingMembers: data.pendingMembers } : c
          ));
        }
      });

      return () => {
        socket.off('force_logout');
        socket.off('message_received');
        socket.off('message_sent');
        socket.off('message_reacted');
        socket.off('message_revoked');
        socket.off('message_deleted');
        socket.off('user_online');
        socket.off('group_settings_updated');
        socket.off('pending_members_updated');
        disconnectSocket();
      };
    }
  }, [user, addMessage]);
};
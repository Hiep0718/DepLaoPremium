import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { Socket } from 'socket.io-client';
import * as Location from 'expo-location';
import { Message } from '@/types/chat';

interface UseChatActionsProps {
  socket: Socket | null;
  currentUserId: string | null;
  id: string; // conversation ID
  recipientId: string | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  replyingMessage: Message | null;
  setReplyingMessage: React.Dispatch<React.SetStateAction<Message | null>>;
  pinnedMessage: any;
  toggleStickerPanel: (show?: boolean) => void;
  setShowReminderModal: (show: boolean) => void;
  reminderText: string;
  setReminderText: (text: string) => void;
  reminderDate: Date;
  setReminderDate: (date: Date) => void;
}

export function useChatActions({
  socket,
  currentUserId,
  id,
  recipientId,
  setMessages,
  replyingMessage,
  setReplyingMessage,
  pinnedMessage,
  toggleStickerPanel,
  setShowReminderModal,
  reminderText,
  setReminderText,
  reminderDate,
  setReminderDate,
}: UseChatActionsProps) {
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});

  const handleSend = useCallback((text: string, setText: (val: string) => void, setIsTyping: (val: boolean) => void) => {
    const trimmed = text.trim();
    if (!trimmed || !socket || !currentUserId) return;

    const tempId = `pending-${Date.now()}`;
    const replyData = replyingMessage ? {
      messageId: replyingMessage._id,
      content: replyingMessage.content,
      senderId: replyingMessage.senderId,
      messageType: replyingMessage.messageType || 'text',
    } : undefined;

    const tempMsg: Message = {
      _id: tempId,
      senderId: currentUserId,
      recipientId: recipientId as string,
      content: trimmed,
      messageType: 'text',
      createdAt: new Date().toISOString(),
      status: 'pending',
      replyTo: replyData,
    };

    setMessages(prev => [tempMsg, ...prev]);
    setText('');
    setReplyingMessage(null);

    socket.emit('send_message', {
      tempId,
      conversationId: id,
      senderId: currentUserId,
      recipientId,
      text: trimmed,
      messageType: 'text',
      replyTo: replyData,
    });

    setIsTyping(false);
    socket.emit('typing', { conversationId: id, userId: currentUserId, isTyping: false });
  }, [socket, currentUserId, id, recipientId, replyingMessage, setMessages, setReplyingMessage]);

  const sendSticker = useCallback((stickerUrl: string) => {
    if (!socket || !currentUserId) return;

    const tempId = `pending-sticker-${Date.now()}`;
    const replyData = replyingMessage ? {
      messageId: replyingMessage._id,
      content: replyingMessage.content,
      senderId: replyingMessage.senderId,
      messageType: replyingMessage.messageType || 'text',
    } : undefined;

    const tempMsg: Message = {
      _id: tempId,
      senderId: currentUserId,
      recipientId: recipientId as string,
      content: '[Nhãn dán]',
      messageType: 'sticker',
      fileUrl: stickerUrl,
      createdAt: new Date().toISOString(),
      status: 'pending',
      replyTo: replyData,
    };

    setMessages(prev => [tempMsg, ...prev]);
    toggleStickerPanel(false);
    setReplyingMessage(null);

    socket.emit('send_message', {
      tempId,
      conversationId: id,
      senderId: currentUserId,
      recipientId,
      text: '[Nhãn dán]',
      messageType: 'sticker',
      fileUrl: stickerUrl,
      replyTo: replyData,
    });
  }, [socket, currentUserId, id, recipientId, replyingMessage, setMessages, toggleStickerPanel, setReplyingMessage]);

  const handleRevoke = useCallback((msg: Message) => {
    if (!socket || !currentUserId) return;
    Alert.alert(
      'Thu hồi tin nhắn',
      'Tin nhắn sẽ bị thu hồi với tất cả mọi người trong cuộc trò chuyện.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Thu hồi',
          style: 'destructive',
          onPress: () => {
            socket.emit('revoke_message', {
              messageId: msg._id,
              conversationId: id,
              userId: currentUserId,
            });
            setMessages(prev =>
              prev.map(m =>
                String(m._id) === String(msg._id) ? { ...m, isRevoked: true } : m
              )
            );
          },
        },
      ]
    );
  }, [socket, currentUserId, id, setMessages]);

  const handleDeleteMessage = useCallback((msg: Message) => {
    Alert.alert(
      'Xóa tin nhắn',
      'Tin nhắn này sẽ bị xóa ở phía bạn. Những người khác vẫn có thể xem được.',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xóa phía tôi', 
          style: 'destructive',
          onPress: () => {
            if (socket && currentUserId) {
              socket.emit('delete_message_for_me', { messageId: msg._id, userId: currentUserId });
              setMessages(prev => prev.filter(m => String(m._id) !== String(msg._id)));
            }
          }
        }
      ]
    );
  }, [socket, currentUserId, setMessages]);

  const handleTogglePinMessage = useCallback((msg: Message) => {
    if (!socket || !currentUserId) return;
    const isCurrentlyPinned = pinnedMessage?.messageId === msg._id;
    
    if (isCurrentlyPinned) {
      socket.emit('unpin_message', { conversationId: id, userId: currentUserId });
    } else {
      socket.emit('pin_message', { messageId: msg._id, conversationId: id, userId: currentUserId });
    }
  }, [socket, currentUserId, id, pinnedMessage]);

  const handleTranslate = useCallback(async (msg: Message) => {
    const textToTranslate = msg.content;
    const msgId = msg._id;
    if (!textToTranslate || !msgId) return;

    setTranslatingId(msgId);
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=autodetect|vi`);
      const data = await res.json();
      if (data.responseData?.translatedText) {
        setTranslatedMessages(prev => ({
          ...prev,
          [msgId]: data.responseData.translatedText
        }));
      }
    } catch (err) {
      console.log('Translation error:', err);
    } finally {
      setTranslatingId(null);
    }
  }, []);

  const handleSendLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập vị trí để sử dụng tính năng này.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;

      let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      try {
        const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo) {
          const parts = [geo.name, geo.street, geo.district, geo.city, geo.region].filter(Boolean);
          if (parts.length > 0) address = parts.join(', ');
        }
      } catch {}

      if (!socket || !currentUserId) return;

      const tempId = `pending-loc-${Date.now()}`;
      const content = JSON.stringify({ latitude, longitude, address });

      const tempMsg: Message = {
        _id: tempId,
        senderId: currentUserId,
        recipientId: recipientId as string,
        content,
        messageType: 'location',
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      setMessages(prev => [tempMsg, ...prev]);

      socket.emit('send_message', {
        tempId,
        conversationId: id,
        senderId: currentUserId,
        recipientId,
        text: content,
        messageType: 'location',
      });
    } catch (err) {
      console.log('Location error:', err);
      Alert.alert('Lỗi', 'Không thể lấy vị trí hiện tại.');
    }
  }, [socket, currentUserId, id, recipientId, setMessages]);

  const handleSendContact = useCallback((contactInfo: any) => {
    if (!socket || !currentUserId) return;

    const tempId = `pending-contact-${Date.now()}`;
    const content = JSON.stringify(contactInfo);

    const tempMsg: Message = {
      _id: tempId,
      senderId: currentUserId,
      recipientId: recipientId as string,
      content,
      messageType: 'contact',
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    setMessages(prev => [tempMsg, ...prev]);

    socket.emit('send_message', {
      tempId,
      conversationId: id,
      senderId: currentUserId,
      recipientId,
      text: '[Danh thiếp]',
      content,
      messageType: 'contact',
    });
  }, [socket, currentUserId, id, recipientId, setMessages]);

  const handleSendReminder = useCallback(() => {
    if (!socket || !currentUserId) return;
    if (!reminderText.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập nội dung nhắc hẹn.');
      return;
    }

    const tempId = `pending-reminder-${Date.now()}`;
    const content = JSON.stringify({
      text: reminderText.trim(),
      reminderTime: reminderDate.toISOString(),
    });

    const tempMsg: Message = {
      _id: tempId,
      senderId: currentUserId,
      recipientId: recipientId as string,
      content,
      messageType: 'reminder',
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    setMessages(prev => [tempMsg, ...prev]);

    socket.emit('send_message', {
      tempId,
      conversationId: id,
      senderId: currentUserId,
      recipientId,
      text: content,
      messageType: 'reminder',
    });

    setShowReminderModal(false);
    setReminderText('');
    setReminderDate(new Date(Date.now() + 3600000));
  }, [socket, currentUserId, id, recipientId, reminderText, reminderDate, setMessages, setShowReminderModal, setReminderText, setReminderDate]);

  return {
    handleSend,
    sendSticker,
    handleRevoke,
    handleDeleteMessage,
    handleTogglePinMessage,
    handleTranslate,
    handleSendLocation,
    handleSendContact,
    handleSendReminder,
    translatingId,
    translatedMessages,
  };
}

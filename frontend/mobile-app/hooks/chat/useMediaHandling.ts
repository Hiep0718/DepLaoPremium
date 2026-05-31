import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Socket } from 'socket.io-client';
import apiClient from '@/constants/api';
import { Message } from '@/types/chat';

interface UseMediaHandlingProps {
  socket: Socket | null;
  currentUserId: string | null;
  id: string; // conversation ID
  recipientId: string | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  replyingMessage: Message | null;
  setReplyingMessage: React.Dispatch<React.SetStateAction<Message | null>>;
}

export function useMediaHandling({
  socket,
  currentUserId,
  id,
  recipientId,
  setMessages,
  replyingMessage,
  setReplyingMessage,
}: UseMediaHandlingProps) {
  const [pendingMedia, setPendingMedia] = useState<{ uri: string; type: 'image' | 'video', base64?: string | null }[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Quyền truy cập', 'Cần cấp quyền truy cập Thư viện ảnh');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 0.8,
      videoMaxDuration: 300,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      orderedSelection: true,
      base64: true, // Thêm dòng này để lấy base64 trực tiếp
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const items = result.assets.map(asset => ({
        uri: asset.uri,
        type: (asset.type === 'video' ? 'video' : 'image') as 'image' | 'video',
        base64: asset.base64, // Lưu trữ base64
      }));
      setPendingMedia(items);
    }
  };

  const handleRemovePendingMedia = (index: number) => {
    setPendingMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMedia = async () => {
    if (pendingMedia.length === 0 || !socket || !currentUserId) return;
    setUploadingMedia(true);
    setUploadProgress(0);

    const totalItems = pendingMedia.length;
    let successCount = 0;
    let failCount = 0;

    const replyData = replyingMessage ? {
      messageId: replyingMessage._id,
      content: replyingMessage.content,
      senderId: replyingMessage.senderId,
      messageType: replyingMessage.messageType || 'text',
    } : undefined;

    const token = await AsyncStorage.getItem('accessToken');

    for (let i = 0; i < totalItems; i++) {
      const media = pendingMedia[i];
      try {
        const formData = new FormData();
        const isVideo = media.type === 'video';
        const ext = isVideo ? 'mp4' : 'jpg';
        const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';
        formData.append('file', {
          uri: media.uri,
          name: `chat-${Date.now()}-${i}.${ext}`,
          type: mimeType,
        } as any);

        const res = await apiClient.post('/upload/chat', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          timeout: 0,
        });

        const uploadData = res.data?.data;
        if (uploadData?.url) {
          const tempId = `pending-media-${Date.now()}-${i}`;
          const msgType = uploadData.messageType || media.type;
          const contentLabel = isVideo ? '[Video]' : '[Hình ảnh]';

          const tempMsg: Message = {
            _id: tempId,
            senderId: currentUserId,
            recipientId: recipientId as string,
            content: contentLabel,
            messageType: msgType,
            fileUrl: uploadData.url,
            fileName: uploadData.fileName,
            fileSize: uploadData.fileSize,
            imageUrl: !isVideo ? uploadData.url : undefined,
            createdAt: new Date().toISOString(),
            status: 'pending',
            replyTo: i === 0 ? replyData : undefined,
          };
          setMessages(prev => [tempMsg, ...prev]);
          socket.emit('send_message', {
            conversationId: id,
            senderId: currentUserId,
            recipientId,
            tempId,
            text: contentLabel,
            messageType: msgType,
            fileUrl: uploadData.url,
            fileName: uploadData.fileName,
            fileSize: uploadData.fileSize,
            replyTo: i === 0 ? replyData : undefined,
          });
          successCount++;
        } else {
          failCount++;
        }
      } catch (err: any) {
        console.log(`Media upload error [${i + 1}/${totalItems}]:`, err?.message || err);
        failCount++;
      }
      setUploadProgress(i + 1);
    }

    if (failCount > 0 && successCount > 0) {
      Alert.alert('Thông báo', `Đã gửi ${successCount}/${totalItems} ảnh. ${failCount} ảnh gửi thất bại.`);
    } else if (failCount > 0 && successCount === 0) {
      Alert.alert('Lỗi', 'Không thể gửi ảnh. Vui lòng thử lại.');
    }

    setReplyingMessage(null);
    setUploadingMedia(false);
    setUploadProgress(0);
    setPendingMedia([]);
  };

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (!socket || !currentUserId) return;

      setUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          name: asset.name || `file_${Date.now()}`,
          type: asset.mimeType || 'application/octet-stream',
        } as any);

        const res = await apiClient.post('/upload/chat', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        });

        const uploadData = res.data?.data;
        if (uploadData?.url) {
          const tempId = `pending-file-${Date.now()}`;
          const fileName = uploadData.fileName || asset.name || 'File';
          const fileSize = uploadData.fileSize || asset.size || 0;
          const msgType = uploadData.messageType || 'file';

          const tempMsg: Message = {
            _id: tempId,
            senderId: currentUserId,
            recipientId: recipientId as string,
            content: `[Tệp] ${fileName}`,
            messageType: msgType,
            fileUrl: uploadData.url,
            fileName,
            fileSize,
            createdAt: new Date().toISOString(),
            status: 'pending',
          };
          setMessages(prev => [tempMsg, ...prev]);

          socket.emit('send_message', {
            tempId,
            conversationId: id,
            senderId: currentUserId,
            recipientId,
            text: `[Tệp] ${fileName}`,
            messageType: msgType,
            fileUrl: uploadData.url,
            fileName,
            fileSize,
          });
        } else {
          Alert.alert('Lỗi', 'Không thể tải lên tệp.');
        }
      } catch (err) {
        console.log('File upload error:', err);
        Alert.alert('Lỗi', 'Không thể gửi tệp. Vui lòng thử lại.');
      } finally {
        setUploadingFile(false);
      }
    } catch (err) {
      console.log('Document picker error:', err);
    }
  }, [socket, currentUserId, id, recipientId, setMessages]);

  return {
    pendingMedia,
    setPendingMedia,
    uploadingMedia,
    uploadProgress,
    uploadingFile,
    handlePickImage,
    handleRemovePendingMedia,
    handleSendMedia,
    handlePickDocument,
  };
}

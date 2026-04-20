import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';
import { Socket } from 'socket.io-client';
import apiClient from '@/constants/api';
import { Message } from '@/types/chat';

interface UseVoiceRecordingProps {
  socket: Socket | null;
  currentUserId: string | null;
  id: string; // conversation ID
  recipientId: string | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export function useVoiceRecording({
  socket,
  currentUserId,
  id,
  recipientId,
  setMessages,
}: UseVoiceRecordingProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Cần cấp quyền sử dụng Microphone.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.log('Start recording error:', err);
      Alert.alert('Lỗi', 'Không thể bắt đầu ghi âm.');
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    try {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
    } catch {}
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const stopAndSendRecording = useCallback(async () => {
    if (!recordingRef.current || !socket || !currentUserId) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) return;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: `voice_${Date.now()}.m4a`,
        type: 'audio/m4a',
      } as any);

      const res = await apiClient.post('/upload/chat', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      const uploadData = res.data?.data;
      if (uploadData?.url) {
        const tempId = `pending-voice-${Date.now()}`;
        const tempMsg: Message = {
          _id: tempId,
          senderId: currentUserId,
          recipientId: recipientId as string,
          content: '[Tin nhắn thoại]',
          messageType: 'audio',
          fileUrl: uploadData.url,
          createdAt: new Date().toISOString(),
          status: 'pending',
        };
        setMessages(prev => [tempMsg, ...prev]);
        socket.emit('send_message', {
          tempId,
          conversationId: id,
          senderId: currentUserId,
          recipientId,
          text: '[Tin nhắn thoại]',
          messageType: 'audio',
          fileUrl: uploadData.url,
          fileName: uploadData.fileName,
          fileSize: uploadData.fileSize,
        });
      } else {
        Alert.alert('Lỗi', 'Không thể tải lên tin nhắn thoại.');
      }
    } catch (err) {
      console.log('Voice message send error:', err);
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn thoại.');
    }
  }, [socket, currentUserId, id, recipientId, setMessages]);

  return {
    isRecording,
    recordingTime,
    startRecording,
    cancelRecording,
    stopAndSendRecording,
  };
}

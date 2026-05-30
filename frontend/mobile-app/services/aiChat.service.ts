import { AI_BASE_URL, aiChatApiClient } from '../constants/aiChatApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lấy lịch sử chat của user với AI
 */
export const fetchAiMessages = async (userId: string) => {
  try {
    const res = await aiChatApiClient.get(`/messages/${userId}`);
    return res.data?.data || [];
  } catch (error) {
    console.log('Error fetching AI messages:', error);
    return [];
  }
};

/**
 * Xóa toàn bộ lịch sử chat AI
 */
export const clearAiHistory = async (userId: string) => {
  try {
    const res = await aiChatApiClient.delete(`/history/${userId}`);
    return res.data?.success;
  } catch (error) {
    console.log('Error clearing AI history:', error);
    throw error;
  }
};

/**
 * Lấy tin nhắn cuối cùng (cho màn hình danh sách cuộc trò chuyện)
 */
export const fetchAiLastMessage = async (userId: string) => {
  try {
    const res = await aiChatApiClient.get(`/last-message/${userId}`);
    if (res.data?.success) {
      return { exists: res.data.exists, ...res.data.data };
    }
    return null;
  } catch (error) {
    console.log('Error fetching AI last message:', error);
    return null;
  }
};

/**
 * Hàm gửi tin nhắn AI và nhận Stream qua XMLHttpRequest (tương thích trên React Native)
 * Hỗ trợ gửi kèm ảnh (imageBase64) cùng text trong 1 request
 */
export const streamAiChatMobile = async (
  userId: string,
  content: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
  imageBase64?: string,
  imageMimeType?: string
) => {
  const token = await AsyncStorage.getItem('accessToken');
  
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${AI_BASE_URL}/chat`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    let seenBytes = 0;

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.LOADING || xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status >= 400 && xhr.readyState === XMLHttpRequest.DONE) {
          onError('Lỗi từ máy chủ AI: ' + xhr.status);
          reject(new Error('AI Request failed'));
          return;
        }

        const newData = xhr.responseText.substring(seenBytes);
        if (newData) {
          seenBytes = xhr.responseText.length;
          const lines = newData.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            
            try {
              const json = JSON.parse(trimmed.slice(5).trim());
              if (json.error) {
                onError(json.error);
                reject(new Error(json.error));
                return;
              }
              if (json.token) {
                onToken(json.token);
              }
              if (json.done) {
                onDone();
                resolve();
                return;
              }
            } catch (e) {
              // chunk không hoàn chỉnh, chờ chunk tiếp
            }
          }
        }
      }

      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          // Check if done wasn't explicitly caught in stream
          onDone();
          resolve();
        } else {
          onError('Không thể kết nối đến AI. Vui lòng thử lại.');
          reject(new Error('Request failed'));
        }
      }
    };

    xhr.onerror = () => {
      onError('Không thể kết nối mạng đến AI.');
      reject(new Error('Network error'));
    };

    xhr.send(JSON.stringify({ userId, content, imageBase64, imageMimeType }));
  });
};

import axios from 'axios';

// Axios instance riêng cho Node.js Messaging Service
const messagingApi = axios.create({
  baseURL: import.meta.env.VITE_SOCKET_URL
    ? `${import.meta.env.VITE_SOCKET_URL}/api/messages`
    : 'http://localhost:3001/api/messages',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor gắn token cho messaging API
messagingApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const getConversationsList = async (userId: string) => {
  return messagingApi.get(`/conversations/${userId}`);
};

export const getConversationHistory = async (conversationId: string, page = 1, limit = 50) => {
  return messagingApi.get(`/conversation/${conversationId}?page=${page}&limit=${limit}`);
};

export const createConversation = async (participants: string[], isGroup = false) => {
  return messagingApi.post('/conversation', {
    participants,
    isGroup,
  });
};

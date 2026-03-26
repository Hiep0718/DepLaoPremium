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
    const token = sessionStorage.getItem('accessToken');
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
  // Generate a deterministic or random conversation UUID
  // Or simply let backend use it, but since backend requires it we construct one.
  const conversationId = isGroup 
    ? `group_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    : `1on1_${participants.sort().join('_')}`;

  return messagingApi.post('/conversation', {
    conversationId,
    participants,
    isGroup,
  });
};

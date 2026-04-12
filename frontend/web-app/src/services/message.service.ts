import axios from 'axios';

// Axios instance riêng cho Node.js Messaging Service
const messagingApi = axios.create({
  baseURL: '/api/messages',
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

export const getConversationHistory = async (conversationId: string, userId: string, page = 1, limit = 50) => {
  return messagingApi.get(`/conversation/${conversationId}?userId=${userId}&page=${page}&limit=${limit}`);
};

export const createConversation = async (participants: string[], isGroup = false, groupName?: string, creatorId?: string) => {
  const conversationId = isGroup 
    ? `group_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    : `1on1_${participants.sort().join('_')}`;

  return messagingApi.post('/conversation', {
    conversationId,
    participants,
    isGroup,
    ...(groupName ? { groupName } : {}),
    ...(creatorId ? { creatorId } : {}),
  });
};

export const markConversationAsRead = async (conversationId: string, userId: string) => {
  return messagingApi.put(`/conversations/${conversationId}/read`, { userId });
};

export const deleteConversationHistory = async (conversationId: string, userId: string) => {
  return messagingApi.delete(`/conversations/${conversationId}/history`, {
    data: { userId }
  });
};

export const updateMemberRole = async (
  conversationId: string,
  requesterId: string,
  targetUserId: string,
  newRole: 'leader' | 'deputy' | 'member'
) => {
  return messagingApi.put(`/conversations/${conversationId}/role`, {
    requesterId,
    targetUserId,
    newRole,
  });
};

export const removeMemberFromGroup = async (
  conversationId: string,
  requesterId: string,
  targetUserId: string
) => {
  return messagingApi.delete(`/conversations/${conversationId}/members`, {
    data: {
      requesterId,
      targetUserId,
    },
  });
};

export const addMembersToGroup = async (
  conversationId: string,
  requesterId: string,
  targetUserIds: string[]
) => {
  return messagingApi.post(`/conversations/${conversationId}/members`, {
    requesterId,
    targetUserIds,
  });
};
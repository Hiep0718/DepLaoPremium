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

export const getConversationHistory = async (conversationId: string, userId: string, page = 1, limit = 50, cursor?: string) => {
  let url = `/conversation/${conversationId}?userId=${userId}&page=${page}&limit=${limit}`;
  if (cursor) {
    url += `&cursor=${cursor}`;
  }
  return messagingApi.get(url);
};

export const searchMessages = async (conversationId: string, query: string) => {
  return messagingApi.get(`/search/${conversationId}?query=${encodeURIComponent(query)}`);
};

export const createConversation = async (participants: string[], isGroup = false, groupName?: string, creatorId?: string, groupAvatar?: string) => {
  const conversationId = isGroup 
    ? `group_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    : `1on1_${participants.sort().join('_')}`;

  return messagingApi.post('/conversation', {
    conversationId,
    participants,
    isGroup,
    ...(groupName ? { groupName } : {}),
    ...(creatorId ? { creatorId } : {}),
    ...(groupAvatar ? { groupAvatar } : {}),
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

export const disbandGroup = async (
  conversationId: string,
  requesterId: string
) => {
  return messagingApi.delete(`/conversations/${conversationId}/disband`, {
    data: {
      requesterId,
    },
  });
};

export const updateGroupInfo = async (
  conversationId: string,
  requesterId: string,
  groupName?: string,
  groupAvatar?: string
) => {
  return messagingApi.put(`/conversations/${conversationId}/info`, {
    requesterId,
    ...(groupName !== undefined ? { groupName } : {}),
    ...(groupAvatar !== undefined ? { groupAvatar } : {}),
  });
};

export const toggleRequireApproval = async (
  conversationId: string,
  requesterId: string,
  requireApproval: boolean
) => {
  return messagingApi.put(`/conversations/${conversationId}/approval-setting`, {
    requesterId,
    requireApproval,
  });
};

export const approvePendingMember = async (
  conversationId: string,
  requesterId: string,
  targetUserIds: string[]
) => {
  return messagingApi.post(`/conversations/${conversationId}/pending/approve`, {
    requesterId,
    targetUserIds,
  });
};

export const rejectPendingMember = async (
  conversationId: string,
  requesterId: string,
  targetUserIds: string[]
) => {
  return messagingApi.post(`/conversations/${conversationId}/pending/reject`, {
    requesterId,
    targetUserIds,
  });
};

export const updateGroupPermissions = async (
  conversationId: string,
  requesterId: string,
  settings: {
    sendMessages?: 'all' | 'admin_only';
    pinAndPolls?: 'all' | 'admin_only';
    changeInfo?: 'all' | 'admin_only';
  }
) => {
  return messagingApi.put(`/conversations/${conversationId}/permissions`, {
    requesterId,
    settings,
  });
};

export const getInviteCode = async (conversationId: string) => {
  return messagingApi.get(`/conversations/${conversationId}/invite`);
};

export const resetInviteCode = async (conversationId: string, requesterId: string) => {
  return messagingApi.post(`/conversations/${conversationId}/invite/reset`, { requesterId });
};

export const joinGroupByInviteCode = async (inviteCode: string, userId: string) => {
  return messagingApi.post(`/join/${inviteCode}`, { userId });
};
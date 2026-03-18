import api from './axios';

export const getConversationsList = async (userId: string) => {
  return api.get(`/messages/conversations/${userId}`);
};

export const getConversationHistory = async (conversationId: string, page = 1, limit = 50) => {
  return api.get(`/messages/conversation/${conversationId}?page=${page}&limit=${limit}`);
};

export const createConversation = async (participants: string[], isGroup = false) => {
  return api.post('/messages/conversation', {
    participants,
    isGroup,
  });
};

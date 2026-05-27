import api from './axios';

export interface AdminStats {
  totalUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  userGrowthChart: { date: string; count: number }[];
}

export interface MessagingStats {
  totalConversations: number;
  totalGroups: number;
  totalDirectChats: number;
  totalMessages: number;
  messagesPerDay: { date: string; count: number }[];
  messageTypes: { type: string; count: number }[];
}

export interface UserItem {
  id: number;
  phone: string;
  fullName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  gender: string | null;
  birthday: string | null;
  role: string;
  isLocked: boolean;
  createdAt: string;
}

export interface PageData<T> {
  content: T[];
  currentPage: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export const adminService = {
  getAdminStats: async (): Promise<AdminStats> => {
    const res = await api.get('/admin/stats');
    return res.data.data;
  },

  getMessagingStats: async (): Promise<MessagingStats> => {
    const res = await api.get('/messages/admin/stats');
    return res.data.data;
  },

  getUsers: async (page = 0, size = 10, search = ''): Promise<PageData<UserItem>> => {
    const params = new URLSearchParams({ page: String(page), size: String(size), direction: 'DESC', sort: 'id' });
    if (search) params.set('search', search);
    const res = await api.get(`/admin/users?${params.toString()}`);
    return res.data.data;
  },

  lockUser: async (userId: number, locked: boolean): Promise<UserItem> => {
    const res = await api.put(`/admin/users/${userId}/lock`, { locked });
    return res.data.data;
  },

  deleteUser: async (userId: number): Promise<void> => {
    await api.delete(`/admin/users/${userId}`);
  },
};

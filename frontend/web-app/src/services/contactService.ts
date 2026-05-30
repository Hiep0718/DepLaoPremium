import axios from './axios';

export interface UserResponse {
  id: number;
  phone: string;
  fullName: string;
  email?: string;
  avatarUrl: string;
  coverUrl: string;
  gender: string;
  birthday: string;
  role: string;
}

export interface ContactResponse {
  id: number;
  contactUserId: number;
  phone: string;
  fullName: string;
  avatarUrl: string;
  nickname: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageResponse<T> {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface UpdateProfileData {
  fullName: string;
  avatarUrl?: string;
  coverUrl?: string;
  gender?: string;
  birthday?: string;
  email?: string;
}

export const contactService = {
  getContacts: async (page = 0, size = 20) => {
    const response = await axios.get<ApiResponse<PageResponse<ContactResponse>>>(`/contacts?page=${page}&size=${size}`);
    return response.data.data;
  },
  
  searchContacts: async (search: string, page = 0, size = 20) => {
    const response = await axios.get<ApiResponse<PageResponse<ContactResponse>>>(`/contacts/search?search=${search}&page=${page}&size=${size}`);
    return response.data.data;
  },
  
  addContact: async (phone: string, nickname?: string) => {
    const response = await axios.post<ApiResponse<ContactResponse>>('/contacts', { phone, nickname });
    return response.data;
  },
  
  getUserProfile: async () => {
    const response = await axios.get<ApiResponse<UserResponse>>('/users/profile');
    return response.data.data;
  },
  
  updateUserProfile: async (data: UpdateProfileData) => {
    const response = await axios.put<ApiResponse<UserResponse>>('/users/profile', data);
    return response.data.data;
  },

  /**
   * Upload file (avatar or cover) to S3 via backend
   * @param file File object from input
   * @param type 'avatar' | 'cover'
   * @returns URL of uploaded file
   */
  uploadFile: async (file: File, type: 'avatar' | 'cover'): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post<ApiResponse<{ url: string }>>(`/upload/${type}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data.url;
  },

  // ================= FRIEND REQUEST =================
  sendFriendRequest: async (phone: string, message?: string) => {
    const response = await axios.post<ApiResponse<FriendRequestResponse>>('/contacts/requests', { phone, message });
    return response.data;
  },

  getPendingRequests: async (page = 0, size = 20) => {
    const response = await axios.get<ApiResponse<PageResponse<FriendRequestResponse>>>(`/contacts/requests/pending?page=${page}&size=${size}`);
    return response.data.data;
  },

  getSentRequests: async (page = 0, size = 20) => {
    const response = await axios.get<ApiResponse<PageResponse<FriendRequestResponse>>>(`/contacts/requests/sent?page=${page}&size=${size}`);
    return response.data.data;
  },

  acceptFriendRequest: async (requestId: number) => {
    const response = await axios.post<ApiResponse<any>>(`/contacts/requests/${requestId}/accept`);
    return response.data;
  },

  rejectFriendRequest: async (requestId: number) => {
    const response = await axios.post<ApiResponse<any>>(`/contacts/requests/${requestId}/reject`);
    return response.data;
  },

  cancelFriendRequest: async (requestId: number) => {
    const response = await axios.delete<ApiResponse<any>>(`/contacts/requests/${requestId}/cancel`);
    return response.data;
  }
};

export interface FriendRequestResponse {
  id: number;
  sender: UserResponse;
  receiver: UserResponse;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  message: string;
  createdAt: string;
  updatedAt: string;
}

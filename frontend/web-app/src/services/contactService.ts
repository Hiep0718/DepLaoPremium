import axios from './axios';

export interface UserResponse {
  id: number;
  phone: string;
  fullName: string;
  avatarUrl: string;
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

export const contactService = {
  getContacts: async (page = 0, size = 20) => {
    const response = await axios.get<ApiResponse<PageResponse<ContactResponse>>>(`/contacts?page=${page}&size=${size}`);
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
  
  updateUserProfile: async (data: { fullName: string; avatarUrl: string }) => {
    const response = await axios.put<ApiResponse<UserResponse>>('/users/profile', data);
    return response.data.data;
  }
};

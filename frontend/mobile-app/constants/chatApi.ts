import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_IP } from './api';

const NODE_PORT = __DEV__ ? ':3001' : '';
export const NODE_BASE_URL = `http://${API_IP}${NODE_PORT}/api/messages`;
export const SOCKET_URL = `ws://${API_IP}${NODE_PORT}`;

export const chatApiClient = axios.create({
  baseURL: NODE_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Interceptor nạp Token vào mỗi Request gửi đến Node.js
chatApiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log('Error getting token for chatApi', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor xử lý lỗi trả về (VD: 403, 401 do token hết hạn/lỗi)
chatApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log("Phiên đăng nhập hết hạn hoặc bị lỗi (Chat API), đang tự động đăng xuất...");
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'userId']);
      const { router } = require('expo-router');
      router.replace("/login");
    }
    return Promise.reject(error);
  }
);

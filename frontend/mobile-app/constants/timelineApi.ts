import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_IP } from './api';

const NODE_PORT = __DEV__ ? ':3001' : '';
export const TIMELINE_BASE_URL = `http://${API_IP}${NODE_PORT}/api`;

export const timelineApiClient = axios.create({
  baseURL: TIMELINE_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Interceptor nạp Token vào mỗi Request gửi đến Node.js
timelineApiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log('Error getting token for timelineApi', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor xử lý lỗi trả về
timelineApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log("Phiên đăng nhập hết hạn hoặc bị lỗi (Timeline API), đang tự động đăng xuất...");
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'userId']);
      const { router } = require('expo-router');
      router.replace("/login");
    }
    return Promise.reject(error);
  }
);

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_IP } from './api';

const AI_PORT = __DEV__ ? ':3002' : '';
const PROTOCOL = __DEV__ ? 'http://' : 'https://';
export const AI_BASE_URL = `${PROTOCOL}${API_IP}${AI_PORT}/api/ai-chat`;

export const aiChatApiClient = axios.create({
  baseURL: AI_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Interceptor nạp Token vào mỗi Request gửi đến AI Service
aiChatApiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log('Error getting token for aiChatApi', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

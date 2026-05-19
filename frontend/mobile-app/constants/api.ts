import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Tự động Lấy IP của máy dev khi chạy qua Expo (hoạt động tốt trên cùng mạng Wi-Fi)
const getLocalIp = () => {
  if (__DEV__) {
    // Lấy uri máy chủ Expo đang chạy: VD "192.168.1.110:8081"
    const hostUri = Constants.expoConfig?.hostUri; 
    if (hostUri) {
      return hostUri.split(':')[0];
    }
  }
  return '192.168.1.110'; // Fallback nếu không xác định được hoặc khi build production
};

export const API_IP = getLocalIp();

const API_PORT = '8082'; // Port mặc định của Spring Boot API
const BASE_URL = `http://${API_IP}:${API_PORT}/api`;

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Interceptor nạp Token vào mỗi Request
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log('Error getting token', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor xử lý lỗi trả về (VD: 403, 401 do token hết hạn/lỗi)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log("Phiên đăng nhập hết hạn hoặc bị lỗi, đang tự động đăng xuất...");
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'userId']);
      // Nếu bạn muốn tự động quay về trang login, có thể dùng router từ expo-router
      const { router } = require('expo-router');
      router.replace("/login");
    }
    return Promise.reject(error);
  }
);

export default apiClient;

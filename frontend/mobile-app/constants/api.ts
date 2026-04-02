import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 💡 LƯU Ý CHO DEVELOPER (IP CONFIGURATION):
// Nếu bạn chạy trên máy giả lập hoặc máy thật, sử dụng IP thật nội bộ (IPv4 của máy tính) thay cho localhost.
// Mở CMD/Terminal gõ `ipconfig` -> Coppy dòng IPv4 Address (Ví dụ: 192.168.1.x) và đổi vào dưới đây:
const API_IP = '192.168.1.110'; // <-- Đã sửa đúng IP máy tính của bạn

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

export default apiClient;

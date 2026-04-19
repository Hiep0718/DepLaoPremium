import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: attach access token to every request
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Auto Refresh Token Logic ---
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only handle 401 errors (token expired) and avoid infinite loops
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = sessionStorage.getItem('refreshToken');
      const currentAccessToken = sessionStorage.getItem('accessToken');

      // No refresh token available → force logout
      if (!refreshToken) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // If the token in sessionStorage is different from the one in this failed request,
      // it means another request has already successfully refreshed the token.
      // We can just retry with the new token.
      const requestAuthHeader = originalRequest.headers['Authorization'] || (originalRequest.headers.get && originalRequest.headers.get('Authorization'));
      
      // Only skip refresh if we extracted a valid header AND it differs from the current storage.
      if (currentAccessToken && requestAuthHeader && requestAuthHeader !== `Bearer ${currentAccessToken}`) {
        originalRequest.headers['Authorization'] = `Bearer ${currentAccessToken}`;
        return api(originalRequest);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        // Call Spring Boot refresh endpoint
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        if (data.success && data.data?.accessToken) {
          const newAccessToken = data.data.accessToken;
          const newRefreshToken = data.data.refreshToken;

          // Update stored tokens
          sessionStorage.setItem('accessToken', newAccessToken);
          if (newRefreshToken) {
            sessionStorage.setItem('refreshToken', newRefreshToken);
          }

          // Update zustand store token safely
          const store = useAuthStore.getState();
          if (store.user) {
            try {
              store.setAuth(store.user, newAccessToken);
            } catch (e) {
              console.warn('Failed to update auth store:', e);
            }
          }

          // Process queued requests with new token
          processQueue(null, newAccessToken);

          // Retry the original failed request
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } else {
          // Token refresh returned success=false
          processQueue(error, null);
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(error);
        }
      } catch (refreshError) {
        // Refresh request itself failed (e.g. 400 Bad Request, invalid refresh token)
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

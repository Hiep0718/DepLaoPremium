import axios from 'axios';

// This service talks directly to the Spring Boot API for file uploads
const SPRING_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/**
 * Upload a chat file (image, video, or document) to S3 via Spring Boot
 * Returns { url, messageType, fileName, fileSize }
 */
export const uploadChatFile = async (file: File): Promise<{
  url: string;
  messageType: 'image' | 'video' | 'file';
  fileName: string;
  fileSize: number;
}> => {
  const formData = new FormData();
  formData.append('file', file);

  const token = sessionStorage.getItem('accessToken');

  const res = await axios.post(`${SPRING_API_URL}/upload/chat`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.data?.success && res.data?.data) {
    return res.data.data;
  }

  throw new Error(res.data?.message || 'Upload failed');
};

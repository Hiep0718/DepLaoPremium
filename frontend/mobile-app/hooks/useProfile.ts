import { useState, useEffect, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import apiClient from '@/constants/api';

export interface UserProfile {
  id: string;
  fullName: string;
  phone: string;
  avatarUrl?: string;
  coverUrl?: string;
  gender?: string;
  birthday?: string;
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);

  // ─── Tải thông tin hồ sơ ──────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/users/profile');
      setProfile(res.data?.data);
    } catch (e) {
      console.log('Lỗi tải hồ sơ:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, []);

  // ─── Cập nhật thông tin cơ bản (tên, ngày sinh, giới tính) ───────
  const updateProfile = async (data: Partial<UserProfile>) => {
    try {
      const res = await apiClient.put('/users/profile', {
        fullName: data.fullName ?? profile?.fullName,
        avatarUrl: data.avatarUrl ?? profile?.avatarUrl,
        coverUrl: data.coverUrl ?? profile?.coverUrl,
        gender: data.gender ?? profile?.gender,
        birthday: data.birthday ?? profile?.birthday,
      });
      setProfile(res.data?.data);
      return true;
    } catch (e) {
      Alert.alert('Lỗi', 'Cập nhật hồ sơ thất bại');
      return false;
    }
  };

  // ─── Upload ảnh qua FormData → lấy URL → cập nhật profile ────────
  const pickAndUpload = async (type: 'avatar' | 'cover') => {
    // Hiện ActionSheet chọn nguồn ảnh
    Alert.alert('Chọn ảnh', '', [
      {
        text: 'Chụp ảnh mới',
        onPress: () => _launch(type, 'camera'),
      },
      {
        text: 'Chọn từ thư viện',
        onPress: () => _launch(type, 'library'),
      },
      { text: 'Hủy', style: 'cancel' },
    ]);
  };

  const _launch = async (type: 'avatar' | 'cover', source: 'camera' | 'library') => {
    try {
      let result: ImagePicker.ImagePickerResult;

      const options: ImagePicker.ImagePickerOptions = {
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : [3, 1],
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      };

      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Quyền truy cập', 'Cần cấp quyền sử dụng Máy ảnh');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Quyền truy cập', 'Cần cấp quyền truy cập Thư viện ảnh');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setUploading(type);

      // Đóng gói FormData
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: `${type}-${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);

      // Upload lên /api/upload/avatar hoặc /api/upload/cover
      const uploadRes = await apiClient.post(`/upload/${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newUrl: string = uploadRes.data?.data?.url;

      if (newUrl) {
        // Lưu URL vào profile
        const field = type === 'avatar' ? 'avatarUrl' : 'coverUrl';
        await updateProfile({ [field]: newUrl });
      }
    } catch (e: any) {
      // Phân biệt lỗi S3 chưa cấu hình vs lỗi mạng thông thường
      const serverMsg: string = e?.response?.data?.message ?? '';
      if (
        serverMsg.includes('S3 chưa được cấu hình') ||
        serverMsg.includes('chưa được cấu hình') ||
        e?.response?.status === 500
      ) {
        Alert.alert(
          '⚠️ Chưa có nơi lưu trữ ảnh',
          'Hệ thống chưa được cấu hình kho lưu trữ ảnh (AWS S3). Vui lòng liên hệ quản trị viên để thiết lập.',
          [{ text: 'Đã hiểu', style: 'default' }]
        );
      } else {
        Alert.alert('Lỗi', 'Tải ảnh lên thất bại, thử lại sau');
      }
      console.log('Upload error:', e?.response?.data ?? e);
    } finally {
      setUploading(null);
    }
  };

  return { profile, loading, uploading, fetchProfile, updateProfile, pickAndUpload };
}

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useSocket } from '@/contexts/SocketContext';
import apiClient from '@/constants/api';
import { timelineApiClient } from '@/constants/timelineApi';

export default function CreateStoryScreen() {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const { currentUserId } = useSocket();
  const router = useRouter();

  const handlePickMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setIsUploading(true);
        const asset = result.assets[0];
        
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          name: `story-${Date.now()}.jpg`,
          type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        } as any);

        try {
          const uploadRes = await apiClient.post('/upload', formData);
          if (uploadRes.data?.data?.url) {
            setMediaUrl(uploadRes.data.data.url);
          }
        } catch (e) {
          console.log('Error uploading story media', e);
          Alert.alert('Lỗi', 'Không thể tải ảnh/video lên');
        } finally {
          setIsUploading(false);
        }
      }
    } catch (e) {
      console.log('Error picking media', e);
      setIsUploading(false);
    }
  };

  const handlePostStory = async () => {
    if (!mediaUrl) {
      Alert.alert('Thông báo', 'Vui lòng chọn ảnh hoặc video');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Lỗi', 'Không xác định được người dùng');
      return;
    }

    try {
      setIsUploading(true);
      const res = await timelineApiClient.post('/stories', {
        authorId: currentUserId,
        mediaUrl,
        mediaType: 'image' // Simplified for now
      });

      if (res.data?.success) {
        Alert.alert('Thành công', 'Đã đăng trạng thái 24h');
        router.back();
      } else {
        Alert.alert('Lỗi', 'Không thể đăng trạng thái');
      }
    } catch (error: any) {
      console.log('Error posting story', error);
      Alert.alert('Lỗi', error.response?.data?.message || 'Có lỗi xảy ra khi đăng trạng thái');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo Story</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={handlePickMedia}>
          <Ionicons name="images-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {mediaUrl ? (
          <Image source={{ uri: mediaUrl }} style={styles.preview} resizeMode="cover" />
        ) : (
          <TouchableOpacity style={styles.placeholder} onPress={handlePickMedia}>
            <Ionicons name="camera-outline" size={64} color="#666" />
            <Text style={styles.placeholderText}>Nhấn để chọn ảnh/video</Text>
          </TouchableOpacity>
        )}
      </View>

      {mediaUrl && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.postBtn} 
            onPress={handlePostStory}
            disabled={isUploading}
          >
            <Ionicons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.postBtnText}>Đăng lên trạng thái</Text>
          </TouchableOpacity>
        </View>
      )}

      {isUploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Đang xử lý...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    marginTop: 12,
    fontSize: 16,
  },
  footer: {
    padding: 20,
  },
  postBtn: {
    backgroundColor: '#0068FF',
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#fff',
    fontWeight: 'bold',
  }
});

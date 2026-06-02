import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useSocket } from '@/contexts/SocketContext';
import apiClient from '@/constants/api';
import { timelineApiClient } from '@/constants/timelineApi';
import { ZaloColors } from '@/constants/zalo';

const { width } = Dimensions.get('window');

export default function CreatePostScreen() {
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [userInfo, setUserInfo] = useState<{ fullName: string, avatarUrl: string } | null>(null);
  
  const { currentUserId } = useSocket();
  const router = useRouter();

  useEffect(() => {
    if (currentUserId) {
      apiClient.get(`/users/${currentUserId}`).then(res => {
        if (res.data?.data) {
          setUserInfo({
            fullName: res.data.data.fullName || res.data.data.nickname || 'Bạn',
            avatarUrl: res.data.data.avatarUrl || 'https://via.placeholder.com/150'
          });
        }
      }).catch(err => console.log('Error fetching user info in create-post', err));
    }
  }, [currentUserId]);

  const handlePickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        setIsUploading(true);
        const uploadedUrls: string[] = [];
        
        for (const asset of result.assets) {
          const formData = new FormData();
          formData.append('file', {
            uri: asset.uri,
            name: `post-${Date.now()}.jpg`,
            type: 'image/jpeg',
          } as any);

          try {
            const uploadRes = await apiClient.post('/upload', formData);
            if (uploadRes.data?.data?.url) {
              uploadedUrls.push(uploadRes.data.data.url);
            }
          } catch (e) {
            console.log('Error uploading image', e);
          }
        }

        if (uploadedUrls.length > 0) {
          setImages([...images, ...uploadedUrls]);
        } else {
          Alert.alert('Lỗi', 'Không thể tải ảnh lên');
        }
        setIsUploading(false);
      }
    } catch (e) {
      console.log('Error picking image', e);
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages(images.filter((_, index) => index !== indexToRemove));
  };

  const handlePost = async () => {
    if (!content.trim() && images.length === 0) {
      Alert.alert('Thông báo', 'Vui lòng nhập nội dung hoặc chọn ảnh');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Lỗi', 'Không xác định được người dùng');
      return;
    }

    try {
      setIsUploading(true);
      const res = await timelineApiClient.post('/posts', {
        authorId: currentUserId,
        content: content.trim(),
        images
      });

      if (res.data?.success) {
        Alert.alert('Thành công', 'Đã đăng bài viết mới');
        router.back();
      } else {
        Alert.alert('Lỗi', 'Không thể đăng bài viết');
      }
    } catch (error: any) {
      console.log('Error posting', error);
      Alert.alert('Lỗi', error.response?.data?.message || 'Có lỗi xảy ra khi đăng bài');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo bài viết</Text>
        <TouchableOpacity 
          style={[styles.postBtn, (!content.trim() && images.length === 0) ? styles.postBtnDisabled : null]} 
          onPress={handlePost}
          disabled={(!content.trim() && images.length === 0) || isUploading}
        >
          <Text style={styles.postBtnText}>ĐĂNG</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info Row */}
        <View style={styles.userInfoRow}>
          <Image source={{ uri: userInfo?.avatarUrl || 'https://via.placeholder.com/150' }} style={styles.avatar} />
          <View>
            <Text style={styles.userName}>{userInfo?.fullName || 'Người dùng'}</Text>
            <View style={styles.privacyPill}>
              <Ionicons name="earth" size={12} color="#666" style={{ marginRight: 4 }} />
              <Text style={styles.privacyText}>Tất cả bạn bè</Text>
              <Ionicons name="chevron-down" size={12} color="#666" style={{ marginLeft: 4 }} />
            </View>
          </View>
        </View>

        <TextInput
          style={[styles.input, images.length > 0 && { minHeight: 60 }]}
          placeholder="Bạn đang nghĩ gì?"
          placeholderTextColor="#888"
          multiline
          autoFocus
          value={content}
          onChangeText={setContent}
        />

        {images.length > 0 && (
          <View style={images.length > 1 ? styles.multiImageGrid : styles.singleImageGrid}>
            {images.map((img, index) => (
              <View key={index} style={images.length === 1 ? styles.singleImageWrapper : styles.multiImageWrapper}>
                <Image source={{ uri: img }} style={styles.previewImage} resizeMode="cover" />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => handleRemoveImage(index)}>
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handlePickImages}>
          <Ionicons name="image" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="videocam" size={24} color="#E91E63" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="location" size={24} color="#FF9800" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="at" size={24} color="#0068FF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {isUploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0068FF" />
          <Text style={styles.loadingText}>Đang xử lý...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  postBtn: {
    backgroundColor: '#0068FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnDisabled: {
    backgroundColor: '#e8f0fe',
  },
  postBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  privacyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  privacyText: {
    fontSize: 12,
    color: '#666',
  },
  input: {
    fontSize: 20,
    minHeight: 120,
    textAlignVertical: 'top',
    color: '#000',
  },
  singleImageGrid: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  multiImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginHorizontal: -2, // To offset the wrapper margin
  },
  singleImageWrapper: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  multiImageWrapper: {
    width: (width - 32) / 2 - 4, // 2 columns minus padding/margins
    aspectRatio: 1,
    position: 'relative',
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  actionBtn: {
    marginRight: 20,
    padding: 4,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#0068FF',
    fontWeight: 'bold',
  }
});

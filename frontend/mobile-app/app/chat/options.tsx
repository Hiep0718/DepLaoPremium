import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Alert, ActivityIndicator, Modal, TextInput, Linking, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ZaloColors } from '@/constants/zalo';
import AddMemberModal from '@/components/chat/AddMemberModal';
import CreatePollModal from '@/components/chat/CreatePollModal';
import CreateGroupModal from '@/components/CreateGroupModal';
import { useSocket } from '@/contexts/SocketContext';
import { chatApiClient } from '@/constants/chatApi';
import apiClient, { API_IP } from '@/constants/api';
import * as ImagePicker from 'expo-image-picker';

export default function ChatOptionsScreen() {
  const router = useRouter();
  const { id, name, avatar, isGroup } = useLocalSearchParams();
  const isCloud = typeof id === 'string' && id.startsWith('cloud_');
  const [showSettings, setShowSettings] = useState(false);
  const [isCloudPinned, setIsCloudPinned] = useState(false);

  useEffect(() => {
    if (isCloud) {
      AsyncStorage.getItem('cloud_pinned').then(val => {
        if (val === 'true') setIsCloudPinned(true);
      }).catch(() => {});
    }
  }, [isCloud]);

  const toggleCloudPin = async (val: boolean) => {
    setIsCloudPinned(val);
    try {
      await AsyncStorage.setItem('cloud_pinned', val ? 'true' : 'false');
    } catch (e) {}
  };

  if (isCloud) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" backgroundColor={ZaloColors.blue} />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', marginLeft: 40 }}>
            <Text style={[styles.headerTitle, { fontSize: 18 }]}>My Documents</Text>
            <Ionicons name="checkmark-circle" size={18} color="#FFB000" />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => Alert.alert('Trợ giúp', 'Hướng dẫn sử dụng My Documents')}>
              <Ionicons name="help-circle-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSettings(true)}>
              <Ionicons name="settings-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {showSettings ? (
          // Settings Interface (Image 2)
          <View style={{ flex: 1, backgroundColor: '#f4f5f7', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}>
            <SafeAreaView edges={['top']} style={{ backgroundColor: ZaloColors.blue }}>
              <View style={styles.header}>
                <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSettings(false)}>
                  <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                  <Text style={[styles.headerTitle, { fontSize: 18, marginLeft: 8 }]}>Cài đặt My Documents</Text>
                </View>
              </View>
            </SafeAreaView>
            
            <View style={{ backgroundColor: '#fff', marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' }}>
                <Text style={{ fontSize: 16, color: '#111' }}>Ghim lên đầu danh sách trò chuyện</Text>
                <Switch 
                  value={isCloudPinned} 
                  onValueChange={toggleCloudPin}
                  trackColor={{ false: '#d1d1d6', true: '#b3d4ff' }}
                  thumbColor={isCloudPinned ? '#0068FF' : '#fff'}
                />
              </View>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ backgroundColor: '#f4f5f7' }} showsVerticalScrollIndicator={false}>
            {/* Circular Folder Icon Section */}
            <View style={{ alignItems: 'center', backgroundColor: '#fff', paddingVertical: 35, paddingHorizontal: 20, marginBottom: 12 }}>
              <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#e8f0fe', justifyContent: 'center', alignItems: 'center', marginBottom: 16, position: 'relative' }}>
                <Ionicons name="folder" size={56} color="#0068FF" />
                <View style={{ position: 'absolute', right: 20, bottom: 20, backgroundColor: '#fff', borderRadius: 12, padding: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1 }}>
                  <Ionicons name="cloud" size={18} color="#0068FF" />
                </View>
                <View style={{ position: 'absolute', right: 4, bottom: 4, backgroundColor: '#fff', borderRadius: 12, padding: 1 }}>
                  <Ionicons name="checkmark-circle" size={22} color="#FFB000" />
                </View>
              </View>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#111', marginBottom: 10 }}>My Documents</Text>
              <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, paddingHorizontal: 30 }}>
                Lưu trữ và truy cập nhanh những nội dung quan trọng của bạn ngay trên Zalo
              </Text>
            </View>

            {/* Capacity Section */}
            <View style={{ backgroundColor: '#fff', padding: 16, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111' }}>Dung lượng</Text>
                <Text style={{ fontSize: 14, color: '#666', fontWeight: '500' }}>30,7 MB / 500 MB</Text>
              </View>
              
              {/* Multi-colored Progress Bar */}
              <View style={{ height: 10, borderRadius: 5, backgroundColor: '#f0f0f0', flexDirection: 'row', overflow: 'hidden', marginBottom: 16 }}>
                <View style={{ width: '6%', backgroundColor: '#ff9800' }} /> {/* Orange for Ảnh */}
                <View style={{ width: '2%', backgroundColor: '#4caf50' }} /> {/* Green for Video */}
                <View style={{ width: '1%', backgroundColor: '#ffeb3b' }} /> {/* Yellow for File */}
              </View>

              {/* Legend dot row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff9800' }} />
                  <Text style={{ fontSize: 13, color: '#666' }}>Ảnh</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4caf50' }} />
                  <Text style={{ fontSize: 13, color: '#666' }}>Video</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffeb3b' }} />
                  <Text style={{ fontSize: 13, color: '#666' }}>File</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#9e9e9e' }} />
                  <Text style={{ fontSize: 13, color: '#666' }}>Khác</Text>
                </View>
              </View>
            </View>

            {/* Upgrade Storage Card */}
            <View style={{ backgroundColor: '#fff', padding: 16, marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 6 }}>Thêm dung lượng với zCloud</Text>
              <Text style={{ fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 16 }}>
                100 GB dành cho My Documents và toàn bộ dữ liệu trò chuyện
              </Text>
              <TouchableOpacity 
                style={{ backgroundColor: '#e8f0fe', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => Alert.alert('Thông báo', 'Chức năng nâng cấp dung lượng zCloud sắp ra mắt!')}
              >
                <Text style={{ color: '#0068FF', fontWeight: '600', fontSize: 15 }}>Thêm dung lượng</Text>
              </TouchableOpacity>
            </View>

            {/* Cleanup Storage Card */}
            <View style={{ backgroundColor: '#fff', padding: 16, marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 6 }}>Dọn dẹp dữ liệu My Documents</Text>
              <Text style={{ fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 16 }}>
                Xóa bớt nội dung không cần thiết để có thêm dung lượng trống
              </Text>
              <TouchableOpacity 
                style={{ backgroundColor: '#f0f0f0', height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => Alert.alert('My Documents', 'My Documents của bạn đang rất gọn gàng!')}
              >
                <Text style={{ color: '#333', fontWeight: '600', fontSize: 15 }}>Xem và dọn dẹp</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  const [isBestFriend, setIsBestFriend] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isCallNotifEnabled, setIsCallNotifEnabled] = useState(true);
  const [isAddMemberVisible, setIsAddMemberVisible] = useState(false);
  const { currentUserId, socket } = useSocket();

  // Group management states
  const [participants, setParticipants] = useState<any[]>([]);
  const [memberMap, setMemberMap] = useState<Record<string, { fullName: string; avatarUrl?: string }>>({});
  const [expandedMembers, setExpandedMembers] = useState(true);
  const [menuOpenUid, setMenuOpenUid] = useState<string | null>(null);
  const [isLoadingGroup, setIsLoadingGroup] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [pendingMemberMap, setPendingMemberMap] = useState<Record<string, { fullName: string; avatarUrl?: string }>>({});
  const [groupSettings, setGroupSettings] = useState<any>(null);
  const [showPollModal, setShowPollModal] = useState(false);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [tempGroupName, setTempGroupName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<any[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isInviteExpanded, setIsInviteExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<any | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [wallpaperModalVisible, setWallpaperModalVisible] = useState(false);
  const [currentWallpaper, setCurrentWallpaper] = useState<string | null>(null);
  const [isNicknameModalVisible, setIsNicknameModalVisible] = useState(false);
  const [tempNickname, setTempNickname] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [displayName, setDisplayName] = useState(String(name || ''));
  const [createGroupVisible, setCreateGroupVisible] = useState(false);
  const [addToGroupVisible, setAddToGroupVisible] = useState(false);
  const [commonGroupsVisible, setCommonGroupsVisible] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [commonGroups, setCommonGroups] = useState<any[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  useEffect(() => {
    if (name) {
      setDisplayName(String(name));
    }
  }, [name]);

  // Load muted state, wallpaper, & pinned state từ AsyncStorage
  useEffect(() => {
    if (id) {
      AsyncStorage.getItem(`muted_${id}`)
        .then(val => {
          setIsMuted(val === 'true');
        })
        .catch(err => console.log('Lỗi khi đọc trạng thái tắt tiếng trong Options:', err));

      AsyncStorage.getItem(`wallpaper_${id}`)
        .then(val => {
          setCurrentWallpaper(val);
        })
        .catch(err => console.log('Lỗi khi đọc hình nền trong Options:', err));

      AsyncStorage.getItem(`pinned_${id}`)
        .then(val => {
          setIsPinned(val === 'true');
        })
        .catch(err => console.log('Lỗi khi đọc trạng thái ghim trong Options:', err));
    }
  }, [id]);

  // Toggle tắt tiếng
  const handleToggleMute = async () => {
    try {
      const newValue = !isMuted;
      setIsMuted(newValue);
      await AsyncStorage.setItem(`muted_${id}`, newValue ? 'true' : 'false');
      Alert.alert('Thông báo', newValue ? 'Đã tắt thông báo cho cuộc hội thoại này.' : 'Đã bật lại thông báo cho cuộc hội thoại này.');
    } catch (e) {
      console.log('Lỗi khi cập nhật trạng thái tắt tiếng:', e);
    }
  };

  // Toggle ghim cuộc trò chuyện
  const handleTogglePin = async (val: boolean) => {
    try {
      setIsPinned(val);
      await chatApiClient.put(`/conversations/${id}/pin`, {
        userId: currentUserId,
        isPinned: val
      });
      await AsyncStorage.setItem(`pinned_${id}`, val ? 'true' : 'false');
    } catch (err: any) {
      console.log('Error toggling pin:', err);
      setIsPinned(!val); // Rollback
      Alert.alert('Lỗi', 'Không thể ghim cuộc trò chuyện: ' + (err.response?.data?.message || err.message));
    }
  };

  // View user profile
  const handleViewProfile = async () => {
    const targetId = recipientId || id;
    if (!targetId || typeof targetId !== 'string' || targetId.startsWith('cloud_')) {
      Alert.alert('Thông báo', 'Không thể xem trang cá nhân của tài khoản này.');
      return;
    }
    setIsLoadingProfile(true);
    try {
      const res = await apiClient.get(`/users/${targetId}`);
      if (res.data?.data) {
        setSelectedUserProfile(res.data.data);
      } else {
        Alert.alert('Thông báo', 'Không tìm thấy thông tin người dùng.');
      }
    } catch (err: any) {
      console.log('Error fetching user profile:', err);
      Alert.alert('Lỗi', 'Không thể tải thông tin trang cá nhân.');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const uploadWallpaperFile = async (localUri: string): Promise<string> => {
    const filename = localUri.split('/').pop() || 'wallpaper.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image`;

    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      name: filename,
      type,
    } as any);

    const uploadRes = await apiClient.post(`/upload/chat`, formData);
    const newUrl: string = uploadRes.data?.data?.url;
    if (!newUrl) throw new Error("Không lấy được URL ảnh");
    return newUrl;
  };

  const handleSelectWallpaper = async (source: 'camera' | 'library') => {
    try {
      let result: ImagePicker.ImagePickerResult;
      const options: ImagePicker.ImagePickerOptions = {
        allowsEditing: true,
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      };

      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Quyền truy cập', 'Cần cấp quyền sử dụng Máy ảnh để chụp hình nền.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Quyền truy cập', 'Cần cấp quyền truy cập Thư viện ảnh để chọn hình nền.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (result.canceled || !result.assets?.[0]) return;
      
      const asset = result.assets[0];
      const wallpaperUri = asset.uri;

      setIsLoadingGroups(true);
      // 1. Upload to S3
      const publicUrl = await uploadWallpaperFile(wallpaperUri);

      // 2. Put to Node.js backend
      await chatApiClient.put(`/conversations/${id}/wallpaper`, {
        userId: currentUserId,
        wallpaper: publicUrl
      });

      // 3. Save locally as cache
      await AsyncStorage.setItem(`wallpaper_${id}`, publicUrl);
      setCurrentWallpaper(publicUrl);
      setWallpaperModalVisible(false);
      Alert.alert('Thành công', 'Đổi hình nền cuộc trò chuyện thành công!');
    } catch (err: any) {
      console.log('Lỗi chọn hình nền:', err);
      Alert.alert('Lỗi', 'Không thể chọn hình nền: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleSelectColorWallpaper = async (color: string) => {
    try {
      setIsLoadingGroups(true);
      await chatApiClient.put(`/conversations/${id}/wallpaper`, {
        userId: currentUserId,
        wallpaper: color
      });

      await AsyncStorage.setItem(`wallpaper_${id}`, color);
      setCurrentWallpaper(color);
      setWallpaperModalVisible(false);
      Alert.alert('Thành công', 'Đổi màu nền cuộc trò chuyện thành công!');
    } catch (err: any) {
      console.log('Lỗi lưu màu nền:', err);
      Alert.alert('Lỗi', 'Không thể lưu màu nền: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleResetWallpaper = async () => {
    try {
      setIsLoadingGroups(true);
      await chatApiClient.put(`/conversations/${id}/wallpaper`, {
        userId: currentUserId,
        wallpaper: null
      });

      await AsyncStorage.removeItem(`wallpaper_${id}`);
      setCurrentWallpaper(null);
      setWallpaperModalVisible(false);
      Alert.alert('Thành công', 'Đã xóa hình nền cuộc trò chuyện.');
    } catch (err: any) {
      console.log('Lỗi xóa hình nền:', err);
      Alert.alert('Lỗi', 'Không thể xóa hình nền.');
    } finally {
      setIsLoadingGroups(false);
    }
  };

  // Nickname custom name functions
  const handleRenameNickname = async () => {
    const targetId = recipientId || id;
    if (!targetId || typeof targetId !== 'string' || targetId.startsWith('cloud_')) {
      Alert.alert('Thông báo', 'Không thể đặt tên gợi nhớ cho cuộc trò chuyện này.');
      return;
    }

    setIsSavingNickname(true);
    try {
      // 1. Fetch contacts to find contactId
      const contactsRes = await apiClient.get('/contacts?page=0&size=100');
      const contacts = contactsRes.data?.data?.content || contactsRes.data?.data || [];
      const contact = contacts.find((c: any) => String(c.contactUserId) === String(targetId));

      if (!contact) {
        Alert.alert(
          'Thông báo', 
          'Người dùng này chưa có trong danh bạ. Bạn cần kết bạn trước khi đặt tên gợi nhớ.'
        );
        setIsSavingNickname(false);
        return;
      }

      setTempNickname(contact.nickname || contact.fullName || '');
      setIsNicknameModalVisible(true);
    } catch (err) {
      console.log('Error fetching contacts for nickname:', err);
      Alert.alert('Lỗi', 'Không thể kết nối đến máy chủ.');
    } finally {
      setIsSavingNickname(false);
    }
  };

  const handleSaveNickname = async () => {
    const targetId = recipientId || id;
    if (!targetId) return;

    setIsSavingNickname(true);
    try {
      // Fetch contact record again
      const contactsRes = await apiClient.get('/contacts?page=0&size=100');
      const contacts = contactsRes.data?.data?.content || contactsRes.data?.data || [];
      const contact = contacts.find((c: any) => String(c.contactUserId) === String(targetId));

      if (!contact) {
        Alert.alert('Lỗi', 'Không tìm thấy liên hệ.');
        setIsNicknameModalVisible(false);
        return;
      }

      // Update nickname on backend
      await apiClient.put(`/contacts/${contact.id}`, {
        nickname: tempNickname.trim(),
        notes: contact.notes
      });

      // Update local name params & UI
      router.setParams({ name: tempNickname.trim() || contact.fullName });
      Alert.alert('Thành công', 'Đã đổi tên gợi nhớ thành công!');
      setIsNicknameModalVisible(false);
    } catch (err) {
      console.log('Error saving nickname:', err);
      Alert.alert('Lỗi', 'Không thể cập nhật tên gợi nhớ.');
    } finally {
      setIsSavingNickname(false);
    }
  };

  // Load groups for Add To Group & Common Groups
  const loadGroupLists = async () => {
    const targetId = recipientId || id;
    if (!currentUserId || !targetId) return;

    setIsLoadingGroups(true);
    try {
      const convRes = await chatApiClient.get(`/conversations/${currentUserId}`);
      const rawData = convRes.data;
      const allConvs = rawData?.data || rawData || [];
      const conversations = Array.isArray(allConvs) ? allConvs : [];

      // Filter groups
      const groups = conversations.filter((c: any) => c.isGroup === true);

      // 1. Groups where the friend is already a member (Common Groups)
      const common = groups.filter((g: any) => 
        g.participants && g.participants.some((p: any) => String(p.userId) === String(targetId))
      );
      setCommonGroups(common);

      // 2. Groups where the friend is NOT a member (Available Groups to add)
      const available = groups.filter((g: any) => 
        !g.participants || !g.participants.some((p: any) => String(p.userId) === String(targetId))
      );
      setAvailableGroups(available);

    } catch (err) {
      console.log('Error loading group lists:', err);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  // Auto-load groups on mount/load
  useEffect(() => {
    if (currentUserId && (recipientId || (id && typeof id === 'string' && !id.startsWith('cloud_')))) {
      loadGroupLists();
    }
  }, [recipientId, id, currentUserId]);

  const handleOpenAddToGroup = async () => {
    await loadGroupLists();
    setAddToGroupVisible(true);
  };

  const handleOpenCommonGroups = async () => {
    await loadGroupLists();
    setCommonGroupsVisible(true);
  };

  const handleAddFriendToGroup = async (group: any) => {
    const targetId = recipientId || id;
    if (!targetId || !currentUserId) return;

    Alert.alert(
      'Xác nhận',
      `Bạn có muốn thêm ${displayName || 'người này'} vào nhóm "${group.groupName || 'Nhóm chat'}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Thêm',
          onPress: async () => {
            try {
              setIsLoadingGroups(true);
              await chatApiClient.post(`/conversations/${group.conversationId}/members`, {
                requesterId: currentUserId,
                targetUserIds: [targetId]
              });
              Alert.alert('Thành công', `Đã thêm bạn vào nhóm "${group.groupName || 'Nhóm chat'}" thành công!`);
              setAddToGroupVisible(false);
            } catch (err: any) {
              console.log('Error adding friend to group:', err);
              Alert.alert('Lỗi', err.response?.data?.message || 'Không thể thêm bạn vào nhóm.');
            } finally {
              setIsLoadingGroups(false);
            }
          }
        }
      ]
    );
  };

  // Get current user's role
  const myRole = useMemo(() => {
    if (isGroup !== 'true' || !currentUserId || !participants.length) return 'member';
    const me = participants.find(p => String(p.userId || p.id) === String(currentUserId));
    console.log('[GroupOptions] myRole check: currentUserId=', currentUserId, 'foundMe=', !!me, 'role=', me?.role);
    return me?.role || 'member';
  }, [participants, currentUserId, isGroup]);

  const canCreatePoll = useMemo(() => {
    if (isGroup !== 'true') return true;
    if (groupSettings?.pinAndPolls === 'admin_only') {
      return myRole === 'leader' || myRole === 'deputy';
    }
    return true;
  }, [groupSettings?.pinAndPolls, myRole, isGroup]);

  const canChangeInfo = useMemo(() => {
    if (isGroup !== 'true') return true;
    if (groupSettings?.changeInfo === 'admin_only') {
      return myRole === 'leader' || myRole === 'deputy';
    }
    return true;
  }, [groupSettings?.changeInfo, myRole, isGroup]);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const pickAndUploadGroupAvatar = async () => {
    try {
      Alert.alert('Đổi ảnh nhóm', '', [
        { text: 'Chụp ảnh mới', onPress: () => _launchGroupAvatar('camera') },
        { text: 'Chọn từ thư viện', onPress: () => _launchGroupAvatar('library') },
        { text: 'Hủy', style: 'cancel' },
      ]);
    } catch (e) {
      console.log(e);
    }
  };

  const _launchGroupAvatar = async (source: 'camera' | 'library') => {
    try {
      let result: ImagePicker.ImagePickerResult;
      const options: ImagePicker.ImagePickerOptions = {
        allowsEditing: true,
        aspect: [1, 1],
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
      
      setIsUploadingAvatar(true);
      const asset = result.assets[0];

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: `group-${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);

      const uploadRes = await apiClient.post(`/upload/avatar`, formData);
      const newUrl: string = uploadRes.data?.data?.url;

      if (!newUrl) throw new Error("Không lấy được URL ảnh");

      await chatApiClient.put(`/conversations/${id}/info`, {
        requesterId: currentUserId,
        groupAvatar: newUrl
      });

      router.setParams({ avatar: newUrl });
      Alert.alert('Thành công', 'Đổi ảnh nhóm thành công!');
    } catch(err: any) {
      Alert.alert('Lỗi', 'Không thể đổi ảnh nhóm: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Fetch conversation data (for both private and group chats)
  useEffect(() => {
    if (!currentUserId || !id) return;
    
    const fetchConversationData = async () => {
      setIsLoadingGroup(true);
      try {
        const convRes = await chatApiClient.get(`/conversations/${currentUserId}`);
        
        const rawData = convRes.data;
        const allConvs = rawData?.data || rawData || [];
        const conversations = Array.isArray(allConvs) ? allConvs : [];
        const thisConv = conversations.find((c: any) => c.conversationId === id);
        
        console.log('[GroupOptions] Found conv:', !!thisConv, 'participants count:', thisConv?.participants?.length);
        console.log('[GroupOptions] My userId:', currentUserId);
        
        if (thisConv?.participants) {
          setParticipants(thisConv.participants);
          setIsPinned(thisConv.isPinned || false);
          AsyncStorage.setItem(`pinned_${id}`, thisConv.isPinned ? 'true' : 'false').catch(() => {});
          if (isGroup === 'true') {
            setRequireApproval(thisConv.requireApproval || false);
            setGroupSettings(thisConv.groupSettings || null);
            setPendingMembers(thisConv.pendingMembers || []);
          } else {
            // It is a 1-1 private chat. Let's find the recipient ID.
            const otherP = thisConv.participants.find((p: any) => String(p.userId) !== String(currentUserId));
            if (otherP) {
              const rId = String(otherP.userId);
              setRecipientId(rId);
              
              // Now let's fetch the contact to get the custom nickname!
              apiClient.get('/contacts?page=0&size=100')
                .then(contactsRes => {
                  const contacts = contactsRes.data?.data?.content || contactsRes.data?.data || [];
                  const contact = contacts.find((c: any) => String(c.contactUserId) === String(rId));
                  if (contact && contact.nickname) {
                    setDisplayName(contact.nickname);
                  }
                })
                .catch(e => console.log('Lỗi khi tải nickname trong options:', e));
            }
          }
          
          // Fetch member info
          const map: Record<string, { fullName: string; avatarUrl?: string }> = {};
          for (const p of thisConv.participants) {
            const uid = String(p.userId);
            if (!uid) continue;
            try {
              const res = await apiClient.get(`/users/${uid}`);
              if (res.data?.data) {
                map[uid] = {
                  fullName: res.data.data.fullName || res.data.data.nickname || 'Thành viên',
                  avatarUrl: res.data.data.avatarUrl,
                };
              }
            } catch { /* skip */ }
          }
          setMemberMap(map);
        }
      } catch (err) {
        console.log('Error fetching conversation data:', err);
      } finally {
        setIsLoadingGroup(false);
      }
    };
    
    fetchConversationData();
  }, [isGroup, id, currentUserId]);

  // Reload conversation data after actions
  const reloadConversation = async () => {
    if (!currentUserId || !id) return;
    try {
      const convRes = await chatApiClient.get(`/conversations/${currentUserId}`);
      const allConvs = convRes.data?.data || convRes.data || [];
      const conversations = Array.isArray(allConvs) ? allConvs : [];
      const thisConv = conversations.find((c: any) => c.conversationId === id);
      if (thisConv?.participants) {
        setParticipants(thisConv.participants);
        setRequireApproval(thisConv.requireApproval || false);
        setGroupSettings(thisConv.groupSettings || null);
        setPendingMembers(thisConv.pendingMembers || []);
        // Fetch any new member info
        const newIds = thisConv.participants
          .map((p: any) => String(p.userId))
          .filter((uid: string) => uid && !memberMap[uid]);
        if (newIds.length > 0) {
          const newMap = { ...memberMap };
          for (const uid of newIds) {
            try {
              const res = await apiClient.get(`/users/${uid}`);
              if (res.data?.data) {
                newMap[uid] = {
                  fullName: res.data.data.fullName || res.data.data.nickname || 'Thành viên',
                  avatarUrl: res.data.data.avatarUrl,
                };
              }
            } catch { /* skip */ }
          }
          setMemberMap(newMap);
        }
      }
    } catch (err) {
      console.log('Error reloading conversation:', err);
    }
  };

  const handleConfirmAddMember = async (userIds: string[]) => {
    try {
      await chatApiClient.post(`/conversations/${id}/members`, {
        requesterId: currentUserId,
        targetUserIds: userIds
      });
      await reloadConversation();
    } catch (error) {
      console.log('Failed to add members via options', error);
      throw error;
    }
  };

  // Change member role
  const handleRoleChange = (targetUserId: string, newRole: 'leader' | 'deputy' | 'member') => {
    const roleLabels: Record<string, string> = { leader: 'Trưởng nhóm', deputy: 'Phó nhóm', member: 'Thành viên' };
    const confirmMsg = newRole === 'leader'
      ? 'Bạn có chắc muốn trao quyền Trưởng nhóm?\nBạn sẽ trở thành Thành viên.'
      : `Đổi vai trò thành ${roleLabels[newRole]}?`;

    Alert.alert('Xác nhận', confirmMsg, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đồng ý',
        onPress: async () => {
          try {
            await chatApiClient.put(`/conversations/${id}/role`, {
              requesterId: currentUserId,
              targetUserId,
              newRole,
            });
            await reloadConversation();
          } catch (err: any) {
            Alert.alert('Lỗi', err.response?.data?.message || 'Không thể thay đổi vai trò');
          } finally {
            setMenuOpenUid(null);
          }
        },
      },
    ]);
  };

  // Remove member
  const handleRemoveMember = (targetUserId: string) => {
    const memberName = memberMap[targetUserId]?.fullName || 'thành viên này';
    Alert.alert('Xác nhận', `Bạn có chắc chắn muốn xóa ${memberName} khỏi nhóm?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await chatApiClient.delete(`/conversations/${id}/members`, {
              data: { requesterId: currentUserId, targetUserId },
            });
            await reloadConversation();
          } catch (err: any) {
            Alert.alert('Lỗi', err.response?.data?.message || 'Không thể xóa thành viên');
          } finally {
            setMenuOpenUid(null);
          }
        },
      },
    ]);
  };

  // Leave group
  const handleLeaveGroup = () => {
    const alertMessage = myRole === 'leader' 
      ? 'Bạn là trưởng nhóm. Nếu rời nhóm, quyền trưởng nhóm sẽ được tự động chuyển cho phó nhóm hoặc thành viên vào sớm nhất. Bạn có chắc chắn muốn rời?'
      : 'Bạn có chắc chắn muốn rời khỏi nhóm này?';
      
    Alert.alert('Rời nhóm', alertMessage, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Rời nhóm',
        style: 'destructive',
        onPress: async () => {
          try {
            await chatApiClient.delete(`/conversations/${id}/members`, {
              data: { requesterId: currentUserId, targetUserId: currentUserId },
            });
            // Navigate back to messages list
            router.replace('/(tabs)');
          } catch (err: any) {
            Alert.alert('Lỗi', err.response?.data?.message || 'Không thể rời nhóm');
          }
        },
      },
    ]);
  };

  // Disband group
  const handleDisbandGroup = () => {
    Alert.alert(
      '⚠️ Giải tán nhóm',
      'Bạn có chắc chắn muốn giải tán nhóm này?\nToàn bộ thành viên sẽ bị xóa và không thể khôi phục.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Giải tán',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatApiClient.delete(`/conversations/${id}/disband`, {
                data: { requesterId: currentUserId },
              });
              router.replace('/(tabs)');
            } catch (err: any) {
              Alert.alert('Lỗi', err.response?.data?.message || 'Không thể giải tán nhóm');
            }
          },
        },
      ]
    );
  };

  // Toggle require approval
  const handleToggleApproval = async () => {
    const newValue = !requireApproval;
    try {
      await chatApiClient.put(`/conversations/${id}/approval-setting`, {
        requesterId: currentUserId,
        requireApproval: newValue,
      });
      setRequireApproval(newValue);
    } catch (err: any) {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể thay đổi cài đặt');
    }
  };

  const handleTogglePermission = async (field: 'sendMessages' | 'pinAndPolls' | 'changeInfo') => {
    if (!currentUserId || !id) return;
    const currentSettings = groupSettings || { sendMessages: 'all', pinAndPolls: 'all', changeInfo: 'all' };
    const currentValue = currentSettings[field];
    const newValue = currentValue === 'all' ? 'admin_only' : 'all';
    
    try {
      await chatApiClient.put(`/conversations/${id}/permissions`, {
        requesterId: currentUserId,
        settings: { [field]: newValue }
      });
      await reloadConversation();
    } catch (err: any) {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể thay đổi quyền');
    }
  };

  // Approve pending member
  const handleApprovePending = async (userId: string) => {
    try {
      await chatApiClient.post(`/conversations/${id}/pending/approve`, {
        requesterId: currentUserId,
        targetUserIds: [userId],
      });
      await reloadConversation();
    } catch (err: any) {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể duyệt thành viên');
    }
  };

  // Reject pending member
  const handleRejectPending = async (userId: string) => {
    try {
      await chatApiClient.post(`/conversations/${id}/pending/reject`, {
        requesterId: currentUserId,
        targetUserIds: [userId],
      });
      await reloadConversation();
    } catch (err: any) {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể từ chối thành viên');
    }
  };

  const handleCreatePoll = (question: string, options: string[]) => {
    if (!socket || !currentUserId || !id) return;
    socket.emit('create_poll', {
      conversationId: id,
      question,
      options
    });
    setShowPollModal(false);
    Alert.alert('Thành công', 'Đã tạo bình chọn mới');
  };

  const handleRenameSubmit = async () => {
    if (!tempGroupName.trim() || !id || !currentUserId) return;
    
    setIsRenaming(true);
    try {
      await chatApiClient.put(`/conversations/${id}/info`, {
        requesterId: currentUserId,
        groupName: tempGroupName.trim()
      });
      
      router.setParams({ name: tempGroupName.trim() });
      setIsRenameModalVisible(false);
      Alert.alert('Thành công', 'Đổi tên nhóm thành công!');
    } catch (err: any) {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể đổi tên nhóm');
    } finally {
      setIsRenaming(false);
    }
  };

  // Fetch pending member info
  useEffect(() => {
    if (!pendingMembers.length) {
      setPendingMemberMap({});
      return;
    }
    const fetchPendingInfo = async () => {
      const map: Record<string, { fullName: string; avatarUrl?: string }> = {};
      for (const pm of pendingMembers) {
        const uid = String(pm.userId);
        if (!uid || pendingMemberMap[uid]) continue;
        try {
          const res = await apiClient.get(`/users/${uid}`);
          if (res.data?.data) {
            map[uid] = { fullName: res.data.data.fullName || 'Thành viên', avatarUrl: res.data.data.avatarUrl };
          }
        } catch { /* skip */ }
      }
      if (Object.keys(map).length > 0) {
        setPendingMemberMap(prev => ({ ...prev, ...map }));
      }
    };
    fetchPendingInfo();
  }, [pendingMembers.length]);

  // Fetch media preview
  useEffect(() => {
    if (!id) return;
    const fetchMediaPreview = async () => {
      setIsLoadingMedia(true);
      try {
        const res = await chatApiClient.get(`/conversation/${id}/media?type=media&limit=5`);
        setMediaPreview(res.data?.data || []);
      } catch (err) {
        console.log('Error fetching media preview:', err);
      } finally {
        setIsLoadingMedia(false);
      }
    };
    fetchMediaPreview();
  }, [id]);

  // Listen for socket events
  useEffect(() => {
    if (!socket) return;
    const handleSettingsUpdate = (data: any) => {
      if (data.conversationId === id) {
        if (data.settings?.requireApproval !== undefined) {
          setRequireApproval(data.settings.requireApproval);
        }
      }
    };
    const handlePendingUpdate = (data: any) => {
      if (data.conversationId === id) {
        setPendingMembers(data.pendingMembers || []);
      }
    };
    socket.on('group_settings_updated', handleSettingsUpdate);
    socket.on('pending_members_updated', handlePendingUpdate);
    return () => {
      socket.off('group_settings_updated', handleSettingsUpdate);
      socket.off('pending_members_updated', handlePendingUpdate);
    };
  }, [socket, id]);

  // Fetch invite code
  useEffect(() => {
    if (isGroup === 'true' && id) {
      chatApiClient.get(`/conversations/${id}/invite`)
        .then(res => setInviteCode(res.data?.data?.inviteCode))
        .catch(e => console.log('Error fetching invite code', e));
    }
  }, [isGroup, id]);

  const handleResetInvite = async () => {
    if (!id || !currentUserId) return;
    Alert.alert('Xác nhận', 'Bạn có chắc chắn muốn đổi link tham gia mới? Link cũ sẽ không còn hiệu lực.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đồng ý', onPress: async () => {
        try {
          const res = await chatApiClient.post(`/conversations/${id}/invite/reset`, { requesterId: currentUserId });
          setInviteCode(res.data?.data?.inviteCode);
          Alert.alert('Thành công', 'Đã đổi link tham gia mới');
        } catch (err) {
          Alert.alert('Lỗi', 'Không thể đổi link');
        }
      }}
    ]);
  };

  // Grouped item component
  const OptionItem = ({ icon, color, label, showArrow, toggle, toggleValue, onToggle, dangerous, onPress }: any) => (
    <TouchableOpacity 
      style={styles.optionRow} 
      activeOpacity={0.7}
      disabled={!!toggle}
      onPress={onPress}
    >
      <View style={styles.optionLeft}>
        <Ionicons name={icon} size={22} color={dangerous ? '#FF4757' : (color || '#555')} style={styles.optionIcon} />
        <Text style={[styles.optionLabel, dangerous && { color: '#FF4757' }]}>{label}</Text>
      </View>
      {toggle ? (
        <Switch 
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: '#d1d1d1', true: ZaloColors.blue }}
          thumbColor={'#fff'}
        />
      ) : showArrow ? (
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      ) : null}
    </TouchableOpacity>
  );

  // Role badge colors
  const roleBadge: Record<string, { label: string; bg: string; color: string; icon: string }> = {
    leader: { label: 'Trưởng nhóm', bg: 'rgba(255,165,0,0.12)', color: '#e67e00', icon: 'shield-checkmark' },
    deputy: { label: 'Phó nhóm', bg: 'rgba(16,185,129,0.1)', color: '#10b981', icon: 'star' },
    member: { label: 'Thành viên', bg: 'rgba(0,0,0,0.04)', color: '#888', icon: '' },
  };

  // Sort participants: leader -> deputy -> member
  const sortedParticipants = useMemo(() => {
    const order: Record<string, number> = { leader: 0, deputy: 1, member: 2 };
    return [...participants].sort((a, b) => (order[a.role] ?? 2) - (order[b.role] ?? 2));
  }, [participants]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" backgroundColor={ZaloColors.blue} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tùy chọn</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Top Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity 
             style={styles.avatarWrap}
             onPress={isGroup === 'true' ? pickAndUploadGroupAvatar : undefined}
             disabled={isUploadingAvatar}
             activeOpacity={0.8}
          >
            {isUploadingAvatar ? (
               <View style={[styles.avatar, styles.defaultAvatar, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                  <ActivityIndicator size="small" color="#fff" />
               </View>
            ) : avatar ? (
              <Image source={{ uri: avatar as string }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.defaultAvatar]}>
                <Ionicons name={isGroup === 'true' ? 'people' : 'person'} size={40} color="#fff" />
              </View>
            )}
            {isGroup === 'true' && (
              <View style={styles.cameraIconBadge}>
                <Ionicons name="camera-outline" size={16} color="#000" />
              </View>
            )}
          </TouchableOpacity>
          
          {isGroup === 'true' ? (
             <TouchableOpacity 
                style={styles.nameWrap} 
                onPress={() => {
                  if (canChangeInfo) {
                    setTempGroupName(String(name || ''));
                    setIsRenameModalVisible(true);
                  } else {
                    Alert.alert('Thông báo', 'Chỉ Trưởng/Phó nhóm mới được đổi tên nhóm');
                  }
                }}
                activeOpacity={0.7}
             >
               <Text style={styles.profileNameGroup} numberOfLines={2}>{name}</Text>
               <Ionicons name="pencil-outline" size={20} color="#555" style={styles.nameEditIcon} />
             </TouchableOpacity>
           ) : (
            <Text style={styles.profileName} numberOfLines={2}>{displayName || name}</Text>
          )}

          <View style={styles.actionCirclesRow}>
            <TouchableOpacity 
              style={styles.actionCircleItem}
              onPress={() => {
                router.navigate({
                  pathname: '/chat/[id]',
                  params: { id, name: displayName || name, avatar, isGroup, openSearch: 'true' }
                });
              }}
            >
              <View style={styles.actionCircle}>
                <Ionicons name="search-outline" size={24} color="#444" />
              </View>
              <Text style={styles.actionCircleLabel}>Tìm{'\n'}tin nhắn</Text>
            </TouchableOpacity>
            
            {isGroup === 'true' ? (
              <TouchableOpacity style={styles.actionCircleItem} onPress={() => setIsAddMemberVisible(true)}>
                <View style={styles.actionCircle}>
                  <Ionicons name="person-add-outline" size={24} color="#444" />
                </View>
                <Text style={styles.actionCircleLabel}>Thêm{'\n'}thành viên</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.actionCircleItem} 
                onPress={handleViewProfile}
                disabled={isLoadingProfile}
              >
                <View style={styles.actionCircle}>
                  {isLoadingProfile ? (
                    <ActivityIndicator size="small" color="#444" />
                  ) : (
                    <Ionicons name="person-outline" size={24} color="#444" />
                  )}
                </View>
                <Text style={styles.actionCircleLabel}>Trang{'\n'}cá nhân</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.actionCircleItem}
              onPress={() => setWallpaperModalVisible(true)}
            >
              <View style={styles.actionCircle}>
                <Ionicons name="color-palette-outline" size={24} color="#444" />
              </View>
              <Text style={styles.actionCircleLabel}>Đổi{'\n'}hình nền</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCircleItem} onPress={handleToggleMute}>
              <View style={isMuted ? [styles.actionCircle, {backgroundColor: ZaloColors.blue}] : styles.actionCircle}>
                <Ionicons name={isMuted ? "notifications-off" : "notifications-outline"} size={24} color={isMuted ? "#fff" : "#444"} />
              </View>
              <Text style={styles.actionCircleLabel}>{isMuted ? 'Bật\nthông báo' : 'Tắt\nthông báo'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Group Description */}
        {isGroup === 'true' && (
          <View style={styles.section}>
            <OptionItem icon="information-circle-outline" label="Thêm mô tả nhóm" color="#888" />
          </View>
        )}

        {/* Section 1 - Private chat */}
        {isGroup !== 'true' && (
        <View style={styles.section}>
          <OptionItem 
            icon="pencil-outline" 
            label="Đổi tên gợi nhớ" 
            onPress={handleRenameNickname}
          />
          <OptionItem 
            icon="star-outline" 
            label="Đánh dấu bạn thân" 
            toggle 
            toggleValue={isBestFriend} 
            onToggle={setIsBestFriend} 
          />
          <OptionItem icon="time-outline" label="Nhật ký chung" showArrow />
        </View>
        )}

        {/* Section 2: Media */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.optionRowMedia} 
            activeOpacity={0.7}
            onPress={() => router.push({
              pathname: '/chat/media-archive',
              params: { id }
            })}
          >
            <View style={styles.optionLeftMedia}>
              <Ionicons name="images-outline" size={22} color="#555" style={styles.optionIcon} />
              <Text style={styles.optionLabel}>Ảnh, file, link</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaPreviewScroll}>
            {isLoadingMedia ? (
              <ActivityIndicator size="small" color={ZaloColors.blue} style={{ padding: 20 }} />
            ) : mediaPreview.length > 0 ? (
              mediaPreview.map((item: any) => (
                <TouchableOpacity 
                  key={item._id} 
                  activeOpacity={0.8}
                  onPress={() => {
                    if (typeof item.fileUrl === 'string') {
                      Linking.openURL(item.fileUrl).catch(err => console.log('Error opening URL:', err));
                    }
                  }}
                  style={styles.mediaPlaceholder}
                >
                  <Image source={{ uri: item.fileUrl }} style={styles.mediaPreviewImg} />
                  {(item.messageType === 'video' || (typeof item.fileUrl === 'string' && /\.(mp4|m4v|mov|avi|wmv|flv|mkv|webm)$/i.test(item.fileUrl))) && (
                    <View style={styles.videoIconSmall}>
                      <Ionicons name="play" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              [1, 2, 3, 4].map((item) => (
                <View key={item} style={styles.mediaPlaceholder}>
                  <Ionicons name="image-outline" size={24} color="#999" />
                </View>
              ))
            )}
            <TouchableOpacity 
              style={styles.mediaMoreBtn}
              onPress={() => router.push({
                pathname: '/chat/media-archive',
                params: { id }
              })}
            >
              <Ionicons name="arrow-forward" size={20} color={ZaloColors.blue} />
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Section 3: Private chat group actions */}
        {isGroup !== 'true' && (
        <View style={styles.section}>
          <OptionItem 
            icon="person-add-outline" 
            label={`Tạo nhóm với ${displayName || name || 'người này'}`} 
            onPress={() => setCreateGroupVisible(true)}
          />
          <OptionItem 
            icon="person-add-outline" 
            label={`Thêm ${displayName || name || 'người này'} vào nhóm`} 
            onPress={handleOpenAddToGroup}
          />
          <OptionItem 
            icon="people-outline" 
            label={`Xem nhóm chung (${commonGroups.length})`} 
            showArrow 
            onPress={handleOpenCommonGroups}
          />
        </View>
        )}

        {/* Group Specific Sections */}
        {isGroup === 'true' && (
          <>
            <View style={styles.section}>
              <OptionItem icon="calendar-outline" label="Lịch nhóm" />
              <OptionItem icon="pin-outline" label="Tin nhắn đã ghim" />
              <OptionItem 
                icon="bar-chart-outline" 
                label="Bình chọn" 
                onPress={() => {
                  if (canCreatePoll) {
                    setShowPollModal(true);
                  } else {
                    Alert.alert('Thông báo', 'Chỉ Trưởng/Phó nhóm mới được tạo bình chọn');
                  }
                }} 
              />
            </View>

            {/* ═══════ MEMBER LIST WITH ROLE MANAGEMENT ═══════ */}
            <View style={styles.section}>
              <TouchableOpacity 
                style={styles.optionRow} 
                activeOpacity={0.7}
                onPress={() => setExpandedMembers(!expandedMembers)}
              >
                <View style={styles.optionLeft}>
                  <Ionicons name="people-outline" size={22} color="#555" style={styles.optionIcon} />
                  <View>
                    <Text style={styles.optionLabel}>Thành viên nhóm ({participants.length})</Text>
                    <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Vai trò của bạn: {myRole === 'leader' ? 'Trưởng nhóm' : myRole === 'deputy' ? 'Phó nhóm' : 'Thành viên'}</Text>
                  </View>
                </View>
                <Ionicons 
                  name={expandedMembers ? 'chevron-up' : 'chevron-down'} 
                  size={20} color="#ccc" 
                />
              </TouchableOpacity>

              {expandedMembers && (
                <View style={styles.memberList}>
                  {isLoadingGroup ? (
                    <ActivityIndicator size="small" color={ZaloColors.blue} style={{ padding: 16 }} />
                  ) : (
                    sortedParticipants.map((p, idx) => {
                      const uid = String(p.userId);
                      const info = memberMap[uid];
                      const isMe = uid === String(currentUserId);
                      const memberName = isMe ? 'Bạn' : (info?.fullName || `Thành viên ${idx + 1}`);
                      const memberAvatar = info?.avatarUrl;
                      const role = p.role || 'member';
                      const badge = roleBadge[role];
                      
                      // Debug role
                      console.log(`Member ${memberName} has role: ${role}`);

                      // Build menu items
                      const menuItems: { label: string; icon: string; action: () => void; color?: string }[] = [];

                      if (myRole === 'leader' && !isMe) {
                        menuItems.push({
                          label: 'Chuyển quyền trưởng nhóm',
                          icon: 'shield-checkmark-outline',
                          action: () => handleRoleChange(uid, 'leader'),
                          color: '#f59e0b',
                        });
                        if (role !== 'deputy') {
                          menuItems.push({
                            label: 'Bổ nhiệm phó nhóm',
                            icon: 'person-add-outline',
                            action: () => handleRoleChange(uid, 'deputy'),
                            color: '#10b981',
                          });
                        }
                        if (role === 'deputy') {
                          menuItems.push({
                            label: 'Gỡ phó nhóm',
                            icon: 'person-remove-outline',
                            action: () => handleRoleChange(uid, 'member'),
                            color: '#ef4444',
                          });
                        }
                      }

                      // Remove permission: leader removes anyone, deputy removes member only
                      if (!isMe && (myRole === 'leader' || (myRole === 'deputy' && role === 'member'))) {
                        menuItems.push({
                          label: 'Xóa khỏi nhóm',
                          icon: 'trash-outline',
                          action: () => handleRemoveMember(uid),
                          color: '#ef4444',
                        });
                      }

                      return (
                        <View key={uid}>
                          <TouchableOpacity 
                            style={styles.memberRow}
                            activeOpacity={0.7}
                            onPress={() => {
                              if (menuItems.length > 0) {
                                setMenuOpenUid(menuOpenUid === uid ? null : uid);
                              }
                            }}
                          >
                             {/* Avatar */}
                             <View style={[
                               styles.memberAvatar,
                               { backgroundColor: memberAvatar ? 'transparent' : (role === 'leader' ? '#f59e0b' : role === 'deputy' ? '#10b981' : ZaloColors.blue) }
                             ]}>
                               {memberAvatar ? (
                                 <Image source={{ uri: memberAvatar }} style={styles.memberAvatarImg} />
                               ) : (
                                 <Text style={styles.memberAvatarText}>
                                   {memberName.charAt(0).toUpperCase()}
                                 </Text>
                               )}
                             </View>
 
                             {/* Name + Role Badge */}
                             <View style={styles.memberInfo}>
                               <Text style={[styles.memberName, isMe && { color: ZaloColors.blue, fontWeight: '700' }]} numberOfLines={1}>
                                 {memberName}
                               </Text>
                               
                               <View style={{ marginTop: 2 }}>
                                 {role === 'leader' ? (
                                   <View style={{ backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, alignSelf: 'flex-start', borderWidth: 0.5, borderColor: '#f59e0b' }}>
                                     <Text style={{ fontSize: 9, color: '#f59e0b', fontWeight: '700' }}>TRƯỞNG NHÓM</Text>
                                   </View>
                                 ) : role === 'deputy' ? (
                                   <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, alignSelf: 'flex-start', borderWidth: 0.5, borderColor: '#10b981' }}>
                                     <Text style={{ fontSize: 9, color: '#10b981', fontWeight: '700' }}>PHÓ NHÓM</Text>
                                   </View>
                                 ) : (
                                   <Text style={{ fontSize: 11, color: '#999' }}>Thành viên</Text>
                                 )}
                               </View>
                             </View>

                            {/* 3-dot indicator */}
                            {menuItems.length > 0 && (
                              <Ionicons name="ellipsis-vertical" size={18} color="#999" style={{ padding: 8 }} />
                            )}
                          </TouchableOpacity>

                          {/* Expanded Action Buttons */}
                          {menuOpenUid === uid && menuItems.length > 0 && (
                            <View style={styles.memberActions}>
                              {menuItems.map((item, mIdx) => (
                                <TouchableOpacity
                                  key={mIdx}
                                  style={styles.memberActionBtn}
                                  onPress={() => {
                                    setMenuOpenUid(null);
                                    item.action();
                                  }}
                                >
                                  <Ionicons name={item.icon as any} size={16} color={item.color || '#555'} />
                                  <Text style={[styles.memberActionText, item.color ? { color: item.color } : {}]}>
                                    {item.label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* Link nhóm */}
              <TouchableOpacity 
                style={styles.optionRow} 
                activeOpacity={0.7}
                onPress={() => setIsInviteExpanded(!isInviteExpanded)}
              >
                <View style={styles.optionLeft}>
                  <Ionicons name="link-outline" size={22} color="#555" style={styles.optionIcon} />
                  <View>
                    <Text style={styles.optionLabel}>Link nhóm</Text>
                    <Text style={styles.optionSubLabel}>{inviteCode ? `.../join/${inviteCode}` : 'Đang tải...'}</Text>
                  </View>
                </View>
                <Ionicons name={isInviteExpanded ? "chevron-up" : "chevron-down"} size={20} color="#ccc" />
              </TouchableOpacity>

              {isInviteExpanded && (
                <View style={styles.inviteLinkDetail}>
                  <Text style={styles.inviteLinkInfo}>
                    Bất kỳ ai có link này đều có thể tham gia nhóm {requireApproval && "(Cần Admin duyệt)"}.
                  </Text>
                  <View style={styles.inviteLinkRow}>
                    <Text style={styles.inviteLinkText} numberOfLines={1}>
                      {inviteCode ? `http://${API_IP}/join/${inviteCode}` : 'Đang tải...'}
                    </Text>
                    <TouchableOpacity 
                      style={styles.copyBtn}
                      onPress={async () => {
                        if (!inviteCode) return;
                        const link = `http://${API_IP}/join/${inviteCode}`;
                        await Clipboard.setStringAsync(link);
                        Alert.alert('Thành công', 'Đã sao chép link tham gia nhóm!');
                      }}
                    >
                      <Text style={styles.copyBtnText}>SAO CHÉP</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <TouchableOpacity 
                      style={[styles.resetLinkBtn, { flex: 1, justifyContent: 'center' }]}
                      onPress={async () => {
                        if (!inviteCode) return;
                        const link = `http://${API_IP}/join/${inviteCode}`;
                        try {
                          await Share.share({
                            message: `Tham gia nhóm chat: ${link}`,
                            url: link,
                          });
                        } catch (err) {
                          console.log('Share error:', err);
                        }
                      }}
                    >
                      <Ionicons name="share-social-outline" size={16} color={ZaloColors.blue} />
                      <Text style={styles.resetLinkText}>Chia sẻ link</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.resetLinkBtn, { flex: 1, justifyContent: 'center' }]}
                      onPress={() => {
                        if (!inviteCode) return;
                        router.push({
                          pathname: '/join/[inviteCode]',
                          params: { inviteCode },
                        });
                      }}
                    >
                      <Ionicons name="open-outline" size={16} color={ZaloColors.blue} />
                      <Text style={styles.resetLinkText}>Mở link</Text>
                    </TouchableOpacity>
                  </View>
                  {(myRole === 'leader' || myRole === 'deputy') && (
                    <TouchableOpacity style={[styles.resetLinkBtn, { marginTop: 10 }]} onPress={handleResetInvite}>
                      <Ionicons name="refresh" size={16} color={ZaloColors.blue} />
                      <Text style={styles.resetLinkText}>Đổi link mới</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* ═══ MEMBER APPROVAL SETTINGS ═══ */}
            {(myRole === 'leader' || myRole === 'deputy') && (
              <View style={styles.section}>
                <TouchableOpacity style={styles.optionRow} activeOpacity={0.7} onPress={handleToggleApproval}>
                  <View style={styles.optionLeft}>
                    <Ionicons name="shield-checkmark-outline" size={22} color={ZaloColors.blue} style={styles.optionIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionLabel}>Duyệt thành viên mới</Text>
                      <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                        {requireApproval ? 'Thành viên thêm người cần Admin duyệt' : 'Mọi thành viên đều có thể thêm người'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={requireApproval}
                    onValueChange={handleToggleApproval}
                    trackColor={{ false: '#d1d1d1', true: ZaloColors.blue }}
                    thumbColor={'#fff'}
                  />
                </TouchableOpacity>

                {/* Permissions Toggles */}
                <TouchableOpacity style={styles.optionRow} activeOpacity={0.7} onPress={() => handleTogglePermission('sendMessages')}>
                  <View style={styles.optionLeft}>
                    <Ionicons name="chatbubbles-outline" size={22} color={ZaloColors.blue} style={styles.optionIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionLabel}>Chỉ Admin được gửi tin</Text>
                      <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                        {groupSettings?.sendMessages === 'admin_only' ? 'Chỉ Trưởng/Phó nhóm được nhắn tin' : 'Tất cả mọi người đều được gửi tin'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={groupSettings?.sendMessages === 'admin_only'}
                    onValueChange={() => handleTogglePermission('sendMessages')}
                    trackColor={{ false: '#d1d1d1', true: ZaloColors.blue }}
                    thumbColor={'#fff'}
                  />
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionRow} activeOpacity={0.7} onPress={() => handleTogglePermission('pinAndPolls')}>
                  <View style={styles.optionLeft}>
                    <Ionicons name="pin-outline" size={22} color={ZaloColors.blue} style={styles.optionIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionLabel}>Chỉ Admin được ghim/bình chọn</Text>
                      <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                        {groupSettings?.pinAndPolls === 'admin_only' ? 'Chỉ Trưởng/Phó nhóm được ghim tin và bình chọn' : 'Tất cả mọi người đều có quyền'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={groupSettings?.pinAndPolls === 'admin_only'}
                    onValueChange={() => handleTogglePermission('pinAndPolls')}
                    trackColor={{ false: '#d1d1d1', true: ZaloColors.blue }}
                    thumbColor={'#fff'}
                  />
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionRow} activeOpacity={0.7} onPress={() => handleTogglePermission('changeInfo')}>
                  <View style={styles.optionLeft}>
                    <Ionicons name="create-outline" size={22} color={ZaloColors.blue} style={styles.optionIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionLabel}>Chỉ Admin được đổi Tên/Ảnh</Text>
                      <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                        {groupSettings?.changeInfo === 'admin_only' ? 'Chỉ Trưởng/Phó nhóm được đổi Tên và Ảnh nhóm' : 'Tất cả mọi người đều có quyền'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={groupSettings?.changeInfo === 'admin_only'}
                    onValueChange={() => handleTogglePermission('changeInfo')}
                    trackColor={{ false: '#d1d1d1', true: ZaloColors.blue }}
                    thumbColor={'#fff'}
                  />
                </TouchableOpacity>

                {/* Pending Members List */}
                {pendingMembers.length > 0 && (
                  <>
                    <View style={[styles.optionRow, { paddingVertical: 10 }]}>
                      <View style={styles.optionLeft}>
                        <Ionicons name="hourglass-outline" size={22} color="#f59e0b" style={styles.optionIcon} />
                        <Text style={[styles.optionLabel, { fontWeight: '600' }]}>
                          Chờ duyệt ({pendingMembers.length})
                        </Text>
                      </View>
                    </View>
                    {pendingMembers.map((pm: any) => {
                      const uid = String(pm.userId);
                      const info = pendingMemberMap[uid];
                      const pmName = info?.fullName || `User ${uid}`;
                      const pmAvatar = info?.avatarUrl;
                      const addedByName = memberMap[String(pm.addedBy)]?.fullName || `User ${pm.addedBy}`;

                      return (
                        <View key={uid} style={[styles.memberRow, { paddingLeft: 16 }]}>
                          <View style={[
                            styles.memberAvatar,
                            { backgroundColor: pmAvatar ? 'transparent' : '#f59e0b' }
                          ]}>
                            {pmAvatar ? (
                              <Image source={{ uri: pmAvatar }} style={styles.memberAvatarImg} />
                            ) : (
                              <Text style={styles.memberAvatarText}>
                                {pmName.charAt(0).toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <View style={styles.memberInfo}>
                            <Text style={styles.memberName} numberOfLines={1}>{pmName}</Text>
                            <Text style={{ fontSize: 10, color: '#999' }}>Được mời bởi {addedByName}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              onPress={() => handleApprovePending(uid)}
                              style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' }}
                            >
                              <Ionicons name="checkmark" size={18} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleRejectPending(uid)}
                              style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' }}
                            >
                              <Ionicons name="close" size={18} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            )}

            {/* Settings */}
            <View style={styles.section}>
              <OptionItem 
                icon="pin-outline" 
                label="Ghim trò chuyện" 
                toggle 
                toggleValue={isPinned} 
                onToggle={handleTogglePin} 
              />
              <OptionItem 
                icon="eye-off-outline" 
                label="Ẩn trò chuyện" 
                toggle 
                toggleValue={isHidden} 
                onToggle={setIsHidden} 
              />
              <OptionItem icon="settings-outline" label="Cài đặt cá nhân" />
            </View>

            {/* Danger zone */}
            <View style={styles.section}>
              <OptionItem icon="warning-outline" label="Báo xấu" />
              <OptionItem icon="pie-chart-outline" label="Dung lượng trò chuyện" />
              
              <TouchableOpacity style={styles.optionRow} activeOpacity={0.7}>
                <View style={styles.optionLeft}>
                  <Ionicons name="trash-outline" size={22} color="#FF4757" style={styles.optionIcon} />
                  <Text style={[styles.optionLabel, { color: '#FF4757' }]}>Xóa lịch sử trò chuyện</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionRow} activeOpacity={0.7} onPress={handleLeaveGroup}>
                <View style={styles.optionLeft}>
                  <Ionicons name="log-out-outline" size={22} color="#FF4757" style={styles.optionIcon} />
                  <Text style={[styles.optionLabel, { color: '#FF4757' }]}>Rời nhóm</Text>
                </View>
              </TouchableOpacity>

              {/* Disband - only visible to leader */}
              {myRole === 'leader' && (
                <TouchableOpacity style={styles.optionRow} activeOpacity={0.7} onPress={handleDisbandGroup}>
                  <View style={styles.optionLeft}>
                    <Ionicons name="nuclear-outline" size={22} color="#FF4757" style={styles.optionIcon} />
                    <Text style={[styles.optionLabel, { color: '#FF4757' }]}>Giải tán nhóm</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Section 4: Settings - Private chat */}
        {isGroup !== 'true' && (
        <View style={styles.section}>
          <OptionItem 
            icon="pin-outline" 
            label="Ghim trò chuyện" 
            toggle 
            toggleValue={isPinned} 
            onToggle={handleTogglePin} 
          />
          <OptionItem 
            icon="eye-off-outline" 
            label="Ẩn trò chuyện" 
            toggle 
            toggleValue={isHidden} 
            onToggle={setIsHidden} 
          />
          <OptionItem 
            icon="call-outline" 
            label="Báo cuộc gọi đến" 
            toggle 
            toggleValue={isCallNotifEnabled} 
            onToggle={setIsCallNotifEnabled} 
          />
          
          <TouchableOpacity style={styles.optionRow} activeOpacity={0.7}>
            <View style={styles.optionLeft}>
              <Ionicons name="timer-outline" size={22} color="#555" style={styles.optionIcon} />
              <View>
                <Text style={styles.optionLabel}>Tin nhắn tự xóa</Text>
                <Text style={styles.optionSubLabel}>Không tự xóa</Text>
              </View>
            </View>
          </TouchableOpacity>
          
          <OptionItem icon="settings-outline" label="Cài đặt cá nhân" showArrow />
        </View>
        )}

        {/* Section 5: Danger - Private chat */}
        {isGroup !== 'true' && (
        <View style={styles.section}>
          <OptionItem icon="warning-outline" label="Báo xấu" />
          <OptionItem icon="ban-outline" label="Quản lý chặn" showArrow />
          <OptionItem icon="pie-chart-outline" label="Dung lượng trò chuyện" showArrow />
          
          <TouchableOpacity style={styles.optionRow} activeOpacity={0.7}>
            <View style={styles.optionLeft}>
              <Ionicons name="trash-outline" size={22} color="#FF4757" style={styles.optionIcon} />
              <Text style={[styles.optionLabel, { color: '#FF4757' }]}>Xóa lịch sử trò chuyện</Text>
            </View>
          </TouchableOpacity>
        </View>
        )}

      </ScrollView>

      <AddMemberModal 
        visible={isAddMemberVisible}
        onClose={() => setIsAddMemberVisible(false)}
        conversationId={id as string}
        onConfirm={handleConfirmAddMember}
      />

      <CreatePollModal
        visible={showPollModal}
        onClose={() => setShowPollModal(false)}
        onCreate={handleCreatePoll}
      />

      {/* Rename Modal */}
      <Modal
        visible={isRenameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.renameModalBox}>
            <Text style={styles.modalTitle}>Đổi tên nhóm</Text>
            <View style={styles.renameInputWrap}>
              <TextInput
                style={styles.renameInput}
                value={tempGroupName}
                onChangeText={setTempGroupName}
                placeholder="Nhập tên nhóm mới..."
                placeholderTextColor="#999"
                autoFocus
                maxLength={100}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalBtn} 
                onPress={() => setIsRenameModalVisible(false)}
              >
                <Text style={styles.modalBtnTextCancel}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnPrimary]} 
                onPress={handleRenameSubmit}
                disabled={isRenaming}
              >
                {isRenaming ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnTextPrimary}>Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* User Profile Card Modal */}
      <Modal visible={!!selectedUserProfile} transparent animationType="slide" onRequestClose={() => setSelectedUserProfile(null)}>
        <View style={styles.mentionDialogOverlay}>
          <View style={styles.profileCardContainer}>
            {/* Cover photo */}
            <View style={styles.profileCardCoverWrap}>
              {selectedUserProfile?.coverUrl ? (
                <Image source={{ uri: selectedUserProfile.coverUrl }} style={styles.profileCardCover} />
              ) : (
                <View style={[styles.profileCardCover, { backgroundColor: '#005FD8' }]} />
              )}
              {/* Close button */}
              <TouchableOpacity style={styles.profileCardCloseBtn} onPress={() => setSelectedUserProfile(null)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Avatar */}
            <View style={styles.profileCardAvatarWrap}>
              {selectedUserProfile?.avatarUrl ? (
                <Image source={{ uri: selectedUserProfile.avatarUrl }} style={styles.profileCardAvatar} />
              ) : (
                <View style={styles.profileCardAvatarPlaceholder}>
                  <Ionicons name="person" size={40} color="#fff" />
                </View>
              )}
            </View>

            {/* Name */}
            <Text style={styles.profileCardName}>{selectedUserProfile?.fullName}</Text>

            {/* Details card */}
            <View style={styles.profileCardInfoWrap}>
              <Text style={styles.profileCardInfoTitle}>Thông tin cá nhân</Text>
              
              <View style={styles.profileCardInfoRow}>
                <Text style={styles.profileCardInfoLabel}>Giới tính</Text>
                <Text style={styles.profileCardInfoValue}>{selectedUserProfile?.gender || 'Chưa cập nhật'}</Text>
              </View>

              <View style={styles.profileCardInfoRow}>
                <Text style={styles.profileCardInfoLabel}>Ngày sinh</Text>
                <Text style={styles.profileCardInfoValue}>
                  {selectedUserProfile?.birthday ? new Date(selectedUserProfile.birthday).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}
                </Text>
              </View>

              <View style={styles.profileCardInfoRow}>
                <Text style={styles.profileCardInfoLabel}>ID người dùng</Text>
                <Text style={styles.profileCardInfoValue}>#{selectedUserProfile?.id || '---'}</Text>
              </View>

              <View style={styles.profileCardInfoRow}>
                <Text style={styles.profileCardInfoLabel}>Số điện thoại</Text>
                <Text style={styles.profileCardInfoValue}>{selectedUserProfile?.phone || 'Ẩn'}</Text>
              </View>
            </View>

            {/* Footer action buttons */}
            <View style={styles.profileCardFooter}>
              <TouchableOpacity 
                style={styles.profileCardFooterBtn} 
                onPress={() => {
                  setSelectedUserProfile(null);
                  router.back();
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                <Text style={styles.profileCardFooterBtnText}>Nhắn tin</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.profileCardFooterBtn, { backgroundColor: '#e0e0e0' }]} 
                onPress={() => setSelectedUserProfile(null)}
              >
                <Text style={{ color: '#333', fontWeight: '600' }}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wallpaper Picker Modal */}
      <Modal
        visible={wallpaperModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWallpaperModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setWallpaperModalVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.wallpaperModalContainer}
          >
            <View style={styles.wallpaperModalHeader}>
              <Text style={styles.wallpaperModalTitle}>Hình nền trò chuyện</Text>
              <TouchableOpacity onPress={() => setWallpaperModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Presets Grid */}
            <Text style={styles.wallpaperSectionTitle}>Màu đơn sắc nhã nhặn</Text>
            <View style={styles.wallpaperGrid}>
              {[
                { label: 'Mặc định', color: '#e2e9f1', isDefault: true },
                { label: 'Xanh dương', color: '#e3f2fd' },
                { label: 'Hồng đào', color: '#ffe0b2' },
                { label: 'Hồng phấn', color: '#f8bbd0' },
                { label: 'Xanh lá', color: '#e8f5e9' },
                { label: 'Oải hương', color: '#f3e5f5' },
                { label: 'Xám tối', color: '#263238' },
              ].map((item, idx) => {
                const isSelected = (!currentWallpaper && item.isDefault) || currentWallpaper === item.color;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.wallpaperColorItem, { backgroundColor: item.color }]}
                    onPress={() => item.isDefault ? handleResetWallpaper() : handleSelectColorWallpaper(item.color)}
                  >
                    {isSelected && (
                      <View style={styles.selectedWallpaperCheck}>
                        <Ionicons name="checkmark-circle" size={24} color={item.color === '#263238' ? '#fff' : '#0068FF'} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Photo options */}
            <View style={styles.wallpaperActionList}>
              <TouchableOpacity 
                style={styles.wallpaperActionRow} 
                onPress={() => handleSelectWallpaper('library')}
              >
                <Ionicons name="image" size={22} color="#0068FF" />
                <Text style={styles.wallpaperActionLabel}>Chọn từ thư viện ảnh</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.wallpaperActionRow} 
                onPress={() => handleSelectWallpaper('camera')}
              >
                <Ionicons name="camera" size={22} color="#0068FF" />
                <Text style={styles.wallpaperActionLabel}>Chụp ảnh mới</Text>
              </TouchableOpacity>

              {currentWallpaper && (
                <TouchableOpacity 
                  style={[styles.wallpaperActionRow, { borderBottomWidth: 0 }]} 
                  onPress={handleResetWallpaper}
                >
                  <Ionicons name="trash" size={22} color="#FF4757" />
                  <Text style={[styles.wallpaperActionLabel, { color: '#FF4757' }]}>Xóa hình nền hiện tại</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Nickname Modal */}
      <Modal
        visible={isNicknameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsNicknameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.renameModalBox}>
            <Text style={styles.modalTitle}>Đổi tên gợi nhớ</Text>
            <View style={styles.renameInputWrap}>
              <TextInput
                style={styles.renameInput}
                value={tempNickname}
                onChangeText={setTempNickname}
                placeholder="Nhập tên gợi nhớ..."
                placeholderTextColor="#999"
                autoFocus
                maxLength={50}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalBtn} 
                onPress={() => setIsNicknameModalVisible(false)}
              >
                <Text style={styles.modalBtnTextCancel}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnPrimary]} 
                onPress={handleSaveNickname}
                disabled={isSavingNickname}
              >
                {isSavingNickname ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnTextPrimary}>Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <CreateGroupModal
        visible={createGroupVisible}
        onClose={() => setCreateGroupVisible(false)}
        preselectedUserId={recipientId || (id && typeof id === 'string' && !id.startsWith('cloud_') ? id : undefined)}
      />

      {/* Add To Group Modal */}
      <Modal
        visible={addToGroupVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddToGroupVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setAddToGroupVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.groupModalContainer}
          >
            <View style={styles.wallpaperModalHeader}>
              <Text style={styles.wallpaperModalTitle}>Thêm vào nhóm</Text>
              <TouchableOpacity onPress={() => setAddToGroupVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.wallpaperSectionTitle}>Chọn nhóm muốn thêm {displayName || name || 'người này'}</Text>
            
            {isLoadingGroups ? (
              <ActivityIndicator size="large" color={ZaloColors.blue} style={{ marginVertical: 30 }} />
            ) : availableGroups.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="people-outline" size={48} color="#bbb" />
                <Text style={{ color: '#888', marginTop: 10, fontSize: 15 }}>Không có nhóm nào hợp lệ</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                {availableGroups.map((group) => {
                  const memberCount = group.participants?.length || 0;
                  return (
                    <TouchableOpacity
                      key={group.conversationId}
                      style={styles.modalGroupRow}
                      onPress={() => handleAddFriendToGroup(group)}
                    >
                      {group.groupAvatar ? (
                        <Image source={{ uri: group.groupAvatar }} style={styles.modalGroupAvatar} />
                      ) : (
                        <View style={[styles.modalGroupAvatar, styles.defaultGroupAvatar]}>
                          <Ionicons name="people" size={20} color="#fff" />
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.modalGroupName} numberOfLines={1}>
                          {group.groupName || 'Nhóm chat'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                          {memberCount} thành viên
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#ccc" />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Common Groups Modal */}
      <Modal
        visible={commonGroupsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCommonGroupsVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setCommonGroupsVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.groupModalContainer}
          >
            <View style={styles.wallpaperModalHeader}>
              <Text style={styles.wallpaperModalTitle}>Nhóm chung ({commonGroups.length})</Text>
              <TouchableOpacity onPress={() => setCommonGroupsVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.wallpaperSectionTitle}>Các nhóm cả hai cùng tham gia</Text>
            
            {isLoadingGroups ? (
              <ActivityIndicator size="large" color={ZaloColors.blue} style={{ marginVertical: 30 }} />
            ) : commonGroups.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="people-outline" size={48} color="#bbb" />
                <Text style={{ color: '#888', marginTop: 10, fontSize: 15 }}>Chưa có nhóm chung nào</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                {commonGroups.map((group) => {
                  const memberCount = group.participants?.length || 0;
                  return (
                    <TouchableOpacity
                      key={group.conversationId}
                      style={styles.modalGroupRow}
                      onPress={() => {
                        setCommonGroupsVisible(false);
                        router.navigate({
                          pathname: '/chat/[id]',
                          params: { 
                            id: group.conversationId, 
                            name: group.groupName || 'Nhóm chat', 
                            avatar: group.groupAvatar || '', 
                            isGroup: 'true' 
                          }
                        });
                      }}
                    >
                      {group.groupAvatar ? (
                        <Image source={{ uri: group.groupAvatar }} style={styles.modalGroupAvatar} />
                      ) : (
                        <View style={[styles.modalGroupAvatar, styles.defaultGroupAvatar]}>
                          <Ionicons name="people" size={20} color="#fff" />
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.modalGroupName} numberOfLines={1}>
                          {group.groupName || 'Nhóm chat'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                          {memberCount} thành viên
                        </Text>
                      </View>
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color={ZaloColors.blue} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    height: 56,
    backgroundColor: ZaloColors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  
  profileSection: {
    backgroundColor: '#fff',
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  defaultAvatar: {
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  profileNameGroup: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
  },
  nameEditIcon: {
    marginLeft: 8,
  },
  
  actionCirclesRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 16,
  },
  actionCircleItem: {
    alignItems: 'center',
    width: 70,
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionCircleLabel: {
    fontSize: 12,
    color: '#444',
    textAlign: 'center',
    lineHeight: 16,
  },
  
  section: {
    backgroundColor: '#fff',
    marginBottom: 8,
    paddingVertical: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  optionIcon: {
    width: 28,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    color: '#000',
  },
  optionSubLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  inviteLinkDetail: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    backgroundColor: '#fff',
  },
  inviteLinkInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  inviteLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fb',
    borderRadius: 8,
    padding: 10,
    gap: 10,
  },
  inviteLinkText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  copyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: ZaloColors.blue,
  },
  resetLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  resetLinkText: {
    fontSize: 13,
    color: ZaloColors.blue,
    fontWeight: '500',
  },
  
  optionRowMedia: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  optionLeftMedia: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaPreviewScroll: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    gap: 8,
  },
  mediaPlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  mediaPreviewImg: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  videoIconSmall: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    padding: 2,
  },
  mediaMoreBtn: {
    width: 60,
    height: 60,
    backgroundColor: '#e6f0ff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ═══════ Member List Styles ═══════
  memberList: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    position: 'relative',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  memberAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberAvatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 3,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  memberMenuBtn: {
    padding: 8,
  },
  memberDropdown: {
    position: 'absolute',
    right: 12,
    top: 48,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#eee',
    minWidth: 220,
    zIndex: 100,
    overflow: 'hidden',
  },
  memberDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  memberDropdownText: {
    fontSize: 14,
    color: '#333',
  },
  memberActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    marginLeft: 52,
  },
  memberActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#eee',
  },
  memberActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  renameModalBox: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 20,
    textAlign: 'center',
  },
  renameInputWrap: {
    backgroundColor: '#f5f7fb',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e1e8f0',
  },
  renameInput: {
    height: 52,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnPrimary: {
    backgroundColor: ZaloColors.blue,
  },
  modalBtnTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalBtnTextPrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  
  // Custom Profile Card Modals
  mentionDialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCardContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '85%',
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  profileCardCoverWrap: {
    position: 'relative',
    height: 120,
    width: '100%',
  },
  profileCardCover: {
    height: 120,
    width: '100%',
  },
  profileCardCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCardAvatarWrap: {
    alignSelf: 'center',
    marginTop: -40,
    position: 'relative',
    zIndex: 1,
  },
  profileCardAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileCardAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#b0c4de',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCardName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  profileCardInfoWrap: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  profileCardInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  profileCardInfoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  profileCardInfoLabel: {
    width: 110,
    fontSize: 14,
    color: '#888',
  },
  profileCardInfoValue: {
    flex: 1,
    fontSize: 14,
    color: '#111',
    fontWeight: '500',
  },
  profileCardFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
  },
  profileCardFooterBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    borderRadius: 8,
    backgroundColor: '#0068FF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  profileCardFooterBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },

  // Wallpaper Picker Styles
  wallpaperModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    padding: 24,
    paddingBottom: 40,
    marginTop: 'auto',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
  },
  wallpaperModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  wallpaperModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  wallpaperSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  wallpaperGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  wallpaperColorItem: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    position: 'relative',
  },
  selectedWallpaperCheck: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  wallpaperActionList: {
    backgroundColor: '#f5f7fb',
    borderRadius: 16,
    overflow: 'hidden',
  },
  wallpaperActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e1e8f0',
    gap: 12,
  },
  wallpaperActionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0068FF',
  },
  
  // Group action styles
  groupModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    padding: 24,
    paddingBottom: 40,
    marginTop: 'auto',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
  },
  modalGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  modalGroupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  defaultGroupAvatar: {
    backgroundColor: '#0068FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalGroupName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
});

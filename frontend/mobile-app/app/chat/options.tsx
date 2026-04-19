import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Alert, ActivityIndicator, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ZaloColors } from '@/constants/zalo';
import AddMemberModal from '@/components/chat/AddMemberModal';
import { useSocket } from '@/contexts/SocketContext';
import { chatApiClient } from '@/constants/chatApi';
import apiClient from '@/constants/api';

export default function ChatOptionsScreen() {
  const router = useRouter();
  const { id, name, avatar, isGroup } = useLocalSearchParams();
  
  const [isBestFriend, setIsBestFriend] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isCallNotifEnabled, setIsCallNotifEnabled] = useState(true);
  const [isAddMemberVisible, setIsAddMemberVisible] = useState(false);
  const { currentUserId } = useSocket();

  // Group management states
  const [participants, setParticipants] = useState<any[]>([]);
  const [memberMap, setMemberMap] = useState<Record<string, { fullName: string; avatarUrl?: string }>>({});
  const [expandedMembers, setExpandedMembers] = useState(true);
  const [menuOpenUid, setMenuOpenUid] = useState<string | null>(null);
  const [isLoadingGroup, setIsLoadingGroup] = useState(false);

  // Get current user's role
  const myRole = useMemo(() => {
    if (isGroup !== 'true' || !currentUserId) return 'member';
    const me = participants.find(p => String(p.userId) === String(currentUserId));
    console.log('[GroupOptions] myRole check: currentUserId=', currentUserId, 'participants userIds=', participants.map(p => p.userId), 'foundMe=', !!me, 'role=', me?.role);
    return me?.role || 'member';
  }, [participants, currentUserId, isGroup]);

  // Fetch group data
  useEffect(() => {
    if (isGroup !== 'true' || !currentUserId || !id) return;
    
    const fetchGroupData = async () => {
      setIsLoadingGroup(true);
      try {
        const convRes = await chatApiClient.get(`/conversations/${currentUserId}`);
        
        // Debug: check response structure
        const rawData = convRes.data;
        const allConvs = rawData?.data || rawData || [];
        const conversations = Array.isArray(allConvs) ? allConvs : [];
        const thisConv = conversations.find((c: any) => c.conversationId === id);
        
        console.log('[GroupOptions] Found conv:', !!thisConv, 'participants count:', thisConv?.participants?.length);
        console.log('[GroupOptions] First participant:', JSON.stringify(thisConv?.participants?.[0]));
        console.log('[GroupOptions] My userId:', currentUserId);
        
        if (thisConv?.participants) {
          setParticipants(thisConv.participants);
          
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
        console.log('Error fetching group data:', err);
      } finally {
        setIsLoadingGroup(false);
      }
    };
    
    fetchGroupData();
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
    Alert.alert('Rời nhóm', 'Bạn có chắc chắn muốn rời khỏi nhóm này?', [
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
            router.replace('/(tabs)/messages');
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
              router.replace('/(tabs)/messages');
            } catch (err: any) {
              Alert.alert('Lỗi', err.response?.data?.message || 'Không thể giải tán nhóm');
            }
          },
        },
      ]
    );
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
          <View style={styles.avatarWrap}>
            {avatar ? (
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
          </View>
          
          {isGroup === 'true' ? (
            <View style={styles.nameWrap}>
              <Text style={styles.profileNameGroup} numberOfLines={2}>{name}</Text>
              <Ionicons name="pencil-outline" size={20} color="#555" style={styles.nameEditIcon} />
            </View>
          ) : (
            <Text style={styles.profileName} numberOfLines={2}>{name}</Text>
          )}

          <View style={styles.actionCirclesRow}>
            <TouchableOpacity style={styles.actionCircleItem}>
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
              <TouchableOpacity style={styles.actionCircleItem}>
                <View style={styles.actionCircle}>
                  <Ionicons name="person-outline" size={24} color="#444" />
                </View>
                <Text style={styles.actionCircleLabel}>Trang{'\n'}cá nhân</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.actionCircleItem}>
              <View style={styles.actionCircle}>
                <Ionicons name="color-palette-outline" size={24} color="#444" />
              </View>
              <Text style={styles.actionCircleLabel}>Đổi{'\n'}hình nền</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCircleItem}>
              <View style={isGroup === 'true' ? [styles.actionCircle, {backgroundColor: ZaloColors.blue}] : styles.actionCircle}>
                <Ionicons name={isGroup === 'true' ? "notifications" : "notifications-outline"} size={24} color={isGroup === 'true' ? "#fff" : "#444"} />
              </View>
              <Text style={styles.actionCircleLabel}>{isGroup === 'true' ? 'Bật\nthông báo' : 'Tắt\nthông báo'}</Text>
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
          <OptionItem icon="pencil-outline" label="Đổi tên gợi nhớ" />
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
          <TouchableOpacity style={styles.optionRowMedia} activeOpacity={0.7}>
            <View style={styles.optionLeftMedia}>
              <Ionicons name="images-outline" size={22} color="#555" style={styles.optionIcon} />
              <Text style={styles.optionLabel}>Ảnh, file, link</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaPreviewScroll}>
            {[1, 2, 3, 4].map((item) => (
              <View key={item} style={styles.mediaPlaceholder}>
                <Ionicons name="image-outline" size={24} color="#999" />
              </View>
            ))}
            <View style={styles.mediaMoreBtn}>
              <Ionicons name="arrow-forward" size={20} color={ZaloColors.blue} />
            </View>
          </ScrollView>
        </View>

        {/* Section 3: Private chat group actions */}
        {isGroup !== 'true' && (
        <View style={styles.section}>
          <OptionItem icon="person-add-outline" label={`Tạo nhóm với ${name || 'người này'}`} />
          <OptionItem icon="person-add-outline" label={`Thêm ${name || 'người này'} vào nhóm`} />
          <OptionItem icon="people-outline" label="Xem nhóm chung (26)" showArrow />
        </View>
        )}

        {/* Group Specific Sections */}
        {isGroup === 'true' && (
          <>
            <View style={styles.section}>
              <OptionItem icon="calendar-outline" label="Lịch nhóm" />
              <OptionItem icon="pin-outline" label="Tin nhắn đã ghim" />
              <OptionItem icon="bar-chart-outline" label="Bình chọn" />
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
                              { backgroundColor: memberAvatar ? 'transparent' : (isMe ? '#10b981' : ZaloColors.blue) }
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
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.memberName} numberOfLines={1}>{memberName}</Text>
                                {role === 'leader' && (
                                  <Ionicons name="shield-checkmark" size={16} color="#e67e00" style={{ marginLeft: 6 }} />
                                )}
                                {role === 'deputy' && (
                                  <Ionicons name="star" size={14} color="#10b981" style={{ marginLeft: 6 }} />
                                )}
                              </View>
                              {badge && (
                                <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                                  <Text style={[styles.roleBadgeText, { color: badge.color }]}>
                                    {badge.label}
                                  </Text>
                                </View>
                              )}
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
              <TouchableOpacity style={styles.optionRow} activeOpacity={0.7}>
                <View style={styles.optionLeft}>
                  <Ionicons name="link-outline" size={22} color="#555" style={styles.optionIcon} />
                  <View>
                    <Text style={styles.optionLabel}>Link nhóm</Text>
                    <Text style={styles.optionSubLabel}>https://zalo.me/g/...</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Settings */}
            <View style={styles.section}>
              <OptionItem 
                icon="pin-outline" 
                label="Ghim trò chuyện" 
                toggle 
                toggleValue={isPinned} 
                onToggle={setIsPinned} 
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
            onToggle={setIsPinned} 
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
});

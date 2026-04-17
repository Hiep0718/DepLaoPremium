import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ZaloColors } from '@/constants/zalo';

export default function ChatOptionsScreen() {
  const router = useRouter();
  const { id, name, avatar, isGroup } = useLocalSearchParams();
  
  const [isBestFriend, setIsBestFriend] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isCallNotifEnabled, setIsCallNotifEnabled] = useState(true);

  // Grouped item component
  const OptionItem = ({ icon, color, label, showArrow, toggle, toggleValue, onToggle, dangerous }: any) => (
    <TouchableOpacity 
      style={styles.optionRow} 
      activeOpacity={0.7}
      disabled={!!toggle}
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
              <TouchableOpacity style={styles.actionCircleItem}>
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

        {/* Section 1 */}
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

        {/* Section 3: Group Actions */}
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
            <View style={styles.section}>
              <OptionItem icon="people-outline" label="Xem thành viên (5)" />
              <TouchableOpacity style={styles.optionRow} activeOpacity={0.7}>
                <View style={styles.optionLeft}>
                  <Ionicons name="link-outline" size={22} color="#555" style={styles.optionIcon} />
                  <View>
                    <Text style={styles.optionLabel}>Link nhóm</Text>
                    <Text style={styles.optionSubLabel}>https://zalo.me/g/mswsak197</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
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
            <View style={styles.section}>
              <OptionItem icon="warning-outline" label="Báo xấu" />
              <OptionItem icon="pie-chart-outline" label="Dung lượng trò chuyện" />
              <TouchableOpacity style={styles.optionRow} activeOpacity={0.7}>
                <View style={styles.optionLeft}>
                  <Ionicons name="trash-outline" size={22} color="#FF4757" style={styles.optionIcon} />
                  <Text style={[styles.optionLabel, { color: '#FF4757' }]}>Xóa lịch sử trò chuyện</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionRow} activeOpacity={0.7}>
                <View style={styles.optionLeft}>
                  <Ionicons name="log-out-outline" size={22} color="#FF4757" style={styles.optionIcon} />
                  <Text style={[styles.optionLabel, { color: '#FF4757' }]}>Rời nhóm</Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Section 4: Settings */}
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

        {/* Section 5: Danger */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Light gray background
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
});

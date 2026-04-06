import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImagePickerButton } from '@/components/ImagePickerButton';
import { useProfile } from '@/hooks/useProfile';
import { ZaloColors } from '@/constants/zalo';
import apiClient from '@/constants/api';

const ZALO_BLUE = '#0068FF';

export function ProfileScreen() {
  const router = useRouter();
  const { profile, loading, uploading, updateProfile, pickAndUpload } = useProfile();

  // ─── Edit Profile Modal ───────────────────────────────────────────
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    setEditName(profile?.fullName ?? '');
    setEditGender(profile?.gender ?? '');
    setEditBirthday(profile?.birthday ?? '');
    setEditVisible(true);
  };

  const handleSave = async () => {
    if (!editName.trim() || editName.trim().length < 2) {
      Alert.alert('Lỗi', 'Tên phải có ít nhất 2 ký tự');
      return;
    }
    setSaving(true);
    const ok = await updateProfile({ 
      fullName: editName.trim(), 
      gender: editGender, 
      birthday: editBirthday 
    });
    setSaving(false);
    if (ok) {
      Alert.alert('Thành công', 'Cập nhật tài khoản thành công');
      setEditVisible(false);
    }
  };

  // ─── Change Password Modal ────────────────────────────────────────
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const openPassword = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordVisible(true);
  };

  const handleSavePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Lỗi', 'Vui lòng nhập đủ thông tin');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await apiClient.put('/users/password', { oldPassword, newPassword });
      if (res.data.success) {
        Alert.alert('Thành công', 'Cập nhật mật khẩu thành công');
        setPasswordVisible(false);
      } else {
        Alert.alert('Lỗi', res.data.message || 'Có lỗi xảy ra');
      }
    } catch (err: any) {
      Alert.alert('Lỗi', err?.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setPasswordSaving(false);
    }
  };

  // ─── Đăng xuất ───────────────────────────────────────────────────
  const handleLogout = async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'userId']);
          router.replace('/welcome');
        },
      },
    ]);
  };

  const menuItems = [
    { id: '1', name: 'Chỉnh sửa hồ sơ', icon: 'pencil-outline', onPress: openEdit },
    { id: '1-1', name: 'Đổi mật khẩu', icon: 'lock-closed-outline', onPress: openPassword },
    { id: '2', name: 'Cài đặt', icon: 'settings-outline', onPress: () => {} },
    { id: '3', name: 'Quyền riêng tư', icon: 'shield-checkmark-outline', onPress: () => {} },
    { id: '4', name: 'Tài khoản', icon: 'person-outline', onPress: () => {} },
    { id: '5', name: 'Hỗ trợ', icon: 'help-circle-outline', onPress: () => {} },
    { id: '6', name: 'Đăng xuất', icon: 'log-out-outline', onPress: handleLogout },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ZALO_BLUE} />
      </View>
    );
  }

  const formatBirthday = (date: string) => {
    if (!date) return 'Chưa cập nhật';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return date;
      return d.toLocaleDateString('vi-VN');
    } catch {
      return date;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <ScrollView>
        {/* ── Cover + Avatar block ───────────────────────────────── */}
        <View style={styles.profileHeader}>
          {/* Ảnh bìa */}
          <View style={styles.coverWrap}>
            {profile?.coverUrl ? (
              <Image source={{ uri: profile.coverUrl }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, { backgroundColor: '#005FD8' }]} />
            )}
            <ImagePickerButton
              style={styles.coverPickerBtn}
              onPress={() => pickAndUpload('cover')}
              loading={uploading === 'cover'}
              iconSize={18}
            />
          </View>

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color="#fff" />
              </View>
            )}
            <ImagePickerButton
              style={styles.avatarPickerBtn}
              onPress={() => pickAndUpload('avatar')}
              loading={uploading === 'avatar'}
              iconSize={16}
            />
          </View>

          {/* Tên & số điện thoại */}
          <Text style={styles.name}>{profile?.fullName ?? 'Đang tải...'}</Text>
          <Text style={styles.phone}>{profile?.phone ?? ''}</Text>
        </View>

        {/* ── Thông tin cá nhân ──────────────────────────────────── */}
        <View style={[styles.menuCard, { paddingVertical: 12, marginBottom: 8 }]}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginLeft: 16, marginBottom: 8, color: '#111' }}>
            Thông tin cá nhân
          </Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Giới tính</Text>
            <Text style={styles.infoValue}>{profile?.gender || 'Chưa cập nhật'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ngày sinh</Text>
            <Text style={styles.infoValue}>{formatBirthday(profile?.birthday || '')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID</Text>
            <Text style={styles.infoValue}>#{profile?.id || '---'}</Text>
          </View>
        </View>

        {/* ── Menu items ─────────────────────────────────────────── */}
        <View style={styles.menuCard}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuRow,
                idx < menuItems.length - 1 && styles.menuRowBorder,
                item.name === 'Đăng xuất' && { marginTop: 12 },
              ]}
              onPress={item.onPress}
            >
              <Ionicons
                name={item.icon as any}
                size={22}
                color={item.name === 'Đăng xuất' ? '#e74c3c' : ZALO_BLUE}
                style={{ marginRight: 14 }}
              />
              <Text
                style={[
                  styles.menuText,
                  item.name === 'Đăng xuất' && { color: '#e74c3c' },
                ]}
              >
                {item.name}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Modal chỉnh sửa hồ sơ ─────────────────────────────────── */}
      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Chỉnh sửa hồ sơ</Text>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Tên hiển thị</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Nhập tên của bạn"
                maxLength={100}
              />

              <Text style={styles.label}>Giới tính</Text>
              <View style={styles.pickerContainer}>
                <TouchableOpacity 
                  style={[styles.genderOption, editGender === 'Nam' && styles.genderOptionActive]} 
                  onPress={() => setEditGender('Nam')}
                >
                  <Text style={[styles.genderOptionText, editGender === 'Nam' && styles.genderOptionTextActive]}>Nam</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.genderOption, editGender === 'Nữ' && styles.genderOptionActive]} 
                  onPress={() => setEditGender('Nữ')}
                >
                  <Text style={[styles.genderOptionText, editGender === 'Nữ' && styles.genderOptionTextActive]}>Nữ</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.genderOption, editGender === 'Khác' && styles.genderOptionActive]} 
                  onPress={() => setEditGender('Khác')}
                >
                  <Text style={[styles.genderOptionText, editGender === 'Khác' && styles.genderOptionTextActive]}>Khác</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Ngày sinh (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={editBirthday}
                onChangeText={setEditBirthday}
                placeholder="VD: 2000-12-31"
              />
            </ScrollView>

            <View style={[styles.modalActions, { marginTop: 16 }]}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setEditVisible(false)}
              >
                <Text style={{ color: '#666' }}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnSave, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal đổi mật khẩu ────────────────────────────────────── */}
      <Modal visible={passwordVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Đổi mật khẩu</Text>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Mật khẩu hiện tại</Text>
              <TextInput
                style={styles.input}
                value={oldPassword}
                onChangeText={setOldPassword}
                placeholder="Nhập mật khẩu hiện tại"
                secureTextEntry
              />

              <Text style={styles.label}>Mật khẩu mới</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Nhập mật khẩu mới"
                secureTextEntry
              />

              <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Nhập lại mật khẩu mới"
                secureTextEntry
              />
            </ScrollView>

            <View style={[styles.modalActions, { marginTop: 16 }]}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setPasswordVisible(false)}
              >
                <Text style={{ color: '#666' }}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnSave, passwordSaving && { opacity: 0.6 }]}
                onPress={handleSavePassword}
                disabled={passwordSaving}
              >
                {passwordSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Cập nhật</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  profileHeader: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingBottom: 20,
    marginBottom: 8,
  },
  coverWrap: { width: '100%', height: 140, position: 'relative' },
  cover: { width: '100%', height: 140 },
  coverPickerBtn: {
    position: 'absolute',
    bottom: 8,
    right: 12,
  },

  avatarWrap: {
    position: 'relative',
    marginTop: -44,
    marginBottom: 10,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#b0c4de',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarPickerBtn: {
    position: 'absolute',
    bottom: 0,
    right: -2,
  },

  name: { fontSize: 20, fontWeight: '700', color: '#000' },
  phone: { fontSize: 13, color: '#888', marginTop: 4 },

  // Info Section
  infoRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  infoLabel: {
    width: 100,
    fontSize: 14,
    color: '#888',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#111',
    fontWeight: '500',
  },

  // Menu
  menuCard: {
    backgroundColor: '#fff',
    marginHorizontal: 0,
    borderRadius: 0,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  menuText: { flex: 1, fontSize: 15, color: '#000' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, color: '#888', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  genderOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  genderOptionActive: {
    borderColor: ZaloColors.blue,
    backgroundColor: 'rgba(0, 104, 255, 0.05)',
  },
  genderOptionText: {
    color: '#666',
    fontWeight: '500',
  },
  genderOptionTextActive: {
    color: ZaloColors.blue,
  },

  modalActions: { flexDirection: 'row', gap: 12 },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  btnSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: ZaloColors.blue,
    alignItems: 'center',
  },
});

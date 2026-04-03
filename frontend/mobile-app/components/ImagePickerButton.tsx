/**
 * ImagePickerButton - Nút / Overlay dùng lại được để chọn ảnh.
 * Đặt chồng lên Avatar hoặc Cover, hiển thị icon máy ảnh + loading.
 */
import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ImagePickerButtonProps {
  onPress: () => void;
  loading?: boolean;
  style?: ViewStyle;
  iconSize?: number;
}

export function ImagePickerButton({
  onPress,
  loading = false,
  style,
  iconSize = 20,
}: ImagePickerButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.btn, style]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name="camera" size={iconSize} color="#fff" />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
    padding: 6,
  },
});

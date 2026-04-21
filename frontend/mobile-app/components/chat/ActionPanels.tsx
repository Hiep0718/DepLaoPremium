import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STICKERS } from '@/constants/stickers';

interface ActionPanelsProps {
  showStickers: boolean;
  stickerPanelHeight: Animated.Value;
  toggleStickerPanel: (show?: boolean) => void;
  sendSticker: (stickerUrl: string) => void;
  
  showMoreActions: boolean;
  moreActionsPanelHeight: Animated.Value;
  toggleMoreActions: (show?: boolean) => void;
  
  handleSendLocation: () => void;
  handlePickDocument: () => void;
  setShowReminderModal: (show: boolean) => void;
  setShowContactModal: (show: boolean) => void;
  handlePickImage: () => void;
  setShowPollModal: (show: boolean) => void;
  canCreatePoll: boolean;
}

export default function ActionPanels({
  showStickers,
  stickerPanelHeight,
  toggleStickerPanel,
  sendSticker,
  
  showMoreActions,
  moreActionsPanelHeight,
  toggleMoreActions,
  
  handleSendLocation,
  handlePickDocument,
  setShowReminderModal,
  setShowContactModal,
  handlePickImage,
  setShowPollModal,
  canCreatePoll,
}: ActionPanelsProps) {
  return (
    <>
      {/* ────── Sticker Picker Panel ────── */}
      <Animated.View style={[styles.stickerPanel, { height: stickerPanelHeight }]}>
        {showStickers && (
          <View style={styles.stickerPanelInner}>
            <View style={styles.stickerPanelHeader}>
              <Text style={styles.stickerPanelTitle}>Nhãn dán</Text>
              <TouchableOpacity onPress={() => toggleStickerPanel(false)}>
                <Ionicons name="close" size={20} color="#888" />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.stickerGrid}
              showsVerticalScrollIndicator={false}
            >
              {STICKERS.map((sticker, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.stickerItem}
                  onPress={() => sendSticker(sticker)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: sticker }}
                    style={styles.stickerThumb}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {/* ────── More Actions Panel ────── */}
      <Animated.View style={[styles.moreActionsPanel, { height: moreActionsPanelHeight }]}>
        {showMoreActions && (
          <View style={styles.moreActionsPanelInner}>
            <ScrollView
              contentContainerStyle={styles.moreActionsGrid}
              showsVerticalScrollIndicator={false}
            >
              {/* Row 1 */}
              <TouchableOpacity style={styles.moreActionItem} onPress={() => { toggleMoreActions(false); handleSendLocation(); }}>
                <View style={[styles.moreActionIcon, { backgroundColor: '#FF4757' }]}>
                  <Ionicons name="location" size={26} color="#fff" />
                </View>
                <Text style={styles.moreActionLabel}>Vị trí</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.moreActionItem} onPress={() => { toggleMoreActions(false); handlePickDocument(); }}>
                <View style={[styles.moreActionIcon, { backgroundColor: '#3742fa' }]}>
                  <Ionicons name="document-text" size={26} color="#fff" />
                </View>
                <Text style={styles.moreActionLabel}>Tài liệu</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.moreActionItem} onPress={() => { toggleMoreActions(false); setShowReminderModal(true); }}>
                <View style={[styles.moreActionIcon, { backgroundColor: '#FF6348' }]}>
                  <Ionicons name="alarm" size={26} color="#fff" />
                </View>
                <Text style={styles.moreActionLabel}>Nhắc hẹn</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.moreActionItem}>
                <View style={[styles.moreActionIcon, { backgroundColor: '#1E90FF' }]}>
                  <Ionicons name="flash" size={26} color="#fff" />
                </View>
                <Text style={styles.moreActionLabel}>Tin nhắn nhanh</Text>
              </TouchableOpacity>

              {/* Row 2 */}
              <TouchableOpacity style={styles.moreActionItem}>
                <View style={[styles.moreActionIcon, { backgroundColor: '#2ED573' }]}>
                  <Ionicons name="cash" size={26} color="#fff" />
                </View>
                <Text style={styles.moreActionLabel}>Chuyển khoản</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.moreActionItem} onPress={() => { toggleMoreActions(false); setShowContactModal(true); }}>
                <View style={[styles.moreActionIcon, { backgroundColor: '#3742fa' }]}>
                  <Ionicons name="person-circle" size={26} color="#fff" />
                </View>
                <Text style={styles.moreActionLabel}>Danh thiếp</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.moreActionItem} onPress={() => { toggleMoreActions(false); handlePickImage(); }}>
                <View style={[styles.moreActionIcon, { backgroundColor: '#1E90FF' }]}>
                  <Ionicons name="folder-open" size={26} color="#fff" />
                </View>
                <Text style={styles.moreActionLabel}>My Documents</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.moreActionItem}>
                <View style={[styles.moreActionIcon, { backgroundColor: '#A55EEA' }]}>
                  <Ionicons name="card" size={26} color="#fff" />
                </View>
                <Text style={styles.moreActionLabel}>Gửi số tài khoản</Text>
              </TouchableOpacity>

              {/* Row 3 */}
              <TouchableOpacity style={styles.moreActionItem}>
                <View style={[styles.moreActionIcon, { backgroundColor: '#FECA57' }]}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>GIF</Text>
                </View>
                <Text style={styles.moreActionLabel}>GIF</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.moreActionItem}>
                <View style={[styles.moreActionIcon, { backgroundColor: '#FF6B81' }]}>
                  <Ionicons name="musical-notes" size={26} color="#fff" />
                </View>
                <Text style={styles.moreActionLabel}>Thu âm</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.moreActionItem}>
                <View style={[styles.moreActionIcon, { backgroundColor: '#FECA57' }]}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>Aa</Text>
                </View>
                <Text style={styles.moreActionLabel}>Kiểu chữ</Text>
              </TouchableOpacity>

              {canCreatePoll && (
                <TouchableOpacity style={styles.moreActionItem} onPress={() => { toggleMoreActions(false); setShowPollModal(true); }}>
                  <View style={[styles.moreActionIcon, { backgroundColor: '#0068FF' }]}>
                    <Ionicons name="stats-chart" size={26} color="#fff" />
                  </View>
                  <Text style={styles.moreActionLabel}>Bình chọn</Text>
                </TouchableOpacity>
              )}

            </ScrollView>
          </View>
        )}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  stickerPanel: {
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  stickerPanelInner: {
    flex: 1,
  },
  stickerPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  stickerPanelTitle: {
    fontWeight: '600',
    color: '#333',
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  stickerItem: {
    width: '25%',
    aspectRatio: 1,
    padding: 8,
  },
  stickerThumb: {
    flex: 1,
  },
  
  moreActionsPanel: {
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  moreActionsPanelInner: {
    flex: 1,
    padding: 16,
  },
  moreActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 16,
  },
  moreActionItem: {
    width: '21%',
    alignItems: 'center',
    marginBottom: 8,
  },
  moreActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  moreActionLabel: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
});

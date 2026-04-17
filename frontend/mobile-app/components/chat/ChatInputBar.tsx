import React, { RefObject } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ZaloColors } from '@/constants/zalo';

interface ChatInputBarProps {
  inputRef: any;
  text: string;
  handleTextChange: (val: string) => void;
  handleSend: () => void;
  isRecording: boolean;
  recordingTime: number;
  cancelRecording: () => void;
  stopAndSendRecording: () => void;
  startRecording: () => void;
  toggleStickerPanel: (show?: boolean) => void;
  showStickers: boolean;
  toggleMoreActions: (show?: boolean) => void;
  showMoreActions: boolean;
  handlePickImage: () => void;
}

export default function ChatInputBar({
  inputRef,
  text,
  handleTextChange,
  handleSend,
  isRecording,
  recordingTime,
  cancelRecording,
  stopAndSendRecording,
  startRecording,
  toggleStickerPanel,
  showStickers,
  toggleMoreActions,
  showMoreActions,
  handlePickImage,
}: ChatInputBarProps) {
  const formatRecordTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (isRecording) {
    return (
      <View style={styles.recordingBar}>
        <TouchableOpacity style={styles.recordCancelBtn} onPress={cancelRecording}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.recordingCenter}>
          <View style={styles.recordingDotOuter}>
            <View style={styles.recordingDot} />
          </View>
          <Text style={styles.recordingTimer}>{formatRecordTime(recordingTime)}</Text>
          <View style={styles.recordingWaveBars}>
            {[8, 14, 20, 12, 18, 10, 16, 22, 14, 8, 18, 12, 20, 10, 16].map((h, i) => (
              <View key={i} style={[styles.recordingWaveBar, { height: h }]} />
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.recordSendBtn} onPress={stopAndSendRecording}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.inputArea}>
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => toggleStickerPanel()}
      >
        <Ionicons
          name={showStickers ? 'happy' : 'happy-outline'}
          size={26}
          color={showStickers ? ZaloColors.blue : '#666'}
        />
      </TouchableOpacity>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="Tin nhắn"
        placeholderTextColor="#888"
        value={text}
        onChangeText={handleTextChange}
        multiline
        maxLength={1000}
      />
      {text.trim().length > 0 ? (
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Ionicons name="send" size={22} color={ZaloColors.blue} />
        </TouchableOpacity>
      ) : (
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => toggleMoreActions()}
          >
            <Ionicons
              name={showMoreActions ? 'ellipsis-horizontal' : 'ellipsis-horizontal'}
              size={24}
              color={showMoreActions ? ZaloColors.blue : '#666'}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={startRecording}>
            <Ionicons name="mic-outline" size={26} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handlePickImage}>
            <Ionicons name="image-outline" size={26} color="#666" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  iconBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    marginHorizontal: 4,
    color: '#000',
  },
  sendBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#FFD6D6',
  },
  recordingCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  recordingDotOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,71,87,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF4757',
  },
  recordingTimer: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF4757',
    fontVariant: ['tabular-nums'],
    minWidth: 50,
  },
  recordingWaveBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  recordingWaveBar: {
    width: 3,
    backgroundColor: '#FF6B81',
    borderRadius: 2,
  },
  recordCancelBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF4757',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ZaloColors.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

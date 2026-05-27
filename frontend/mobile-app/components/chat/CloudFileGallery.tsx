import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '@/types/chat';
import { ZaloColors } from '@/constants/zalo';

interface CloudFileGalleryProps {
  messages: Message[];
  memberMap?: Record<string, { fullName: string; avatarUrl?: string }>;
  currentUserId: string | null;
  onFilePress: (url: string, fileName?: string) => void;
  onFileOptionsPress?: (msg: Message) => void;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export default function CloudFileGallery({ messages, memberMap, currentUserId, onFilePress, onFileOptionsPress }: CloudFileGalleryProps) {
  // Group messages by date
  const groupedFiles = useMemo(() => {
    const groups: { dateLabel: string; items: Message[] }[] = [];
    const dateMap = new Map<string, Message[]>();

    messages.forEach(msg => {
      // Format date
      const date = msg.createdAt || msg.timestamp;
      let dateLabel = 'Không rõ';
      if (date) {
        const d = new Date(date);
        dateLabel = `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
      }

      if (!dateMap.has(dateLabel)) {
        dateMap.set(dateLabel, []);
      }
      dateMap.get(dateLabel)!.push(msg);
    });

    dateMap.forEach((items, dateLabel) => {
      groups.push({ dateLabel, items });
    });

    return groups;
  }, [messages]);

  const renderFileItem = (msg: Message) => {
    const displayName = msg.fileName || 
      (typeof msg.content === 'string' && msg.content.startsWith('[Tệp]') ? msg.content.replace('[Tệp] ', '').replace('[Tệp]', '') : null) || 
      (msg.fileUrl ? decodeURIComponent(msg.fileUrl.split('/').pop()?.split('?')[0] || '') : null) || 
      'Tệp đính kèm';
    
    const sizeText = formatFileSize(msg.fileSize);
    
    let senderName = 'Thành viên';
    if (String(msg.senderId) === String(currentUserId)) {
      senderName = 'Bạn';
    } else if (memberMap && memberMap[String(msg.senderId)]) {
      senderName = memberMap[String(msg.senderId)].fullName;
    }

    return (
      <View key={msg._id} style={styles.fileItemWrap}>
        <TouchableOpacity 
          activeOpacity={0.7}
          style={styles.fileItemMain}
          onPress={() => msg.fileUrl && onFilePress(msg.fileUrl, msg.fileName)}
        >
          <View style={styles.fileIconWrap}>
            <Ionicons name="document-attach" size={24} color="#fff" />
          </View>
          
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>{displayName}</Text>
            <View style={styles.fileMetaRow}>
              {sizeText ? <Text style={styles.fileMetaText}>{sizeText} • </Text> : null}
              <Text style={styles.fileMetaText}>{senderName}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.optionsBtn}
          onPress={() => onFileOptionsPress && onFileOptionsPress(msg)}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {groupedFiles.map(group => (
        <View key={group.dateLabel} style={styles.dateGroup}>
          <Text style={styles.dateLabel}>{group.dateLabel}</Text>
          <View style={styles.fileList}>
            {group.items.map(msg => renderFileItem(msg))}
          </View>
        </View>
      ))}

      {groupedFiles.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Chưa có tệp nào</Text>
        </View>
      )}
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  dateGroup: {
    marginTop: 16,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  fileList: {
    paddingHorizontal: 16,
  },
  fileItemWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  fileItemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#00B4D8', // Light blue background like the image
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  fileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileMetaText: {
    fontSize: 13,
    color: '#888',
  },
  optionsBtn: {
    padding: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 15,
  }
});

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Message } from '@/types/chat';
import { ZaloColors } from '@/constants/zalo';

interface CloudImageGalleryProps {
  messages: Message[];
  onImagePress: (url: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const SPACING = 2;
const ITEM_SIZE = (SCREEN_WIDTH - SPACING * (COLUMN_COUNT + 1)) / COLUMN_COUNT;

// Dummy data for AI classification
const CLASSIFICATIONS = [
  { id: '1', title: 'Mọi người', image: 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80' },
  { id: '2', title: 'Thú cưng', image: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80' },
  { id: '3', title: 'Giấy tờ', image: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80' },
];

export default function CloudImageGallery({ messages, onImagePress }: CloudImageGalleryProps) {
  // Group messages by date
  const groupedImages = useMemo(() => {
    const groups: { dateLabel: string; items: Message[] }[] = [];
    const dateMap = new Map<string, Message[]>();

    messages.forEach(msg => {
      // Get image url
      const imgSrc = msg.imageUrl || msg.fileUrl || (typeof msg.content === 'string' && msg.content.startsWith('http') ? msg.content : null);
      if (!imgSrc) return; // Skip if no image source

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

    // Convert map to array and sort dates if needed.
    // Messages from API are usually newest first, so iterating gives newest first naturally if dateMap preserves insertion order.
    dateMap.forEach((items, dateLabel) => {
      groups.push({ dateLabel, items });
    });

    return groups;
  }, [messages]);

  const renderImageItem = (msg: Message) => {
    const imgSrc = msg.imageUrl || msg.fileUrl || (typeof msg.content === 'string' ? msg.content : '');
    return (
      <TouchableOpacity 
        key={msg._id} 
        activeOpacity={0.8}
        style={styles.imageWrap}
        onPress={() => onImagePress(imgSrc)}
      >
        <Image source={{ uri: imgSrc }} style={styles.image} resizeMode="cover" />
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Phân loại tự động */}
      <View style={styles.classificationSection}>
        <Text style={styles.sectionTitle}>Phân loại tự động</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.classificationScroll}
        >
          {CLASSIFICATIONS.map(item => (
            <TouchableOpacity key={item.id} style={styles.classificationItem} activeOpacity={0.9}>
              <Image source={{ uri: item.image }} style={styles.classificationImage} />
              <View style={styles.classificationOverlay} />
              <Text style={styles.classificationText}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Danh sách ảnh theo ngày */}
      {groupedImages.map(group => (
        <View key={group.dateLabel} style={styles.dateGroup}>
          <Text style={styles.dateLabel}>{group.dateLabel}</Text>
          <View style={styles.imageGrid}>
            {group.items.map(msg => renderImageItem(msg))}
          </View>
        </View>
      ))}

      {groupedImages.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Chưa có hình ảnh nào</Text>
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
  classificationSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#004A99', // A slightly darker blue for section titles
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  classificationScroll: {
    paddingHorizontal: 12,
  },
  classificationItem: {
    width: 120,
    height: 80,
    borderRadius: 8,
    marginHorizontal: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  classificationImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  classificationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  classificationText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    padding: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dateGroup: {
    marginTop: 16,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING,
  },
  imageWrap: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginHorizontal: SPACING / 2,
    marginBottom: SPACING,
    backgroundColor: '#f0f0f0',
  },
  image: {
    width: '100%',
    height: '100%',
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

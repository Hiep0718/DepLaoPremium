import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Clipboard, Alert, Linking } from 'react-native';
import { Message } from '@/types/chat';

interface CloudTextGalleryProps {
  messages: Message[];
  onTextLongPress?: (msg: Message) => void;
}

// Helper to render text with basic link/phone highlighting
const renderTextContent = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const phoneRegex = /(\d{10,11})/g; // basic phone detection

  // Split by URL first
  const parts = text.split(urlRegex);
  
  return (
    <Text style={styles.textContent}>
      {parts.map((part, i) => {
        if (urlRegex.test(part)) {
          return (
            <Text
              key={`url-${i}`}
              style={styles.linkText}
              onPress={() => Linking.openURL(part).catch(() => {})}
            >
              {part}
            </Text>
          );
        }

        // Check for phone numbers in the non-url part
        const phoneParts = part.split(phoneRegex);
        if (phoneParts.length > 1) {
          return phoneParts.map((pPart, j) => {
            if (phoneRegex.test(pPart)) {
              return (
                <Text
                  key={`phone-${i}-${j}`}
                  style={styles.linkText}
                  onPress={() => Linking.openURL(`tel:${pPart}`).catch(() => {})}
                >
                  {pPart}
                </Text>
              );
            }
            return <Text key={`text-${i}-${j}`}>{pPart}</Text>;
          });
        }

        return <Text key={`text-${i}`}>{part}</Text>;
      })}
    </Text>
  );
};

export default function CloudTextGallery({ messages, onTextLongPress }: CloudTextGalleryProps) {
  // Group messages by date
  const groupedTexts = useMemo(() => {
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

  const handleCopy = (content: string) => {
    Clipboard.setString(content);
    Alert.alert('Đã sao chép', 'Nội dung đã được sao chép vào bộ nhớ tạm.');
  };

  const renderTextItem = (msg: Message) => {
    const content = typeof msg.content === 'string' ? msg.content : '';
    if (!content) return null;

    return (
      <TouchableOpacity 
        key={msg._id} 
        activeOpacity={0.8}
        style={styles.textBubble}
        onPress={() => handleCopy(content)}
        onLongPress={() => onTextLongPress && onTextLongPress(msg)}
      >
        {renderTextContent(content)}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {groupedTexts.map(group => (
          <View key={group.dateLabel} style={styles.dateGroup}>
            <Text style={styles.dateLabel}>{group.dateLabel}</Text>
            <View style={styles.textList}>
              {group.items.map(msg => renderTextItem(msg))}
            </View>
          </View>
        ))}

        {groupedTexts.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Chưa có văn bản nào</Text>
          </View>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef0f4', // Light gray background as shown in design
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
  textList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  textBubble: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  textContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  linkText: {
    color: '#0068FF',
    textDecorationLine: 'underline',
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

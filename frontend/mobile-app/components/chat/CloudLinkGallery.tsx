import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '@/types/chat';

interface CloudLinkGalleryProps {
  messages: Message[];
  memberMap?: Record<string, { fullName: string; avatarUrl?: string }>;
  currentUserId: string | null;
  onLinkOptionsPress?: (msg: Message) => void;
}

const extractUrl = (text: string): string | null => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches && matches.length > 0 ? matches[0] : null;
};

const getDomain = (url: string): string => {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '').toUpperCase();
  } catch {
    return 'LINK';
  }
};

const getThumbnailColor = (domain: string): string => {
  const colors = ['#48C7B4', '#5C93F9', '#F9A826', '#E91E63', '#9C27B0'];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function CloudLinkGallery({ messages, memberMap, currentUserId, onLinkOptionsPress }: CloudLinkGalleryProps) {
  // Group messages by date
  const groupedLinks = useMemo(() => {
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

  const renderLinkItem = (msg: Message) => {
    const content = typeof msg.content === 'string' ? msg.content : '';
    const url = extractUrl(content);
    if (!url) return null;

    const domain = getDomain(url);
    const thumbColor = getThumbnailColor(domain);
    const firstLetter = domain.charAt(0).toUpperCase();

    // The title can be the full content or just the URL
    // We'll display the content, but strip out the URL if it's identical, or just show content
    let title = content.length > 60 ? content.substring(0, 60) + '...' : content;
    if (title === url) {
      title = url; // If the message is just the URL
    }

    let senderName = 'Thành viên';
    if (String(msg.senderId) === String(currentUserId)) {
      senderName = 'Bạn';
    } else if (memberMap && memberMap[String(msg.senderId)]) {
      senderName = memberMap[String(msg.senderId)].fullName;
    }

    return (
      <View key={msg._id} style={styles.linkItemWrap}>
        <TouchableOpacity 
          activeOpacity={0.7}
          style={styles.linkItemMain}
          onPress={() => Linking.openURL(url).catch(e => console.log('Error opening link:', e))}
        >
          <View style={[styles.linkIconWrap, { backgroundColor: thumbColor }]}>
            <Text style={styles.linkIconText}>{firstLetter}</Text>
          </View>
          
          <View style={styles.linkInfo}>
            <Text style={styles.domainText}>{domain}</Text>
            <Text style={styles.titleText} numberOfLines={2}>{title}</Text>
            <Text style={styles.senderText}>{senderName}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.optionsBtn}
          onPress={() => onLinkOptionsPress && onLinkOptionsPress(msg)}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {groupedLinks.map(group => (
        <View key={group.dateLabel} style={styles.dateGroup}>
          <Text style={styles.dateLabel}>{group.dateLabel}</Text>
          <View style={styles.linkList}>
            {group.items.map(msg => renderLinkItem(msg))}
          </View>
        </View>
      ))}

      {groupedLinks.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Chưa có link nào</Text>
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
  linkList: {
    paddingHorizontal: 16,
  },
  linkItemWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  linkItemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  linkIconText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '400',
  },
  linkInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  domainText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0068FF',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  titleText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  senderText: {
    fontSize: 12,
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

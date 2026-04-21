import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator, Dimensions, ScrollView, Linking } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ZaloColors } from '@/constants/zalo';
import { chatApiClient } from '@/constants/chatApi';
import apiClient from '@/constants/api';
import { useSocket } from '@/contexts/SocketContext';
import { format, isYesterday, isToday, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SIZE = width / COLUMN_COUNT;

type TabType = 'media' | 'file' | 'link' | 'audio';

export default function MediaArchiveScreen() {
  const router = useRouter();
  const { id, initialTab } = useLocalSearchParams();
  const { currentUserId } = useSocket();

  const [activeTab, setActiveTab] = useState<TabType>((initialTab as TabType) || 'media');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters
  const [senderFilter, setSenderFilter] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [memberMap, setMemberMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as TabType);
    }
  }, [initialTab]);

  useEffect(() => {
    fetchMedia();
  }, [id, activeTab, senderFilter, timeFilter]);

  useEffect(() => {
    fetchParticipants();
  }, [id]);

  const fetchParticipants = async () => {
    try {
      const res = await chatApiClient.get(`/conversations/${currentUserId}`);
      const conv = (res.data?.data || []).find((c: any) => c.conversationId === id);
      if (conv?.participants) {
        setParticipants(conv.participants);
        const map: Record<string, string> = {};
        for (const p of conv.participants) {
          const uid = String(p.userId);
          try {
            const userRes = await apiClient.get(`/users/${uid}`);
            if (userRes.data?.data) {
              map[uid] = userRes.data.data.fullName || 'Thành viên';
            }
          } catch {
            map[uid] = 'Thành viên';
          }
        }
        setMemberMap(map);
      }
    } catch (err) {
      console.log('Error fetching participants:', err);
    }
  };

  const fetchMedia = async () => {
    setLoading(true);
    try {
      let url = `/conversation/${id}/media?type=${activeTab}`;
      if (senderFilter) url += `&senderId=${senderFilter}`;
      // timeFilter logic could be more complex, for now just simple
      
      const res = await chatApiClient.get(url);
      setMessages(res.data?.data || []);
    } catch (err) {
      console.log('Error fetching media:', err);
    } finally {
      setLoading(false);
    }
  };

  const groupedMessages = useMemo(() => {
    const groups: Record<string, any[]> = {};
    messages.forEach(msg => {
      const date = parseISO(msg.createdAt);
      let dateStr = '';
      if (isToday(date)) dateStr = 'Hôm nay';
      else if (isYesterday(date)) dateStr = 'Hôm qua';
      else dateStr = format(date, 'dd MMMM, yyyy', { locale: vi });

      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(msg);
    });
    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [messages]);

  const toggleSelect = (msgId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(msgId)) newSelected.delete(msgId);
    else newSelected.add(msgId);
    setSelectedIds(newSelected);
  };

  const renderMediaItem = ({ item }: { item: any }) => {
    const isSelected = selectedIds.has(item._id);
    return (
      <TouchableOpacity 
        style={styles.mediaItem}
        onPress={() => {
          if (isSelecting) {
            toggleSelect(item._id);
          } else if (typeof item.fileUrl === 'string') {
            Linking.openURL(item.fileUrl).catch(err => console.log('Error opening URL:', err));
          }
        }}
        onLongPress={() => {
          setIsSelecting(true);
          toggleSelect(item._id);
        }}
      >
        <Image source={{ uri: item.fileUrl }} style={styles.mediaImage} />
        {(item.messageType === 'video' || (typeof item.fileUrl === 'string' && /\.(mp4|m4v|mov|avi|wmv|flv|mkv|webm)$/i.test(item.fileUrl))) && (
          <View style={styles.videoOverlay}>
            <Ionicons name="play" size={20} color="#fff" />
          </View>
        )}
        {isSelecting && (
          <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
            {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderFileItem = ({ item }: { item: any }) => {
    const ext = item.fileUrl?.split('.').pop()?.toUpperCase() || 'FILE';
    const isSelected = selectedIds.has(item._id);
    return (
      <TouchableOpacity 
        style={styles.fileItem}
        onPress={() => {
          if (isSelecting) {
            toggleSelect(item._id);
          } else if (typeof item.fileUrl === 'string') {
            Linking.openURL(item.fileUrl).catch(err => console.log('Error opening URL:', err));
          }
        }}
      >
        <View style={styles.fileIcon}>
          <Ionicons name="document-text" size={30} color={ZaloColors.blue} />
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>{item.fileName || 'Tài liệu'}</Text>
          <Text style={styles.fileMeta}>{ext} • {item.fileSize ? (item.fileSize / 1024).toFixed(1) + ' KB' : 'N/A'}</Text>
        </View>
        {isSelecting && (
          <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
            {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderLinkItem = ({ item }: { item: any }) => {
    const isSelected = selectedIds.has(item._id);
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    const links = item.content.match(linkRegex) || [];
    return (
      <View style={styles.linkContainer}>
        {links.map((link: string, idx: number) => (
          <TouchableOpacity key={idx} style={styles.linkItem} onPress={() => {
            if (isSelecting) {
              toggleSelect(item._id);
            } else {
              Linking.openURL(link).catch(err => console.log('Error opening URL:', err));
            }
          }}>
            <View style={styles.linkIcon}>
              <Ionicons name="link" size={20} color={ZaloColors.blue} />
            </View>
            <View style={styles.linkInfo}>
              <Text style={styles.linkText} numberOfLines={1}>{link}</Text>
              <Text style={styles.linkContext} numberOfLines={1}>{item.content}</Text>
            </View>
            {isSelecting && (
              <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
                {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderAudioItem = ({ item }: { item: any }) => {
    const isSelected = selectedIds.has(item._id);
    return (
      <TouchableOpacity style={styles.audioItem} onPress={() => isSelecting ? toggleSelect(item._id) : null}>
        <View style={styles.audioIcon}>
          <Ionicons name="mic" size={24} color="#FF6B6B" />
        </View>
        <View style={styles.audioInfo}>
          <Text style={styles.audioName}>Tin nhắn thoại</Text>
          <Text style={styles.audioMeta}>{format(parseISO(item.createdAt), 'HH:mm')}</Text>
        </View>
        {isSelecting && (
          <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
            {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSection = ({ section }: { section: any }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" backgroundColor={ZaloColors.blue} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kho lưu trữ</Text>
        <TouchableOpacity onPress={() => {
          setIsSelecting(!isSelecting);
          if (isSelecting) setSelectedIds(new Set());
        }}>
          <Text style={styles.headerAction}>{isSelecting ? 'Hủy' : 'Chọn'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {[
          { id: 'media', label: 'Ảnh' },
          { id: 'file', label: 'File' },
          { id: 'link', label: 'Link' },
          { id: 'audio', label: 'Thoại' }
        ].map(tab => (
          <TouchableOpacity 
            key={tab.id} 
            style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.id as TabType)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filters */}
      <View style={styles.filterBar}>
        <TouchableOpacity style={styles.filterBtn}>
          <Text style={styles.filterText}>Theo người gửi</Text>
          <Ionicons name="chevron-down" size={14} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterBtn}>
          <Text style={styles.filterText}>Theo thời gian</Text>
          <Ionicons name="chevron-down" size={14} color="#666" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ZaloColors.blue} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="folder-open-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Chưa có nội dung nào</Text>
        </View>
      ) : (
        <FlatList
          data={groupedMessages}
          keyExtractor={(item) => item.title}
          renderItem={({ item }) => (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{item.title}</Text>
              </View>
              {activeTab === 'media' ? (
                <View style={styles.mediaGrid}>
                  {item.data.map(msg => (
                    <View key={msg._id}>
                      {renderMediaItem({ item: msg })}
                    </View>
                  ))}
                </View>
              ) : (
                item.data.map(msg => (
                  <View key={msg._id}>
                    {activeTab === 'file' ? renderFileItem({ item: msg }) :
                     activeTab === 'link' ? renderLinkItem({ item: msg }) :
                     renderAudioItem({ item: msg })}
                  </View>
                ))
              )}
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Bottom Action Bar when selecting */}
      {isSelecting && selectedIds.size > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.bottomBtn}>
            <Ionicons name="share-outline" size={24} color={ZaloColors.blue} />
            <Text style={styles.bottomBtnText}>Chia sẻ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBtn}>
            <Ionicons name="download-outline" size={24} color={ZaloColors.blue} />
            <Text style={styles.bottomBtnText}>Lưu</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomBtn}>
            <Ionicons name="trash-outline" size={24} color="#FF4757" />
            <Text style={[styles.bottomBtnText, { color: '#FF4757' }]}>Xóa</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 56,
    backgroundColor: ZaloColors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerAction: {
    color: '#fff',
    fontSize: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabItem: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: ZaloColors.blue,
  },
  tabLabel: {
    fontSize: 14,
    color: '#666',
  },
  tabLabelActive: {
    color: ZaloColors.blue,
    fontWeight: '600',
  },
  filterBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#f8f9fa',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 4,
  },
  filterText: {
    fontSize: 13,
    color: '#666',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    marginTop: 12,
    color: '#999',
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mediaItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    padding: 1,
  },
  mediaImage: {
    flex: 1,
    backgroundColor: '#eee',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  fileIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  fileMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  linkContainer: {
    paddingHorizontal: 16,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  linkIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#f0f7ff',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkInfo: {
    flex: 1,
    marginLeft: 12,
  },
  linkText: {
    fontSize: 14,
    color: ZaloColors.blue,
  },
  linkContext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  audioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  audioIcon: {
    width: 44,
    height: 44,
    backgroundColor: '#fff0f0',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioInfo: {
    flex: 1,
    marginLeft: 12,
  },
  audioName: {
    fontSize: 15,
    color: '#333',
  },
  audioMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  selectCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleActive: {
    backgroundColor: ZaloColors.blue,
    borderColor: ZaloColors.blue,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#fff',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 10,
  },
  bottomBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBtnText: {
    fontSize: 11,
    color: ZaloColors.blue,
    marginTop: 4,
  }
});

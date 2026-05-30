import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Dimensions, Platform, Linking, TextInput, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, Video, ResizeMode } from 'expo-av';
import { ZaloColors } from '@/constants/zalo';
import { Message } from '@/types/chat';
import MessageTick from './MessageTick';
import AiMarkdown from './AiMarkdown';

interface MessageBubbleProps {
  item: Message;
  currentUserId: string | null;
  lastSeenMessageId: string | null;
  avatar?: string;
  name?: string;
  playingAudioId: string | null;
  audioProgress: Record<string, { position: number; duration: number }>;
  translatedMessages: Record<string, string>;
  translatingId: string | null;
  handleMessageLongPress: (msg: Message) => void;
  playAudio: (msgId: string, url: string) => void;
  setLightboxUrl: (url: string | null) => void;
  handleDownloadFile: (url: string, fileName?: string) => void;
  openLocationInMaps: (lat: number, lng: number) => void;
  handleSendContactRequest?: (phone: string) => void;
  onQuickReact: (msg: Message, type?: string) => void;
  onLongPressQuickReact?: (msg: Message) => void;
  showReactionTooltip?: boolean;
  closeReactionTooltip?: () => void;
  lastReactionType?: string;
  memberMap?: Record<string, { fullName: string; avatarUrl?: string }>;
  onVotePoll?: (msg: Message, optionId: number) => void;
  onAddPollOption?: (msg: Message, optionText: string) => void;
  isGroup?: boolean;
  participantRoles?: Record<string, string>;
  allMessages?: Message[];
  onJoinCall?: (conversationId: string, isVideo: boolean) => void;
  onPressMention?: (fullName: string, userId: string) => void;
  isHighlighted?: boolean;
  searchQuery?: string;
  latestSeenUsers?: { userId: string, avatarUrl?: string, fullName: string }[];
}

// Helper: render text with clickable links
const renderTextWithLinks = (
  text: string, 
  textStyle: any, 
  memberMap?: Record<string, { fullName: string; avatarUrl?: string }>,
  isGroup?: boolean,
  onPressMention?: (fullName: string, userId: string) => void,
  searchQuery?: string
) => {
  if (!text) return <Text style={textStyle}>{text}</Text>;

  let mentionRegex: RegExp | null = null;
  if (isGroup && memberMap) {
    const names = Object.values(memberMap).map(m => m.fullName).filter(Boolean);
    if (names.length > 0) {
      // Sort by length desc to match longer names first
      const escapedNames = names
        .sort((a, b) => b.length - a.length)
        .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      mentionRegex = new RegExp(`@(${escapedNames.join('|')})`, 'gi');
    }
  }

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  const urlTest = /^https?:\/\//;

  const renderHighlightedText = (str: string, keyPrefix: string) => {
    if (!searchQuery) return <Text key={keyPrefix}>{str}</Text>;
    // escape regex
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(`(${escapedQuery})`, 'gi');
    const searchParts = str.split(searchRegex);
    return searchParts.map((sp, idx) => {
      if (sp.toLowerCase() === searchQuery.toLowerCase()) {
        return <Text key={`${keyPrefix}-${idx}`} style={{ backgroundColor: 'yellow', color: '#000' }}>{sp}</Text>;
      }
      return <Text key={`${keyPrefix}-${idx}`}>{sp}</Text>;
    });
  };

  return (
    <Text style={textStyle}>
      {parts.map((part, i) => {
        if (urlTest.test(part)) {
          return (
            <Text
              key={`url-${i}`}
              style={{ color: '#1a73e8', textDecorationLine: 'underline' }}
              onPress={() => Linking.openURL(part)}
            >
              {part}
            </Text>
          );
        }

        // Apply mention matching to the non-url part
        if (mentionRegex) {
          const mentionParts = part.split(mentionRegex);
          if (mentionParts.length > 1) {
            return mentionParts.map((mPart, j) => {
              if (j % 2 === 1) {
                const memberEntry = Object.entries(memberMap || {}).find(([_, info]) => info.fullName === mPart);
                const userId = memberEntry ? memberEntry[0] : null;
                return (
                  <Text 
                    key={`mention-${i}-${j}`} 
                    style={{ color: '#0068FF', fontWeight: 'bold' }}
                    onPress={() => {
                      if (userId && onPressMention) {
                        onPressMention(mPart, userId);
                      }
                    }}
                  >
                    @{mPart}
                  </Text>
                );
              }
              return mPart ? renderHighlightedText(mPart, `text-${i}-${j}`) : null;
            });
          }
        }

        return part ? renderHighlightedText(part, `text-${i}`) : null;
      })}
    </Text>
  );
};

const VideoMessage = ({ item, handleMessageLongPress }: { item: Message; handleMessageLongPress: (msg: Message) => void }) => {
  const [isPlaying, setIsPlaying] = React.useState(false);

  return (
    <View style={styles.videoBubble}>
      <Video
        source={{ 
          uri: item.fileUrl!,
          overrideFileExtensionAndroid: 'mp4'
        }}
        useNativeControls={isPlaying}
        shouldPlay={isPlaying}
        isMuted={false}
        resizeMode={ResizeMode.CONTAIN}
        style={styles.msgVideo}
        onPlaybackStatusUpdate={(status: any) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
          }
          if (status.error) {
            console.log('Playback status error:', status.error);
          }
        }}
        onError={(e) => {
          console.log('Video error object:', e);
        }}
      />
      {!isPlaying && (
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.videoPlayOverlay}
          onPress={() => setIsPlaying(true)}
          onLongPress={() => handleMessageLongPress(item)}
        >
          <Ionicons name="play-circle" size={50} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function MessageBubble({
  item,
  currentUserId,
  lastSeenMessageId,
  avatar,
  name,
  playingAudioId,
  audioProgress,
  translatedMessages,
  translatingId,
  handleMessageLongPress,
  playAudio,
  setLightboxUrl,
  handleDownloadFile,
  openLocationInMaps,
  handleSendContactRequest,
  onQuickReact,
  onLongPressQuickReact,
  showReactionTooltip,
  closeReactionTooltip,
  lastReactionType = 'love',
  memberMap,
  onVotePoll,
  onAddPollOption,
  isGroup,
  participantRoles,
  allMessages,
  onJoinCall,
  onPressMention,
  isHighlighted,
  searchQuery,
  latestSeenUsers,
}: MessageBubbleProps) {
  const isMine = String(item.senderId) === String(currentUserId);
  const showSeenAvatar = isMine && item.status === 'seen' && String(item._id) === String(lastSeenMessageId);

  const isSticker = !item.isRevoked && item.messageType === 'sticker' && item.fileUrl;
  const isAudio = !item.isRevoked && item.messageType === 'audio' && item.fileUrl;
  const isVideo = !item.isRevoked && (
    item.messageType === 'video' ||
    (typeof item.fileUrl === 'string' && /\.(mp4|m4v|mov|avi|wmv|flv|mkv|webm)$/i.test(item.fileUrl))
  ) && item.fileUrl;
  const isFile = !item.isRevoked && item.messageType === 'file' && item.fileUrl;
  const isLocation = !item.isRevoked && item.messageType === 'location';
  const isReminder = !item.isRevoked && item.messageType === 'reminder';
  const isContact = !item.isRevoked && item.messageType === 'contact';
  const isPoll = !item.isRevoked && item.messageType === 'poll';
  const isGroupCall = !item.isRevoked && item.messageType === 'group_call';
  const isImage = !item.isRevoked && !isSticker && !isAudio && !isVideo && !isFile && !isLocation && !isReminder && !isContact && (
    item.messageType === 'image' ||
    item.imageUrl ||
    (typeof item.content === 'string' && item.content.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)/i.test(item.content))
  );

  const imgSrc = item.imageUrl || item.fileUrl || (typeof item.content === 'string' ? item.content : null);

  // Helper chống Crash khi content là Object
  const safeContent = typeof item.content === 'string' ? item.content : JSON.stringify(item.content || '');

  const formatAudioTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getFileExtension = (url?: string): string => {
    if (!url) return '';
    try {
      const parts = url.split('.');
      const ext = parts.pop()?.split('?')[0]?.toUpperCase() || '';
      return ext.length <= 5 ? ext : '';
    } catch { return ''; }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const parseLocation = (content?: string): { latitude: number; longitude: number; address: string } | null => {
    if (!content) return null;
    try {
      const data = JSON.parse(content);
      if (data.latitude && data.longitude) return data;
    } catch { /* not JSON */ }
    const match = content.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (match) return { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]), address: content };
    return null;
  };

  const parseReminder = (content?: string): { text: string; reminderTime: string } | null => {
    if (!content) return null;
    try {
      const data = JSON.parse(content);
      if (data.text && data.reminderTime) return data;
    } catch { /* not JSON */ }
    return null;
  };

  const parsePoll = (content?: any) => {
    if (!content) return null;
    try {
      return typeof content === 'string' ? JSON.parse(content) : content;
    } catch { return null; }
  };

  const formatReminderTime = (isoString: string): string => {
    const d = new Date(isoString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  if (item.messageType === 'system') {
    let text = safeContent;
    const isMeActor = String(item.senderId) === String(currentUserId);

    const getName = (uid: string) => {
      if (uid === String(currentUserId)) return 'Bạn';
      return (memberMap && memberMap[uid]?.fullName) ? memberMap[uid].fullName : 'Thành viên';
    };

    const actor = isMeActor ? 'Bạn' : getName(String(item.senderId));

    if (text === 'Nhóm đã được tạo') {
      text = `${actor} đã tạo một nhóm mới`; // Tránh truyền activeConversation.groupName vì mobile chưa pass props này
    } else if (text === 'Đã thêm thành viên mới vào nhóm') {
      text = `${actor} đã thêm thành viên mới vào nhóm`;
    } else if (text.startsWith('added_members:')) {
      const addedIds = text.split(':')[1].split(',');
      const validIds = addedIds.map(id => id.trim()).filter(id => id !== '');
      const addedNames = validIds.map(uid => getName(uid)).join(', ');
      text = `${actor} đã thêm ${addedNames} vào nhóm`;
    } else if (text.startsWith('member_left:')) {
      const leftId = text.split(':')[1];
      const leftName = getName(leftId);
      text = `${leftName} đã rời khỏi nhóm`;
    } else if (text.startsWith('member_removed:')) {
      const parts = text.split(':');
      const remover = getName(parts[1]);
      const removed = getName(parts[2]);
      text = `${remover} đã xóa ${removed} ra khỏi nhóm`;
    } else if (text.startsWith('group_disbanded:')) {
      text = `${actor} đã giải tán nhóm`;
    } else if (text.startsWith('role_deputy:')) {
      text = `${actor} đã đặt ${getName(text.split(':')[2])} làm phó nhóm`;
    } else if (text.startsWith('role_undeputy:')) {
      text = `${actor} đã gỡ phó nhóm của ${getName(text.split(':')[2])}`;
    } else if (text.startsWith('role_leader:')) {
      text = `${actor} đã đặt ${getName(text.split(':')[2])} làm trưởng nhóm`;
    } else if (text.startsWith('group_updated:')) {
      const updatesString = text.split(':')[2] || '';
      if (updatesString.includes('tên nhóm|')) {
        const newName = updatesString.split('tên nhóm|')[1].split(',')[0];
        text = `${actor} đã đổi tên đoạn chat thành "${newName}"`;
      } else if (updatesString.trim().toLowerCase() === 'cập nhật thông tin nhóm') {
        return null; // Ẩn thông báo này theo yêu cầu
      } else {
        text = `${actor} đã thay đổi ${updatesString}`;
      }
    } else if (text.startsWith('member_joined_via_link:')) {
      const joinedId = text.split(':')[1];
      const joinedName = getName(joinedId);
      text = `${joinedName} đã tham gia nhóm qua link mời`;
    }

    return (
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        <View style={{ backgroundColor: 'rgba(0,0,0,0.06)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#eee' }}>
          <Text style={{ fontSize: 12, fontWeight: '500', color: '#666', textAlign: 'center' }}>
            {text}
          </Text>
        </View>
      </View>
    );
  }

  const highlightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isHighlighted) {
      Animated.sequence([
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 1700,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [isHighlighted, highlightAnim]);

  const animatedStyle = {
    backgroundColor: highlightAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['transparent', 'rgba(255, 235, 59, 0.4)']
    }),
    borderRadius: 8,
  };

  return (
    <Animated.View style={animatedStyle}>
      <View style={[styles.msgWrapper, isMine ? styles.myMsgWrapper : styles.theirMsgWrapper]}>
        {/* Avatar đối phương bên trái */}
        {!isMine && (
          <View style={styles.avatarWrap}>
            {(() => {
              // SỬA Ở ĐÂY: Logic lấy Avatar chính xác
              let displayAvatarUrl = null;
              if (isGroup) {
                displayAvatarUrl = memberMap?.[String(item.senderId)]?.avatarUrl || null;
              } else {
                displayAvatarUrl = avatar;
              }

              // Kiểm tra url phải hợp lệ mới render Image
              if (displayAvatarUrl && typeof displayAvatarUrl === 'string' && displayAvatarUrl.trim() !== '') {
                return <Image source={{ uri: displayAvatarUrl }} style={styles.miniAvatar} />;
              }
              return (
                <View style={styles.defaultAvatar}>
                  <Ionicons name="person" size={14} color="#888" />
                </View>
              );
            })()}
          </View>
        )}

        <View style={{ flex: 1, alignItems: isMine ? 'flex-end' : 'flex-start' }}>
          {item.isRevoked ? (
            <View style={styles.revokedBubble}>
              <Ionicons name="ban-outline" size={14} color="#999" style={{ marginRight: 6 }} />
              <Text style={styles.revokedText}>Tin nhắn đã bị thu hồi</Text>
            </View>
          ) : (
            <>
              {/* Sender Name + Role Badge (Groups only) */}
              {!isMine && isGroup && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2, marginLeft: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#666' }}>
                    {memberMap && item.senderId && memberMap[String(item.senderId)] ? memberMap[String(item.senderId)].fullName : (name || 'Thành viên')}
                  </Text>
                  {(() => {
                    const senderRole = participantRoles ? participantRoles[String(item.senderId)] : 'member';
                    if (senderRole === 'leader') {
                      return (
                        <View style={{ backgroundColor: '#fff7ed', paddingHorizontal: 4, paddingVertical: 0.5, borderRadius: 4, marginLeft: 6, borderWidth: 0.5, borderColor: '#f59e0b' }}>
                          <Text style={{ fontSize: 8, color: '#f59e0b', fontWeight: '700' }}>TRƯỞNG NHÓM</Text>
                        </View>
                      );
                    }
                    if (senderRole === 'deputy') {
                      return (
                        <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 4, paddingVertical: 0.5, borderRadius: 4, marginLeft: 6, borderWidth: 0.5, borderColor: '#10b981' }}>
                          <Text style={{ fontSize: 8, color: '#10b981', fontWeight: '700' }}>PHÓ NHÓM</Text>
                        </View>
                      );
                    }
                    return null;
                  })()}
                </View>
              )}

              {/* ────── Reply Block ────── */}
              {item.replyTo && (
                <View style={styles.replyBubble}>
                  <View style={styles.replyBubbleLine} />
                  <View style={styles.replyBubbleTextWrap}>
                    <Text style={styles.replyBubbleHeader}>
                      {String(item.replyTo.senderId) === String(currentUserId) ? 'Bạn' : (memberMap && item.replyTo.senderId && memberMap[String(item.replyTo.senderId)] ? memberMap[String(item.replyTo.senderId)].fullName : (name || 'Người dùng'))}
                    </Text>
                    <Text style={styles.replyBubbleContent} numberOfLines={1}>
                      {item.replyTo.messageType === 'sticker' ? '[Nhãn dán]' :
                        item.replyTo.messageType === 'image' ? '[Hình ảnh]' :
                          (typeof item.replyTo.content === 'string' ? item.replyTo.content : 'Tin nhắn')}
                    </Text>
                  </View>
                </View>
              )}

              {isSticker ? (
                <TouchableOpacity activeOpacity={0.9} onLongPress={() => handleMessageLongPress(item)}>
                  <Image source={{ uri: item.fileUrl }} style={styles.stickerImage} resizeMode="contain" />
                </TouchableOpacity>
              ) : isAudio ? (
                <TouchableOpacity activeOpacity={0.8} onPress={() => playAudio(item._id, item.fileUrl!)} onLongPress={() => handleMessageLongPress(item)}>
                  <View style={[styles.audioBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                    <Ionicons name={playingAudioId === item._id ? 'pause' : 'play'} size={24} color="#333" />
                    <Text style={styles.audioTimeText}>
                      {formatAudioTime(audioProgress[item._id]?.position || 0)} / {formatAudioTime(audioProgress[item._id]?.duration || 0)}
                    </Text>
                    <View style={styles.audioProgressBarBg}>
                      <View style={[styles.audioProgressBarFill, { width: audioProgress[item._id] ? `${Math.min(100, (audioProgress[item._id].position / Math.max(1, audioProgress[item._id].duration)) * 100)}%` : '0%' }]} />
                    </View>
                    <Ionicons name="volume-medium" size={20} color="#333" />
                  </View>
                </TouchableOpacity>
              ) : isImage ? (
                <TouchableOpacity activeOpacity={0.9} onPress={() => imgSrc && setLightboxUrl(imgSrc)} onLongPress={() => handleMessageLongPress(item)}>
                  {imgSrc ? <Image source={{ uri: imgSrc }} style={styles.msgImage} resizeMode="cover" /> : <View style={[styles.msgImage, { backgroundColor: '#ddd' }]} />}
                </TouchableOpacity>
              ) : isVideo ? (
                <VideoMessage item={item} handleMessageLongPress={handleMessageLongPress} />
              ) : isFile ? (
                (() => {
                  const displayName = item.fileName || (typeof item.content === 'string' && item.content.startsWith('[Tệp]') ? item.content.replace('[Tệp] ', '').replace('[Tệp]', '') : null) || (item.fileUrl ? decodeURIComponent(item.fileUrl.split('/').pop()?.split('?')[0] || '') : null) || 'Tệp đính kèm';
                  const ext = getFileExtension(item.fileUrl);
                  const sizeText = item.fileSize ? formatFileSize(item.fileSize) : '';
                  const metaText = [ext, sizeText].filter(Boolean).join(' • ');
                  return (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => handleDownloadFile(item.fileUrl!, item.fileName)} onLongPress={() => handleMessageLongPress(item)}>
                      <View style={[styles.fileBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                        <View style={styles.fileIconWrap}><Ionicons name="document-text" size={24} color={ZaloColors.blue} /></View>
                        <View style={styles.fileInfoWrap}>
                          <Text style={styles.fileName} numberOfLines={2}>{displayName}</Text>
                          {metaText ? <Text style={styles.fileMeta}>{metaText}</Text> : null}
                        </View>
                        <Ionicons name="download-outline" size={22} color={ZaloColors.blue} />
                      </View>
                    </TouchableOpacity>
                  );
                })()
              ) : isLocation ? (
                (() => {
                  const locData = parseLocation(safeContent);
                  if (!locData) return null;
                  return (
                    <TouchableOpacity activeOpacity={0.8} onPress={() => openLocationInMaps(locData.latitude, locData.longitude)} onLongPress={() => handleMessageLongPress(item)}>
                      <View style={[styles.locationBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                        <View style={styles.locationMapPreview}><Ionicons name="map" size={40} color={ZaloColors.blue} /></View>
                        <View style={styles.locationInfoWrap}>
                          <View style={styles.locationHeader}><Ionicons name="location-sharp" size={16} color="#FF4757" /><Text style={styles.locationTitle}>Vị trí của tôi</Text></View>
                          <Text style={styles.locationAddress} numberOfLines={2}>{locData.address}</Text>
                          <Text style={styles.locationCoords}>{locData.latitude.toFixed(6)}, {locData.longitude.toFixed(6)}</Text>
                          <View style={styles.locationOpenBtn}><Ionicons name="navigate" size={14} color={ZaloColors.blue} /><Text style={styles.locationOpenText}>Mở bản đồ</Text></View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })()
              ) : isReminder ? (
                (() => {
                  const remData = parseReminder(safeContent);
                  if (!remData) return null;
                  const isPast = new Date(remData.reminderTime) < new Date();
                  return (
                    <TouchableOpacity activeOpacity={0.8} onLongPress={() => handleMessageLongPress(item)}>
                      <View style={[styles.reminderBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                        <View style={[styles.reminderIconWrap, isPast && { backgroundColor: 'rgba(153,153,153,0.15)' }]}><Ionicons name={isPast ? 'checkmark-circle' : 'alarm'} size={24} color={isPast ? '#999' : '#FF6348'} /></View>
                        <View style={styles.reminderInfoWrap}>
                          <View style={styles.reminderHeader}><Text style={styles.reminderLabel}>{isPast ? 'Đã nhắc hẹn' : '⏰ Nhắc hẹn'}</Text></View>
                          <Text style={styles.reminderText} numberOfLines={3}>{remData.text}</Text>
                          <View style={styles.reminderTimeRow}><Ionicons name="time-outline" size={13} color="#888" /><Text style={styles.reminderTimeText}>{formatReminderTime(remData.reminderTime)}</Text></View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })()
              ) : isContact ? (
                (() => {
                  let parsedContact: any = null;
                  try {
                    parsedContact = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
                  } catch { parsedContact = {}; }

                  const { fullName, nickname, avatarUrl, phone } = parsedContact || {};
                  const displayName = nickname || fullName || 'Người dùng';

                  return (
                    <TouchableOpacity activeOpacity={0.8} onLongPress={() => handleMessageLongPress(item)}>
                      <View style={[styles.contactBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                        <View style={styles.contactInfoRow}>
                          {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} style={styles.contactCardAvatar} />
                          ) : (
                            <View style={styles.contactCardAvatarDefault}><Text style={styles.contactCardAvatarText}>{displayName.charAt(0).toUpperCase()}</Text></View>
                          )}
                          <View style={styles.contactCardTextWrap}>
                            <Text style={styles.contactCardName} numberOfLines={1}>{displayName}</Text>
                            <Text style={styles.contactCardPhone} numberOfLines={1}>{phone || 'Không có SĐT'}</Text>
                          </View>
                        </View>
                        <View style={styles.contactCardActions}>
                          <TouchableOpacity style={styles.contactCardBtn} onPress={() => { if (phone && handleSendContactRequest) handleSendContactRequest(phone); }}>
                            <Ionicons name="person-add-outline" size={14} color="#0068FF" /><Text style={styles.contactCardBtnText}>Kết bạn</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.contactCardBtn} onPress={() => { if (phone) Linking.openURL(`tel:${phone}`).catch(() => { }); }}>
                            <Ionicons name="call-outline" size={14} color="#0068FF" /><Text style={styles.contactCardBtnText}>Gọi điện</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })()
              ) : isPoll ? (
                (() => {
                  const pollData = parsePoll(item.content);
                  if (!pollData) return null;
                  const totalVotes = pollData.options.reduce((sum: number, opt: any) => sum + (opt.votes?.length || 0), 0);
                  const [isAdding, setIsAdding] = React.useState(false);
                  const [newText, setNewText] = React.useState('');

                  const onSubmitOption = () => {
                    if (newText.trim() && onAddPollOption) {
                      onAddPollOption(item, newText.trim());
                      setNewText('');
                      setIsAdding(false);
                    }
                  };

                  return (
                    <TouchableOpacity activeOpacity={0.9} onLongPress={() => handleMessageLongPress(item)}>
                      <View style={[styles.pollBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                        <View style={styles.pollHeader}><Ionicons name="bar-chart" size={18} color={ZaloColors.blue} /><Text style={styles.pollHeaderTitle}>Bình chọn</Text></View>
                        <Text style={styles.pollQuestion}>{pollData.question}</Text>
                        <View style={styles.pollOptionsWrap}>
                          {pollData.options.map((option: any) => {
                            const votesCount = option.votes?.length || 0;
                            const percentage = totalVotes > 0 ? (votesCount / totalVotes) * 100 : 0;
                            const hasVoted = option.votes?.includes(currentUserId);
                            return (
                              <TouchableOpacity key={option.id} activeOpacity={0.7} onPress={() => onVotePoll && onVotePoll(item, option.id)} style={[styles.pollOptionBtn, hasVoted && styles.pollOptionBtnVoted]}>
                                <View style={[styles.pollProgressBg, { width: `${percentage}%` }]} />
                                <View style={styles.pollOptionContent}>
                                  <Text style={[styles.pollOptionText, hasVoted && styles.pollOptionTextVoted]}>{option.text}</Text>
                                  {votesCount > 0 && <Text style={styles.pollOptionCount}>{votesCount}</Text>}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {isAdding ? (
                          <View style={{ marginTop: 12, gap: 8 }}>
                            <TextInput
                              value={newText}
                              onChangeText={setNewText}
                              placeholder="Nhập phương án mới..."
                              style={{ borderBottomWidth: 1, borderBottomColor: ZaloColors.blue, paddingVertical: 4, fontSize: 14 }}
                              autoFocus
                            />
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                              <TouchableOpacity onPress={onSubmitOption} disabled={!newText.trim()} style={{ flex: 1, backgroundColor: ZaloColors.blue, paddingVertical: 8, borderRadius: 8, alignItems: 'center', opacity: newText.trim() ? 1 : 0.5 }}>
                                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Thêm</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => setIsAdding(false)} style={{ flex: 1, backgroundColor: '#f0f0f0', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}>
                                <Text style={{ color: '#666', fontWeight: 'bold', fontSize: 13 }}>Hủy</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <TouchableOpacity onPress={() => setIsAdding(true)} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: ZaloColors.blue, borderRadius: 10 }}>
                            <Ionicons name="add" size={18} color={ZaloColors.blue} />
                            <Text style={{ color: ZaloColors.blue, fontWeight: '600', marginLeft: 4, fontSize: 13 }}>Thêm phương án</Text>
                          </TouchableOpacity>
                        )}

                        <View style={styles.pollFooter}><Text style={styles.pollFooterText}>{totalVotes} lượt bình chọn</Text></View>
                      </View>
                    </TouchableOpacity>
                  );
                })()
              ) : isGroupCall ? (
                (() => {
                  const msgTime = new Date(item.createdAt || item.timestamp || 0).getTime();
                  const isCallEnded = (allMessages || []).some(
                    m => m.messageType === 'system' &&
                    (m.content === 'Cuộc gọi nhóm đã kết thúc' || m.content === '📞 Cuộc gọi nhóm đã kết thúc') &&
                    new Date(m.createdAt || m.timestamp || 0).getTime() > msgTime
                  );
                  const isVideoCall = safeContent === 'video';

                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onLongPress={() => handleMessageLongPress(item)}
                      onPress={() => {
                        if (isCallEnded) {
                          Alert.alert('Thông báo', 'Cuộc gọi này đã kết thúc');
                          return;
                        }
                        if (onJoinCall) {
                          onJoinCall(item.conversationId || '', isVideoCall);
                        }
                      }}
                    >
                      <View style={[styles.groupCallBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                        <View style={styles.groupCallHeader}>
                          <View style={styles.groupCallIconWrap}>
                            <Ionicons name={isVideoCall ? 'videocam' : 'call'} size={20} color="#0068FF" />
                          </View>
                          <Text style={styles.groupCallTitle}>Cuộc gọi nhóm</Text>
                        </View>
                        <View style={[styles.groupCallBtn, isCallEnded && styles.groupCallBtnEnded]}>
                          <Text style={[styles.groupCallBtnText, isCallEnded && styles.groupCallBtnTextEnded]}>
                            {isCallEnded ? 'Đã kết thúc' : 'Tham gia'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })()
              ) : (() => {
                const isAiBot = String(item.senderId) === 'ai_food_bot';
                return (
                  <TouchableOpacity activeOpacity={0.8} onLongPress={() => handleMessageLongPress(item)}>
                    <View style={[
                      styles.msgBubble,
                      isMine ? styles.myMsgBubble : (isAiBot ? {
                        backgroundColor: '#FFF7ED',
                        borderTopLeftRadius: 4,
                        borderWidth: 1,
                        borderColor: 'rgba(249,115,22,0.15)',
                      } : styles.theirMsgBubble)
                    ]}>
                      {isAiBot && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#f97316' }}>Bếp AI 🍜</Text>
                        </View>
                      )}
                      {isAiBot ? (
                        <AiMarkdown content={safeContent} />
                      ) : (
                        renderTextWithLinks(safeContent, [styles.msgContent, isMine ? styles.myMsgContent : styles.theirMsgContent], memberMap, isGroup, onPressMention, searchQuery)
                      )}
                      {translatedMessages[item._id] && (
                        <View style={styles.translatedWrap}>
                          <Text style={[styles.translatedText, isMine ? styles.myMsgContent : styles.theirMsgContent]}>
                            {translatedMessages[item._id]}
                          </Text>
                        </View>
                      )}
                      {translatingId === item._id && (
                        <View style={styles.translatingWrap}><ActivityIndicator size="small" color="#999" /><Text style={styles.translatingText}>Đang dịch...</Text></View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })()}
            </>
          )}

          {!item.isRevoked && (
            <View style={[styles.reactionsRow, isMine ? styles.myReactionsRow : styles.theirReactionsRow]}>
              {item.reactions && item.reactions.length > 0 && (
                <TouchableOpacity activeOpacity={0.8} onPress={() => onQuickReact(item)} style={styles.reactionsWrapper}>
                  {Array.from(new Set([...item.reactions].reverse().map(r => r.type))).slice(0, 3).reverse().map(type => {
                    const REACTION_EMOJIS = { love: '❤️', like: '👍', haha: '😆', wow: '😯', sad: '😢', angry: '😡' };
                    return <Text key={type} style={styles.reactionMiniIcon}>{REACTION_EMOJIS[type as keyof typeof REACTION_EMOJIS]}</Text>;
                  })}
                  {item.reactions && item.reactions.length > 1 && (
                    <Text style={styles.reactionCount}>{item.reactions.length}</Text>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.quickReactBtn} onPress={() => { if (!item.reactions || item.reactions.length === 0) { onQuickReact(item, 'love'); } else { onQuickReact(item); } }} onLongPress={() => onLongPressQuickReact && onLongPressQuickReact(item)}>
                {item.reactions && item.reactions.length > 0 ? (
                  <Text style={styles.quickReactEmoji}>{{ love: '❤️', like: '👍', haha: '😆', wow: '😯', sad: '😢', angry: '😡' }[lastReactionType as 'love' | 'like' | 'haha' | 'wow' | 'sad' | 'angry'] || '❤️'}</Text>
                ) : (
                  <Ionicons name="heart-outline" size={14} color="#555" />
                )}
              </TouchableOpacity>

              {showReactionTooltip && (
                <View style={[styles.reactionTooltip, isMine ? styles.myReactionTooltip : styles.theirReactionTooltip]}>
                  {[{ type: 'love', icon: '❤️' }, { type: 'like', icon: '👍' }, { type: 'haha', icon: '😆' }, { type: 'wow', icon: '😯' }, { type: 'sad', icon: '😢' }, { type: 'angry', icon: '😡' }].map(emoji => (
                    <TouchableOpacity key={emoji.type} style={styles.tooltipEmojiBtn} onPress={() => onQuickReact(item, emoji.type)}>
                      <Text style={styles.tooltipEmojiText}>{emoji.icon}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {isMine && !item.isRevoked && (
            <View style={[styles.statusRow, { marginTop: 4, alignItems: 'flex-end' }]}>
               {!isGroup ? (
                 <Text style={{ fontSize: 11, color: '#888' }}>
                   {item.status === 'seen' ? 'Đã xem' : item.status === 'received' ? 'Đã nhận' : item.status === 'sent' ? 'Đã gửi' : 'Đang gửi...'}
                 </Text>
               ) : (
                 <MessageTick status={item.status} />
               )}
            </View>
          )}
        </View>
      </View>

      {/* Avatar nhỏ hiện bên dưới tin đã được đối phương XEM */}
      {latestSeenUsers && latestSeenUsers.length > 0 && !item.isRevoked && (
        <View style={{ flexDirection: 'row', justifyContent: isMine ? 'flex-end' : 'flex-start', marginTop: 2, paddingHorizontal: 4, gap: 2 }}>
          {latestSeenUsers.map((user, idx) => (
            <View key={`seen-${user.userId}-${idx}`} style={{ width: 14, height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }}>
              {user.avatarUrl && typeof user.avatarUrl === 'string' && user.avatarUrl.trim() !== '' ? (
                <Image source={{ uri: user.avatarUrl }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Ionicons name="person" size={10} color="#888" />
              )}
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  msgWrapper: { marginBottom: 4, flexDirection: 'row', alignItems: 'flex-end' },
  myMsgWrapper: { justifyContent: 'flex-end' },
  theirMsgWrapper: { justifyContent: 'flex-start' },

  avatarWrap: { marginRight: 8 },
  miniAvatar: { width: 30, height: 30, borderRadius: 15 },
  defaultAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' },

  msgBubble: { maxWidth: SCREEN_WIDTH * 0.75, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  myMsgBubble: { backgroundColor: '#cce5ff', borderTopRightRadius: 4 },
  theirMsgBubble: { backgroundColor: '#fff', borderTopLeftRadius: 4 },
  msgContent: { fontSize: 15, lineHeight: 22 },
  myMsgContent: { color: '#000' },
  theirMsgContent: { color: '#000' },

  stickerImage: { width: 120, height: 120 },
  msgImage: { width: 220, height: 220, borderRadius: 12 },

  videoBubble: { width: 240, height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', position: 'relative' },
  msgVideo: { width: 240, height: 160 },
  videoPlayOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },

  audioBubble: { flexDirection: 'row', alignItems: 'center', maxWidth: SCREEN_WIDTH * 0.75, minWidth: SCREEN_WIDTH * 0.55, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, gap: 8 },
  audioTimeText: { fontSize: 13, color: '#333', fontVariant: ['tabular-nums'], minWidth: 70 },
  audioProgressBarBg: { flex: 1, height: 4, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 2, overflow: 'hidden' },
  audioProgressBarFill: { height: '100%', backgroundColor: '#333', borderRadius: 2 },

  replyBubble: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 6, marginBottom: 4, maxWidth: SCREEN_WIDTH * 0.75 },
  replyBubbleLine: { width: 3, backgroundColor: ZaloColors.blue, borderRadius: 2, marginRight: 6 },
  replyBubbleTextWrap: { flex: 1 },
  replyBubbleHeader: { fontSize: 12, fontWeight: '600', color: '#000', marginBottom: 2 },
  replyBubbleContent: { fontSize: 13, color: '#555' },

  fileBubble: { flexDirection: 'row', alignItems: 'center', maxWidth: SCREEN_WIDTH * 0.75, padding: 12, borderRadius: 12 },
  fileIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,104,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  fileInfoWrap: { flex: 1, marginRight: 10 },
  fileName: { fontSize: 14, fontWeight: '500', color: '#000', marginBottom: 2 },
  fileMeta: { fontSize: 12, color: '#888' },

  locationBubble: { width: 240, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
  locationMapPreview: { height: 120, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  locationInfoWrap: { padding: 12 },
  locationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  locationTitle: { fontSize: 14, fontWeight: '600', color: '#000', marginLeft: 4 },
  locationAddress: { fontSize: 13, color: '#666', marginBottom: 8, lineHeight: 18 },
  locationCoords: { fontSize: 11, color: '#999', marginBottom: 12 },
  locationOpenBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e6f0ff', paddingVertical: 8, borderRadius: 6 },
  locationOpenText: { fontSize: 13, fontWeight: '600', color: ZaloColors.blue, marginLeft: 6 },

  contactBubble: { width: 250, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', overflow: 'hidden' },
  contactInfoRow: { flexDirection: 'row', padding: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  contactCardAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
  contactCardAvatarDefault: { width: 44, height: 44, borderRadius: 22, marginRight: 10, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' },
  contactCardAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#666' },
  contactCardTextWrap: { flex: 1 },
  contactCardName: { fontSize: 15, fontWeight: '600', color: '#000', marginBottom: 2 },
  contactCardPhone: { fontSize: 13, color: '#666' },
  contactCardActions: { flexDirection: 'row', backgroundColor: '#fafafa' },
  contactCardBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRightWidth: 1, borderRightColor: '#eee' },
  contactCardBtnText: { fontSize: 13, fontWeight: '500', color: '#0068FF', marginLeft: 4 },

  reminderBubble: { width: 250, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#eee', flexDirection: 'row' },
  reminderIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,99,72,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  reminderInfoWrap: { flex: 1 },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  reminderLabel: { fontSize: 14, fontWeight: '600', color: '#000' },
  reminderText: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 8 },
  reminderTimeRow: { flexDirection: 'row', alignItems: 'center' },
  reminderTimeText: { fontSize: 12, color: '#888', marginLeft: 4 },

  statusRow: { alignSelf: 'flex-end', marginTop: 2 },
  seenAvatarRow: { alignItems: 'flex-end', marginTop: 2, marginRight: 16 },
  seenAvatar: { width: 14, height: 14, borderRadius: 7 },
  seenAvatarDefault: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' },

  revokedBubble: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#f5f5f5', borderRadius: 16, borderWidth: 1, borderColor: '#e0e0e0' },
  revokedText: { fontSize: 14, color: '#999', fontStyle: 'italic' },

  pollBubble: { width: 280, borderRadius: 16, padding: 12 },
  pollHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  pollHeaderTitle: { fontSize: 14, fontWeight: '700', color: ZaloColors.blue },
  pollQuestion: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 16, lineHeight: 22 },
  pollOptionsWrap: { gap: 10 },
  pollOptionBtn: { borderRadius: 12, borderWidth: 1, borderColor: '#eee', backgroundColor: '#fff', overflow: 'hidden', position: 'relative', height: 44, justifyContent: 'center' },
  pollOptionBtnVoted: { borderColor: ZaloColors.blue, backgroundColor: '#f0f7ff' },
  pollProgressBg: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0, 104, 255, 0.1)' },
  pollOptionContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, zIndex: 1 },
  pollOptionText: { fontSize: 14, color: '#333', fontWeight: '500' },
  pollOptionTextVoted: { color: ZaloColors.blue, fontWeight: '700' },
  pollOptionCount: { fontSize: 12, fontWeight: '700', color: '#666' },
  pollFooter: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  pollFooterText: { fontSize: 12, color: '#888' },

  groupCallBubble: { minWidth: 200, maxWidth: SCREEN_WIDTH * 0.65, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, gap: 10 },
  groupCallHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupCallIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5F0FF', justifyContent: 'center', alignItems: 'center' },
  groupCallTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  groupCallBtn: { backgroundColor: '#0068FF', paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  groupCallBtnEnded: { backgroundColor: '#e5e7eb' },
  groupCallBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  groupCallBtnTextEnded: { color: '#6b7280' },

  translatedWrap: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)', borderStyle: 'dashed' },
  translatedText: { fontSize: 14, fontStyle: 'italic', lineHeight: 20, opacity: 0.9 },
  translatingWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  translatingText: { fontSize: 12, color: '#999', marginLeft: 6, fontStyle: 'italic' },

  reactionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: -10, marginBottom: 4, zIndex: 10 },
  myReactionsRow: { alignSelf: 'flex-end', marginRight: 10 },
  theirReactionsRow: { alignSelf: 'flex-start', marginLeft: 10 },
  reactionsWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2, borderWidth: 1, borderColor: '#eee', marginRight: 4 },
  reactionMiniIcon: { fontSize: 14, marginHorizontal: 1 },
  reactionCount: { fontSize: 12, fontWeight: '600', color: '#666', marginLeft: 4 },
  quickReactBtn: { backgroundColor: '#fff', borderRadius: 15, padding: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2, borderWidth: 1, borderColor: '#eee', alignItems: 'center', justifyContent: 'center', width: 26, height: 26 },
  quickReactEmoji: { fontSize: 14 },
  reactionTooltip: { position: 'absolute', bottom: 30, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, zIndex: 100 },
  myReactionTooltip: { right: 0 },
  theirReactionTooltip: { left: 0 },
  tooltipEmojiBtn: { paddingHorizontal: 6 },
  tooltipEmojiText: { fontSize: 24 },
});
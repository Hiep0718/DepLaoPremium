import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Dimensions, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, Video, ResizeMode } from 'expo-av';
import { ZaloColors } from '@/constants/zalo';
import { Message } from '@/types/chat';
import MessageTick from './MessageTick';

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
  handleSendContactRequest?: (phone: string) => void; // Optional if needed inside
}

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
}: MessageBubbleProps) {
  const isMine = String(item.senderId) === String(currentUserId);
  const showSeenAvatar = isMine && item.status === 'seen' && String(item._id) === String(lastSeenMessageId);
  
  const isSticker = !item.isRevoked && item.messageType === 'sticker' && item.fileUrl;
  const isAudio = !item.isRevoked && item.messageType === 'audio' && item.fileUrl;
  const isVideo = !item.isRevoked && item.messageType === 'video' && item.fileUrl;
  const isFile = !item.isRevoked && item.messageType === 'file' && item.fileUrl;
  const isLocation = !item.isRevoked && item.messageType === 'location';
  const isReminder = !item.isRevoked && item.messageType === 'reminder';
  const isContact = !item.isRevoked && item.messageType === 'contact';
  const isImage = !item.isRevoked && !isSticker && !isAudio && !isVideo && !isFile && !isLocation && !isReminder && !isContact && (
    item.messageType === 'image' ||
    item.imageUrl ||
    (item.content && item.content.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)/i.test(item.content))
  );
  
  const imgSrc = item.imageUrl || item.fileUrl || item.content;

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

  const formatReminderTime = (isoString: string): string => {
    const d = new Date(isoString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  return (
    <View>
      <View style={[styles.msgWrapper, isMine ? styles.myMsgWrapper : styles.theirMsgWrapper]}>
        {/* Avatar đối phương bên trái */}
        {!isMine && (
          <View style={styles.avatarWrap}>
            {avatar ? (
              <Image source={{ uri: avatar as string }} style={styles.miniAvatar} />
            ) : (
              <View style={styles.defaultAvatar}>
                <Ionicons name="person" size={14} color="#888" />
              </View>
            )}
          </View>
        )}

        <View style={{ flex: 1, alignItems: isMine ? 'flex-end' : 'flex-start' }}>
          {item.isRevoked ? (
            /* ────── Tin nhắn đã bị thu hồi ────── */
            <View style={styles.revokedBubble}>
              <Ionicons name="ban-outline" size={14} color="#999" style={{ marginRight: 6 }} />
              <Text style={styles.revokedText}>Tin nhắn đã bị thu hồi</Text>
            </View>
          ) : (
            <>
              {/* ────── Reply Block ────── */}
              {item.replyTo && (
                <View style={styles.replyBubble}>
                  <View style={styles.replyBubbleLine} />
                  <View style={styles.replyBubbleTextWrap}>
                    <Text style={styles.replyBubbleHeader}>
                      {String(item.replyTo.senderId) === String(currentUserId) ? 'Bạn' : name}
                    </Text>
                    <Text style={styles.replyBubbleContent} numberOfLines={1}>
                      {item.replyTo.messageType === 'sticker' ? '[Nhãn dán]' :
                       item.replyTo.messageType === 'image' ? '[Hình ảnh]' :
                       item.replyTo.content}
                    </Text>
                  </View>
                </View>
              )}

              {isSticker ? (
                /* ────── Sticker message ────── */
                <TouchableOpacity
                  activeOpacity={0.9}
                  onLongPress={() => handleMessageLongPress(item)}
                >
                  <Image
                    source={{ uri: item.fileUrl }}
                    style={styles.stickerImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ) : isAudio ? (
                /* ────── Audio/Voice Message ────── */
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => playAudio(item._id, item.fileUrl!)}
                  onLongPress={() => handleMessageLongPress(item)}
                >
                  <View style={[styles.audioBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                    <Ionicons
                      name={playingAudioId === item._id ? 'pause' : 'play'}
                      size={24}
                      color="#333"
                    />
                    <Text style={styles.audioTimeText}>
                      {formatAudioTime(audioProgress[item._id]?.position || 0)}
                      {' / '}
                      {formatAudioTime(audioProgress[item._id]?.duration || 0)}
                    </Text>
                    <View style={styles.audioProgressBarBg}>
                      <View
                        style={[
                          styles.audioProgressBarFill,
                          {
                            width: audioProgress[item._id]
                              ? `${Math.min(100, (audioProgress[item._id].position / Math.max(1, audioProgress[item._id].duration)) * 100)}%`
                              : '0%',
                          },
                        ]}
                      />
                    </View>
                    <Ionicons name="volume-medium" size={20} color="#333" />
                  </View>
                </TouchableOpacity>
              ) : isImage ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setLightboxUrl(imgSrc)}
                  onLongPress={() => handleMessageLongPress(item)}
                >
                  <Image source={{ uri: imgSrc }} style={styles.msgImage} resizeMode="cover" />
                </TouchableOpacity>
              ) : isVideo ? (
                /* ────── Video Message ────── */
                <View style={styles.videoBubble}>
                  <Video
                    source={{ uri: item.fileUrl! }}
                    useNativeControls
                    shouldPlay={false}
                    isMuted={false}
                    resizeMode={ResizeMode.CONTAIN}
                    style={styles.msgVideo}
                    onError={(e) => console.log('Video error:', e)}
                  />
                </View>
              ) : isFile ? (
                /* ────── File/Document Message ────── */
                (() => {
                  const displayName = item.fileName
                    || (item.content?.startsWith('[Tệp]') ? item.content.replace('[Tệp] ', '').replace('[Tệp]', '') : null)
                    || (item.fileUrl ? decodeURIComponent(item.fileUrl.split('/').pop()?.split('?')[0] || '') : null)
                    || 'Tệp đính kèm';
                  const ext = getFileExtension(item.fileUrl);
                  const sizeText = item.fileSize ? formatFileSize(item.fileSize) : '';
                  const metaText = [ext, sizeText].filter(Boolean).join(' • ');
                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleDownloadFile(item.fileUrl!, item.fileName)}
                      onLongPress={() => handleMessageLongPress(item)}
                    >
                      <View style={[styles.fileBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                        <View style={styles.fileIconWrap}>
                          <Ionicons name="document-text" size={24} color={ZaloColors.blue} />
                        </View>
                        <View style={styles.fileInfoWrap}>
                          <Text style={styles.fileName} numberOfLines={2}>
                            {displayName}
                          </Text>
                          {metaText ? (
                            <Text style={styles.fileMeta}>{metaText}</Text>
                          ) : null}
                        </View>
                        <Ionicons name="download-outline" size={22} color={ZaloColors.blue} />
                      </View>
                    </TouchableOpacity>
                  );
                })()
              ) : isLocation ? (
                /* ────── Location Message ────── */
                (() => {
                  const locData = parseLocation(item.content);
                  if (!locData) return null;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => openLocationInMaps(locData.latitude, locData.longitude)}
                      onLongPress={() => handleMessageLongPress(item)}
                    >
                      <View style={[styles.locationBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                        <View style={styles.locationMapPreview}>
                          <Ionicons name="map" size={40} color={ZaloColors.blue} />
                        </View>
                        <View style={styles.locationInfoWrap}>
                          <View style={styles.locationHeader}>
                            <Ionicons name="location-sharp" size={16} color="#FF4757" />
                            <Text style={styles.locationTitle}>Vị trí của tôi</Text>
                          </View>
                          <Text style={styles.locationAddress} numberOfLines={2}>
                            {locData.address}
                          </Text>
                          <Text style={styles.locationCoords}>
                            {locData.latitude.toFixed(6)}, {locData.longitude.toFixed(6)}
                          </Text>
                          <View style={styles.locationOpenBtn}>
                            <Ionicons name="navigate" size={14} color={ZaloColors.blue} />
                            <Text style={styles.locationOpenText}>Mở bản đồ</Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })()
              ) : isReminder ? (
                /* ────── Reminder Message ────── */
                (() => {
                  const remData = parseReminder(item.content);
                  if (!remData) return null;
                  const isPast = new Date(remData.reminderTime) < new Date();
                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onLongPress={() => handleMessageLongPress(item)}
                    >
                      <View style={[styles.reminderBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                        <View style={[styles.reminderIconWrap, isPast && { backgroundColor: 'rgba(153,153,153,0.15)' }]}>
                          <Ionicons name={isPast ? 'checkmark-circle' : 'alarm'} size={24} color={isPast ? '#999' : '#FF6348'} />
                        </View>
                        <View style={styles.reminderInfoWrap}>
                          <View style={styles.reminderHeader}>
                            <Text style={styles.reminderLabel}>{isPast ? 'Đã nhắc hẹn' : '⏰ Nhắc hẹn'}</Text>
                          </View>
                          <Text style={styles.reminderText} numberOfLines={3}>
                            {remData.text}
                          </Text>
                          <View style={styles.reminderTimeRow}>
                            <Ionicons name="time-outline" size={13} color="#888" />
                            <Text style={styles.reminderTimeText}>
                              {formatReminderTime(remData.reminderTime)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })()
              ) : isContact ? (
                /* ────── Contact Card Message ────── */
                (() => {
                  let parsedContact: any = null;
                  try {
                    parsedContact = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
                  } catch { parsedContact = {}; }

                  const { fullName, nickname, avatarUrl, phone } = parsedContact || {};
                  const displayName = nickname || fullName || 'Người dùng';
                  const contactAvatar = avatarUrl;

                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onLongPress={() => handleMessageLongPress(item)}
                    >
                      <View style={[styles.contactBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                        <View style={styles.contactInfoRow}>
                          {contactAvatar ? (
                            <Image source={{ uri: contactAvatar }} style={styles.contactCardAvatar} />
                          ) : (
                            <View style={styles.contactCardAvatarDefault}>
                              <Text style={styles.contactCardAvatarText}>
                                {displayName.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={styles.contactCardTextWrap}>
                            <Text style={styles.contactCardName} numberOfLines={1}>{displayName}</Text>
                            <Text style={styles.contactCardPhone} numberOfLines={1}>
                              {phone || 'Không có SĐT'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.contactCardActions}>
                          <TouchableOpacity
                            style={styles.contactCardBtn}
                            onPress={() => {
                              if (phone && handleSendContactRequest) {
                                handleSendContactRequest(phone);
                              }
                            }}
                          >
                            <Ionicons name="person-add-outline" size={14} color="#0068FF" />
                            <Text style={styles.contactCardBtnText}>Kết bạn</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.contactCardBtn}
                            onPress={() => {
                              if (phone) {
                                Linking.openURL(`tel:${phone}`).catch(() => {});
                              }
                            }}
                          >
                            <Ionicons name="call-outline" size={14} color="#0068FF" />
                            <Text style={styles.contactCardBtnText}>Gọi điện</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })()
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onLongPress={() => handleMessageLongPress(item)}
                >
                  <View style={[styles.msgBubble, isMine ? styles.myMsgBubble : styles.theirMsgBubble]}>
                    <Text style={[styles.msgContent, isMine ? styles.myMsgContent : styles.theirMsgContent]}>
                      {item.content}
                    </Text>
                    {translatedMessages[item._id] && (
                      <View style={styles.translatedWrap}>
                        <Text style={[styles.translatedText, isMine ? styles.myMsgContent : styles.theirMsgContent]}>
                          {translatedMessages[item._id]}
                        </Text>
                      </View>
                    )}
                    {translatingId === item._id && (
                      <View style={styles.translatingWrap}>
                        <ActivityIndicator size="small" color="#999" />
                        <Text style={styles.translatingText}>Đang dịch...</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}
          {isMine && !item.isRevoked && (
            <View style={styles.statusRow}>
              <MessageTick status={item.status} />
            </View>
          )}
        </View>
      </View>

      {/* Avatar nhỏ hiện bên phải dưới tin đã được đối phương XEM */}
      {showSeenAvatar && !item.isRevoked && (
        <View style={styles.seenAvatarRow}>
          {avatar ? (
            <Image source={{ uri: avatar as string }} style={styles.seenAvatar} />
          ) : (
            <View style={styles.seenAvatarDefault}>
              <Ionicons name="person" size={9} color="#888" />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  msgWrapper: { marginBottom: 4, flexDirection: 'row', alignItems: 'flex-end' },
  myMsgWrapper: { justifyContent: 'flex-end' },
  theirMsgWrapper: { justifyContent: 'flex-start' },

  avatarWrap: { marginRight: 8 },
  miniAvatar: { width: 30, height: 30, borderRadius: 15 },
  defaultAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center',
  },

  msgBubble: {
    maxWidth: SCREEN_WIDTH * 0.75, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16,
  },
  myMsgBubble: { backgroundColor: '#cce5ff', borderTopRightRadius: 4 },
  theirMsgBubble: { backgroundColor: '#fff', borderTopLeftRadius: 4 },
  msgContent: { fontSize: 15, lineHeight: 22 },
  myMsgContent: { color: '#000' },
  theirMsgContent: { color: '#000' },

  stickerImage: { width: 120, height: 120 },
  msgImage: { width: 220, height: 220, borderRadius: 12 },
  
  videoBubble: { width: 220, height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  msgVideo: { flex: 1 },

  // Audio/Voice Message Bubble
  audioBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: SCREEN_WIDTH * 0.75,
    minWidth: SCREEN_WIDTH * 0.55,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 8,
  },
  audioTimeText: {
    fontSize: 13,
    color: '#333',
    fontVariant: ['tabular-nums'],
    minWidth: 70,
  },
  audioProgressBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  audioProgressBarFill: {
    height: '100%',
    backgroundColor: '#333',
    borderRadius: 2,
  },

  // Reply Text Bubble
  replyBubble: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    padding: 6,
    marginBottom: 4,
    maxWidth: SCREEN_WIDTH * 0.75,
  },
  replyBubbleLine: {
    width: 3,
    backgroundColor: ZaloColors.blue,
    borderRadius: 2,
    marginRight: 6,
  },
  replyBubbleTextWrap: {
    flex: 1,
  },
  replyBubbleHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  replyBubbleContent: {
    fontSize: 13,
    color: '#555',
  },

  // File Bubble
  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: SCREEN_WIDTH * 0.75,
    padding: 12,
    borderRadius: 12,
  },
  fileIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,104,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  fileInfoWrap: { flex: 1, marginRight: 10 },
  fileName: { fontSize: 14, fontWeight: '500', color: '#000', marginBottom: 2 },
  fileMeta: { fontSize: 12, color: '#888' },

  // Location Bubble
  locationBubble: {
    width: 240, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#eee',
  },
  locationMapPreview: {
    height: 120, backgroundColor: '#f0f0f0',
    justifyContent: 'center', alignItems: 'center',
  },
  locationInfoWrap: { padding: 12 },
  locationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  locationTitle: { fontSize: 14, fontWeight: '600', color: '#000', marginLeft: 4 },
  locationAddress: { fontSize: 13, color: '#666', marginBottom: 8, lineHeight: 18 },
  locationCoords: { fontSize: 11, color: '#999', marginBottom: 12 },
  locationOpenBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#e6f0ff', paddingVertical: 8, borderRadius: 6,
  },
  locationOpenText: { fontSize: 13, fontWeight: '600', color: ZaloColors.blue, marginLeft: 6 },

  // Contact Bubble
  contactBubble: {
    width: 250, borderRadius: 12, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#eee', overflow: 'hidden',
  },
  contactInfoRow: { flexDirection: 'row', padding: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  contactCardAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
  contactCardAvatarDefault: {
    width: 44, height: 44, borderRadius: 22, marginRight: 10,
    backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center',
  },
  contactCardAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#666' },
  contactCardTextWrap: { flex: 1 },
  contactCardName: { fontSize: 15, fontWeight: '600', color: '#000', marginBottom: 2 },
  contactCardPhone: { fontSize: 13, color: '#666' },
  contactCardActions: { flexDirection: 'row', backgroundColor: '#fafafa' },
  contactCardBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 10, borderRightWidth: 1, borderRightColor: '#eee',
  },
  contactCardBtnText: { fontSize: 13, fontWeight: '500', color: '#0068FF', marginLeft: 4 },

  // Reminder Bubble
  reminderBubble: {
    width: 250, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#eee', flexDirection: 'row',
  },
  reminderIconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,99,72,0.1)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  reminderInfoWrap: { flex: 1 },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  reminderLabel: { fontSize: 14, fontWeight: '600', color: '#000' },
  reminderText: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 8 },
  reminderTimeRow: { flexDirection: 'row', alignItems: 'center' },
  reminderTimeText: { fontSize: 12, color: '#888', marginLeft: 4 },

  statusRow: { alignSelf: 'flex-end', marginTop: 2 },
  seenAvatarRow: { alignItems: 'flex-end', marginTop: 2, marginRight: 16 },
  seenAvatar: { width: 14, height: 14, borderRadius: 7 },
  seenAvatarDefault: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center',
  },

  revokedBubble: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#f5f5f5', borderRadius: 16,
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  revokedText: { fontSize: 14, color: '#999', fontStyle: 'italic' },

  translatedWrap: {
    marginTop: 6, paddingTop: 6,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)', borderStyle: 'dashed',
  },
  translatedText: { fontSize: 14, fontStyle: 'italic', lineHeight: 20, opacity: 0.9 },
  translatingWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  translatingText: { fontSize: 12, color: '#999', marginLeft: 6, fontStyle: 'italic' },
});

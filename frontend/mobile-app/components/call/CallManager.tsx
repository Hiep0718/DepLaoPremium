import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Image } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
  MediaStream,
  mediaDevices
} from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import { useGroupCallStore } from '../../stores/groupCallStore';
import { useSocket } from '../../contexts/SocketContext';
import apiClient from '../../constants/api';

const { width, height } = Dimensions.get('window');

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const CallManager = () => {
  const {
    callState, conversationId, isVideo, isMinimized, callerId,
    setIncomingCall, acceptCall, endCall, setMinimized, addParticipant, removeParticipant
  } = useGroupCallStore();

  const { socket, currentUserId } = useSocket();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteMutes, setRemoteMutes] = useState<Record<string, boolean>>({});
  const [participantsData, setParticipantsData] = useState<Record<string, { fullName: string; avatarUrl: string }>>({});

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const isMutedRef = useRef(false);
  const isVideoOffRef = useRef(false);
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());
  const currentConversationId = useRef<string | null>(null);

  useEffect(() => {
    currentConversationId.current = conversationId;
  }, [conversationId]);

  // Fetch thông tin người tham gia (avatar, tên) từ API
  useEffect(() => {
    const currentParticipantIds = Object.keys(remoteStreams);
    if (callState === 'idle' || currentParticipantIds.length === 0) return;

    let isMounted = true;
    const fetchUsers = async () => {
      const idsToFetch = currentParticipantIds.filter(id => !participantsData[id]);
      if (idsToFetch.length === 0) return;

      const newData: Record<string, { fullName: string; avatarUrl: string }> = {};
      await Promise.all(idsToFetch.map(async (uid) => {
        try {
          const res = await apiClient.get(`/users/${uid}`);
          const u = res.data?.data || res.data;
          if (u) {
            newData[uid] = {
              fullName: u.fullName || u.nickname || `User ${uid.substring(0, 4)}`,
              avatarUrl: u.avatarUrl || '',
            };
          }
        } catch { /* ignore */ }
      }));

      if (!isMounted) return;
      if (Object.keys(newData).length > 0) {
        setParticipantsData(prev => ({ ...prev, ...newData }));
      }
    };
    fetchUsers();
    return () => { isMounted = false; };
  }, [remoteStreams, callState]);

  // Signaling setup
  useEffect(() => {
    if (!socket || !currentUserId) return;

    const handleIncoming = (data: any) => {
      const { conversationId: rId, callerId: cId, isVideo: isVid } = data;
      if (useGroupCallStore.getState().callState !== 'idle') {
        socket.emit('group_call_reject', { conversationId: rId, callerId: cId });
        return;
      }
      setIncomingCall(rId, cId, isVid);
    };

    const handleUserJoined = async (data: any) => {
      if (useGroupCallStore.getState().callState !== 'in-call') return;
      const { userId } = data;
      if (userId === String(currentUserId)) return;
      addParticipant(userId);
      await createPeerConnection(userId);
    };

    const handleOffer = async (data: any) => {
      if (useGroupCallStore.getState().callState !== 'in-call') return;
      const { senderPeerId, offer } = data;
      addParticipant(senderPeerId);

      const pc = await createPeerConnection(senderPeerId);
      if (!pc) return;

      try {
        const isPolite = String(currentUserId) < String(senderPeerId);
        const offerCollision = makingOfferRef.current.get(senderPeerId) || pc.signalingState !== 'stable';

        const shouldIgnore = !isPolite && offerCollision;
        ignoreOfferRef.current.set(senderPeerId, shouldIgnore);

        if (shouldIgnore) return;

        if (offerCollision) {
          try {
            await pc.setLocalDescription({ type: 'rollback' } as any);
          } catch (e) {
            console.warn("Rollback không được hỗ trợ", e);
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('group_webrtc_answer', {
          targetPeerId: senderPeerId,
          answer,
          conversationId: currentConversationId.current
        });
      } catch (e) {
        console.error("Lỗi xử lý Offer", e);
      }
    };

    const handleAnswer = async (data: any) => {
      if (useGroupCallStore.getState().callState !== 'in-call') return;
      const { senderPeerId, answer } = data;
      const pc = pcsRef.current.get(senderPeerId);
      if (pc) {
        try {
          if (pc.signalingState !== 'have-local-offer') {
            console.warn(`Bỏ qua answer vì state hiện tại là ${pc.signalingState}`);
            return;
          }
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (e) {
          console.error("Lỗi setRemoteDescription Answer", e);
        }
      }
    };

    const handleIceCandidate = async (data: any) => {
      if (useGroupCallStore.getState().callState !== 'in-call') return;
      const { senderPeerId, candidate } = data;
      const pc = pcsRef.current.get(senderPeerId);
      if (pc && candidate) {
        try {
          if (ignoreOfferRef.current.get(senderPeerId)) return;
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Lỗi addIceCandidate", e);
        }
      }
    };

    const handleUserLeft = (data: any) => {
      const { userId } = data;
      removeParticipant(userId);
      const pc = pcsRef.current.get(userId);
      if (pc) {
        pc.close();
        pcsRef.current.delete(userId);
      }
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const handleCallEnded = (data: any) => {
      if (data.conversationId === currentConversationId.current) {
        // Server thông báo cuộc gọi đã kết thúc (tất cả mọi người đã rời)
        useGroupCallStore.getState().endCall();
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(t => t.stop());
          localStreamRef.current = null;
          setLocalStream(null);
        }
        pcsRef.current.forEach(pc => pc.close());
        pcsRef.current.clear();
        setRemoteStreams({});
        setIsMuted(false);
        setIsVideoOff(false);
      }
    };

    // Đồng bộ đa thiết bị: Khi user xử lý cuộc gọi trên thiết bị khác
    const handleCallHandled = (data: any) => {
      const { conversationId: handledConvId, handledBySocketId } = data;
      // Chỉ xử lý nếu event đến từ thiết bị KHÁC
      if (handledBySocketId === socket.id) return;
      const state = useGroupCallStore.getState();
      if (state.callState === 'ringing' && state.conversationId === handledConvId) {
        endCall();
      }
    };

    const handleRemoteMute = (data: any) => {
      if (useGroupCallStore.getState().callState !== 'in-call') return;
      const { userId, isMuted: muted } = data;
      setRemoteMutes(prev => ({ ...prev, [userId]: muted }));
    };

    socket.on('group_call_incoming', handleIncoming);
    socket.on('group_user_joined', handleUserJoined);
    socket.on('group_webrtc_offer', handleOffer);
    socket.on('group_webrtc_answer', handleAnswer);
    socket.on('group_webrtc_ice_candidate', handleIceCandidate);
    socket.on('group_user_left', handleUserLeft);
    socket.on('group_call_ended', handleCallEnded);
    socket.on('group_call_handled', handleCallHandled);
    socket.on('group_call_remote_mute', handleRemoteMute);

    return () => {
      socket.off('group_call_incoming', handleIncoming);
      socket.off('group_user_joined', handleUserJoined);
      socket.off('group_webrtc_offer', handleOffer);
      socket.off('group_webrtc_answer', handleAnswer);
      socket.off('group_webrtc_ice_candidate', handleIceCandidate);
      socket.off('group_user_left', handleUserLeft);
      socket.off('group_call_ended', handleCallEnded);
      socket.off('group_call_handled', handleCallHandled);
      socket.off('group_call_remote_mute', handleRemoteMute);
    };
  }, [socket, currentUserId]);

  const initLocalStream = async (vid: boolean) => {
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: vid ? { facingMode: 'user' } : false,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error("Failed to get local stream", err);
      return null;
    }
  };

  const createPeerConnection = async (targetUserId: string) => {
    if (pcsRef.current.has(targetUserId)) {
      return pcsRef.current.get(targetUserId);
    }
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(targetUserId, pc);

    // @ts-ignore
    pc.onicecandidate = (event: any) => {
      if (event.candidate && socket) {
        socket.emit('group_webrtc_ice_candidate', {
          targetPeerId: targetUserId,
          candidate: event.candidate,
          conversationId: currentConversationId.current,
        });
      }
    };

    // @ts-ignore
    pc.ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        setRemoteStreams(prev => ({
          ...prev,
          [targetUserId]: event.streams[0]
        }));
      }
    };

    // @ts-ignore
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current.set(targetUserId, true);
        const offer = await pc.createOffer({});
        if (pc.signalingState !== 'stable') {
          return;
        }
        await pc.setLocalDescription(offer);
        socket?.emit('group_webrtc_offer', {
          targetPeerId: targetUserId,
          offer: pc.localDescription,
          conversationId: currentConversationId.current,
        });
      } catch (err) {
        console.error("Negotiation error", err);
      } finally {
        makingOfferRef.current.set(targetUserId, false);
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  };

  // Auto-init local stream when entering a call, then join the room
  useEffect(() => {
    if (callState === 'in-call' && !localStreamRef.current && socket && conversationId) {
      const joinAfterStreamReady = async () => {
        await initLocalStream(isVideo);
        // Chỉ emit join SAU KHI local stream đã sẵn sàng
        socket.emit('group_call_join', { conversationId });
      };
      joinAfterStreamReady();
    }
  }, [callState]);

  const startCall = async () => {
    await initLocalStream(isVideo);
    acceptCall();
    if (socket && conversationId) {
      socket.emit('group_call_join', { conversationId });
    }
  };

  const leaveCall = () => {
    if (socket && conversationId) {
      const hasRemoteParticipants = Object.keys(remoteStreams).length > 0;
      const iAmCaller = String(callerId) === String(currentUserId);
      
      // Nếu mình là người tạo cuộc gọi VÀ chưa có ai tham gia → hủy ngay lập tức
      if (iAmCaller && !hasRemoteParticipants) {
        socket.emit('group_call_cancel', { conversationId });
      } else {
        socket.emit('group_call_leave', { conversationId });
      }
    }
    endCall();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    pcsRef.current.forEach(pc => pc.close());
    pcsRef.current.clear();
    setRemoteStreams({});
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      const newMuted = !localStreamRef.current.getAudioTracks()[0].enabled;
      setIsMuted(newMuted);
      // Thông báo cho người khác biết mình tắt/bật mic
      if (socket && conversationId) {
        socket.emit('group_call_mute_state', { conversationId, isMuted: newMuted });
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideoOff(!localStreamRef.current.getVideoTracks()[0]?.enabled);
    }
  };

  if (callState === 'idle') return null;

  if (callState === 'ringing') {
    return (
      <View style={styles.incomingCallOverlay}>
        <View style={styles.incomingBox}>
          <View style={styles.incomingIconWrap}>
            <Ionicons name="people" size={36} color="#0068FF" />
          </View>
          <Text style={styles.incomingTitle}>Cuộc gọi nhóm</Text>
          <Text style={styles.incomingSubtitle}>{isVideo ? 'Cuộc gọi video đến...' : 'Cuộc gọi thoại đến...'}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={() => {
              if (socket && conversationId) socket.emit('group_call_reject', { conversationId, callerId });
              endCall();
            }}>
              <Ionicons name="call" size={24} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnAccept]} onPress={startCall}>
              <Ionicons name={isVideo ? 'videocam' : 'call'} size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // In call UI
  if (isMinimized) {
    return (
      <TouchableOpacity style={styles.minimizedBox} onPress={() => setMinimized(false)}>
        <Ionicons name={isVideo ? "videocam" : "call"} size={20} color="white" />
        <Text style={{ color: 'white', marginLeft: 8, fontWeight: '600' }}>Chạm để trở lại</Text>
      </TouchableOpacity>
    );
  }

  const remoteUsers = Object.keys(remoteStreams);
  const totalParticipants = remoteUsers.length + 1;

  // Participant Card Component
  const ParticipantCard = ({ id, isLocal, stream }: { id: string; isLocal: boolean; stream: MediaStream | null }) => {
    const hasVideo = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;
    const showVideo = isVideo && hasVideo && (isLocal ? !isVideoOff : true);
    const participantMuted = isLocal ? isMuted : (remoteMutes[id] || false);
    const pData = participantsData[id];
    const displayName = isLocal ? 'Bạn' : (pData?.fullName || `User ${id.substring(0, 4)}`);
    const avatarUrl = pData?.avatarUrl || '';
    const initials = isLocal ? 'B' : (pData?.fullName?.charAt(0) || id.charAt(0) || 'U').toUpperCase();

    return (
      <View style={styles.participantCard}>
        {showVideo && stream ? (
          <RTCView
            streamURL={stream.toURL()}
            style={styles.participantVideo}
            objectFit="cover"
            zOrder={isLocal ? 1 : 0}
          />
        ) : (
          <View style={styles.participantAvatarWrap}>
            {avatarUrl && !isLocal ? (
              <Image source={{ uri: avatarUrl }} style={styles.participantAvatarImg} />
            ) : (
              <View style={styles.participantAvatar}>
                <Text style={styles.participantAvatarText}>{initials}</Text>
              </View>
            )}
            <Text style={styles.participantNameCenter}>{displayName}</Text>
          </View>
        )}

        {/* Bottom badge: Name + Mute icon */}
        <View style={styles.participantBadge}>
          {participantMuted && (
            <View style={styles.muteBadgeIcon}>
              <Ionicons name="mic-off" size={12} color="#FF3B30" />
            </View>
          )}
          <Text style={styles.participantBadgeText} numberOfLines={1}>{displayName}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.inCallOverlay}>
      {/* Header */}
      <View style={styles.callHeader}>
        <View style={styles.callHeaderLeft}>
          <View style={styles.callHeaderIcon}>
            <Ionicons name="people" size={18} color="#0068FF" />
          </View>
          <View>
            <Text style={styles.callHeaderTitle}>Cuộc gọi nhóm</Text>
            <Text style={styles.callHeaderSub}>{totalParticipants} người tham gia</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.minimizeBtnNew} onPress={() => setMinimized(true)}>
          <Ionicons name="chevron-down" size={22} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Participants Grid */}
      <ScrollView contentContainerStyle={styles.participantsGrid}>
        {/* Local */}
        <ParticipantCard id={String(currentUserId || 'me')} isLocal={true} stream={localStream} />
        {/* Remote */}
        {remoteUsers.map(uid => (
          <ParticipantCard key={uid} id={uid} isLocal={false} stream={remoteStreams[uid]} />
        ))}
      </ScrollView>

      {/* Control Bar */}
      <View style={styles.controlBar}>
        <TouchableOpacity
          style={[styles.controlBtnNew, isMuted && styles.controlBtnActive]}
          onPress={toggleMute}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color={isMuted ? '#FF3B30' : '#333'} />
        </TouchableOpacity>
        {isVideo && (
          <TouchableOpacity
            style={[styles.controlBtnNew, isVideoOff && styles.controlBtnActive]}
            onPress={toggleVideo}
          >
            <Ionicons name={isVideoOff ? 'videocam-off' : 'videocam'} size={24} color={isVideoOff ? '#FF3B30' : '#333'} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.endCallBtn} onPress={leaveCall}>
          <Ionicons name="call" size={24} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  // ─── Incoming Call ───
  incomingCallOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 9999,
  },
  incomingBox: {
    width: '80%', backgroundColor: 'white', borderRadius: 20, padding: 28, alignItems: 'center',
  },
  incomingIconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#E5F0FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  incomingTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 4 },
  incomingSubtitle: { fontSize: 14, color: '#888', marginBottom: 28 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  btn: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  btnReject: { backgroundColor: '#FF3B30' },
  btnAccept: { backgroundColor: '#34C759' },

  // ─── Minimized ───
  minimizedBox: {
    position: 'absolute', top: 50, right: 16,
    backgroundColor: '#0068FF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
    flexDirection: 'row', alignItems: 'center',
    zIndex: 9999, elevation: 10,
    shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
  },

  // ─── In-Call Overlay ───
  inCallOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F5F6F8',
    zIndex: 9999,
  },

  // ─── Header ───
  callHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 50, paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  callHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  callHeaderIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#E5F0FF',
    justifyContent: 'center', alignItems: 'center',
  },
  callHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  callHeaderSub: { fontSize: 12, color: '#999', marginTop: 1 },
  minimizeBtnNew: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center',
  },

  // ─── Participants Grid ───
  participantsGrid: {
    flexGrow: 1, flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', alignItems: 'center', alignContent: 'center',
    padding: 12, gap: 12,
  },
  participantCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#E8E8E8',
    position: 'relative',
    width: (SCREEN_WIDTH - 12 * 3) / 2,
    aspectRatio: 3 / 4,
  },
  participantVideo: {
    width: '100%', height: '100%',
  },
  participantAvatarWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8',
  },
  participantAvatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#0068FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  participantAvatarImg: {
    width: 64, height: 64, borderRadius: 32, marginBottom: 8,
  },
  participantAvatarText: {
    fontSize: 26, fontWeight: '700', color: '#fff',
  },
  participantNameCenter: {
    fontSize: 14, fontWeight: '600', color: '#555',
  },
  participantBadge: {
    position: 'absolute', bottom: 8, left: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  muteBadgeIcon: {
    width: 20, height: 20, borderRadius: 6,
    backgroundColor: 'rgba(255,59,48,0.2)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  participantBadgeText: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.9)', flex: 1,
  },

  // ─── Control Bar ───
  controlBar: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20,
    paddingVertical: 20, paddingBottom: 40,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  controlBtnNew: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  controlBtnActive: {
    backgroundColor: '#FFEDED', borderColor: 'rgba(255,59,48,0.2)',
  },
  endCallBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center',
  },
});

export default CallManager;

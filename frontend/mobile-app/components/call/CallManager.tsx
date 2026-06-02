import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image, Alert } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
  MediaStream,
  mediaDevices,
  RTCIceCandidateType
} from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../../stores/callStore';
import { useSocket } from '../../contexts/SocketContext';

const { width, height } = Dimensions.get('window');

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const CallManager = () => {
  const {
    callState, callerInfo, isVideo, isMinimized,
    setIncomingCall, acceptCall, endCall, setMinimized
  } = useCallStore();

  const { socket, currentUserId } = useSocket();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const candidateQueue = useRef<RTCIceCandidateType[]>([]);
  const isStartingRef = useRef(false);

  // Signaling setup
  useEffect(() => {
    if (!socket || !currentUserId) return;

    socket.on('call_incoming', (data: any) => {
      const { callerId, callerInfo, isVideo, conversationId } = data;
      if (useCallStore.getState().callState !== 'idle') {
        socket.emit('call_rejected', { callerId, reason: 'Người dùng đang bận', conversationId });
        return;
      }
      setIncomingCall(callerId, callerInfo, isVideo, conversationId);
    });

    socket.on('call_accepted', async () => {
      acceptCall();
      await startPeerConnection();
      await createOffer();
    });

    socket.on('call_rejected', (data: any) => {
      Alert.alert('Cuộc gọi bị từ chối', data.reason || 'Bận');
      cleanupCall();
    });

    socket.on('call_ended', () => {
      cleanupCall();
    });

    socket.on('webrtc_offer', async (data: any) => {
      if (!pcRef.current) await startPeerConnection();
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(data.offer));

      while (candidateQueue.current.length > 0) {
        pcRef.current?.addIceCandidate(new RTCIceCandidate(candidateQueue.current.shift()!)).catch(console.error);
      }

      const answer = await pcRef.current?.createAnswer();
      await pcRef.current?.setLocalDescription(answer);
      socket.emit('webrtc_answer', { peerId: data.peerId, answer });
    });

    socket.on('webrtc_answer', async (data: any) => {
      if (pcRef.current && pcRef.current.signalingState !== 'stable') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));

        while (candidateQueue.current.length > 0) {
          pcRef.current?.addIceCandidate(new RTCIceCandidate(candidateQueue.current.shift()!)).catch(console.error);
        }
      }
    });

    socket.on('webrtc_ice_candidate', async (data: any) => {
      if (data.candidate) {
        if (pcRef.current && pcRef.current.remoteDescription) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.error("Error adding received ice candidate", e);
          }
        } else {
          candidateQueue.current.push(data.candidate);
        }
      }
    });

    return () => {
      socket.off('call_incoming');
      socket.off('call_accepted');
      socket.off('call_rejected');
      socket.off('call_ended');
      socket.off('webrtc_offer');
      socket.off('webrtc_answer');
      socket.off('webrtc_ice_candidate');
      cleanupCall();
    };
  }, [socket, currentUserId]);

  const initLocalStream = async () => {
    try {
      const currentIsVideo = useCallStore.getState().isVideo;
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: currentIsVideo ? { facingMode: 'user' } : false,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error("Failed to get local stream", err);
      return null;
    }
  };

  const startPeerConnection = async () => {
    if (pcRef.current) return;
    if (isStartingRef.current) {
      await new Promise(resolve => {
        const interval = setInterval(() => {
          if (pcRef.current) {
            clearInterval(interval);
            resolve(true);
          }
        }, 50);
      });
      return;
    }

    isStartingRef.current = true;
    try {
      let stream = localStreamRef.current;
      if (!stream) {
        stream = await initLocalStream();
        if (!stream) return;
      }

      pcRef.current = new RTCPeerConnection(ICE_SERVERS);

      stream.getTracks().forEach((track) => {
        pcRef.current?.addTrack(track, stream!);
      });

      // @ts-ignore
      pcRef.current.ontrack = (event: any) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // @ts-ignore
      pcRef.current.onicecandidate = (event: any) => {
        const currentPeerId = useCallStore.getState().peerId;
        if (event.candidate && currentPeerId) {
          socket.emit('webrtc_ice_candidate', { peerId: currentPeerId, candidate: event.candidate });
        }
      };

    } finally {
      isStartingRef.current = false;
    }
  };

  const createOffer = async () => {
    const currentPeerId = useCallStore.getState().peerId;
    if (!pcRef.current || !currentPeerId) return;
    try {
      const offer = await pcRef.current.createOffer({});
      await pcRef.current.setLocalDescription(offer);
      socket.emit('webrtc_offer', { peerId: currentPeerId, offer });
    } catch (e) {
      console.error(e);
    }
  };

  const cleanupCall = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    setRemoteStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
    endCall();
  };

  const handleAcceptCall = async () => {
    acceptCall();
    const currentPeerId = useCallStore.getState().peerId;
    if (currentPeerId) {
      socket.emit('call_accepted', { callerId: currentPeerId });
      await startPeerConnection();
    }
  };

  const handleRejectCall = () => {
    const currentPeerId = useCallStore.getState().peerId;
    if (currentPeerId) socket.emit('call_rejected', { callerId: currentPeerId, reason: 'Từ chối cuộc gọi' });
    cleanupCall();
  };

  const handleEndCall = () => {
    const currentPeerId = useCallStore.getState().peerId;
    const currentConversationId = useCallStore.getState().conversationId;
    if (currentPeerId) socket.emit('call_ended', { peerId: currentPeerId, conversationId: currentConversationId });
    cleanupCall();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  if (callState === 'idle') return null;

  const displayName = callerInfo?.fullName || 'Người dùng';

  if (callState === 'ringing') {
    return (
      <View style={styles.incomingCallOverlay}>
        <View style={styles.incomingBox}>
          <View style={styles.incomingIconWrap}>
            {callerInfo?.avatarUrl ? (
               <Image source={{ uri: callerInfo.avatarUrl }} style={styles.avatarImg} />
            ) : (
               <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.incomingTitle}>{displayName}</Text>
          <Text style={styles.incomingSubtitle}>{isVideo ? 'Cuộc gọi video đến...' : 'Cuộc gọi thoại đến...'}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={handleRejectCall}>
              <Ionicons name="call" size={24} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnAccept]} onPress={handleAcceptCall}>
              <Ionicons name={isVideo ? 'videocam' : 'call'} size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const isWaiting = callState === 'calling';

  if (isMinimized) {
    return (
      <TouchableOpacity style={styles.minimizedBox} onPress={() => setMinimized(false)}>
        <Ionicons name={isVideo ? "videocam" : "call"} size={20} color="white" />
        <Text style={{ color: 'white', marginLeft: 8, fontWeight: '600' }}>Chạm để trở lại</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.inCallOverlay}>
      <View style={styles.callHeader}>
        <View style={styles.callHeaderLeft}>
          <Text style={styles.callHeaderTitle}>{displayName}</Text>
          <Text style={styles.callHeaderSub}>{isWaiting ? 'Đang gọi...' : '00:00'}</Text>
        </View>
        <TouchableOpacity style={styles.minimizeBtnNew} onPress={() => setMinimized(true)}>
          <Ionicons name="chevron-down" size={22} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.mediaContainer}>
        {isVideo ? (
          <>
            {remoteStream && (
              <RTCView
                streamURL={remoteStream.toURL()}
                style={styles.remoteVideo}
                objectFit="cover"
              />
            )}
            {localStream && !isVideoOff && (
              <View style={styles.localVideoWrap}>
                <RTCView
                  streamURL={localStream.toURL()}
                  style={styles.localVideo}
                  objectFit="cover"
                  zOrder={1}
                />
              </View>
            )}
            {isWaiting && !remoteStream && (
              <View style={styles.waitingContainer}>
                 <View style={styles.largeAvatarWrap}>
                    {callerInfo?.avatarUrl ? (
                      <Image source={{ uri: callerInfo.avatarUrl }} style={styles.largeAvatarImg} />
                    ) : (
                      <Text style={styles.largeAvatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                    )}
                 </View>
                 <Text style={styles.waitingText}>Đang đổ chuông...</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.waitingContainer}>
             <View style={styles.largeAvatarWrap}>
                {callerInfo?.avatarUrl ? (
                  <Image source={{ uri: callerInfo.avatarUrl }} style={styles.largeAvatarImg} />
                ) : (
                  <Text style={styles.largeAvatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                )}
             </View>
             {isWaiting && <Text style={styles.waitingText}>Đang đổ chuông...</Text>}
          </View>
        )}
      </View>

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
        <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
          <Ionicons name="call" size={24} color="white" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    justifyContent: 'center', alignItems: 'center', marginBottom: 16, overflow: 'hidden'
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#0068FF' },
  incomingTitle: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 4 },
  incomingSubtitle: { fontSize: 14, color: '#888', marginBottom: 28 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  btn: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  btnReject: { backgroundColor: '#FF3B30' },
  btnAccept: { backgroundColor: '#34C759' },

  minimizedBox: {
    position: 'absolute', top: 50, right: 16,
    backgroundColor: '#0068FF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
    flexDirection: 'row', alignItems: 'center',
    zIndex: 9999, elevation: 10,
    shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
  },

  inCallOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#111',
    zIndex: 9999,
  },
  callHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10
  },
  callHeaderLeft: { flexDirection: 'column' },
  callHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  callHeaderSub: { fontSize: 14, color: '#ccc', marginTop: 2 },
  minimizeBtnNew: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },

  mediaContainer: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  remoteVideo: { position: 'absolute', width: '100%', height: '100%' },
  localVideoWrap: {
    position: 'absolute', bottom: 120, right: 20,
    width: 100, height: 150,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    zIndex: 20
  },
  localVideo: { width: '100%', height: '100%' },

  waitingContainer: { alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  largeAvatarWrap: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: '#0068FF',
    justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden'
  },
  largeAvatarImg: { width: '100%', height: '100%' },
  largeAvatarText: { fontSize: 48, fontWeight: 'bold', color: '#fff' },
  waitingText: { fontSize: 18, color: '#fff' },

  controlBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24,
    paddingVertical: 20, paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10
  },
  controlBtnNew: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  controlBtnActive: {
    backgroundColor: '#fff',
  },
  endCallBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center',
  },
});

export default CallManager;

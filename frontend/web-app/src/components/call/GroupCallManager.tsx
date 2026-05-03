import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGroupCallStore } from '../../stores/groupCallStore';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { socket } from '../../services/socket';
import { 
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff, 
  Maximize2, Minimize2, Users, User, Volume2, VolumeX 
} from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const RINGTONE_URL = '/ringtone.mp3';

// ═════════════════ HOOKS ═════════════════ //

const useSpeakingDetector = (stream: MediaStream | null) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setIsSpeaking(false);
      return;
    }

    let audioContext: AudioContext;
    let analyser: AnalyserNode;
    let source: MediaStreamAudioSourceNode;
    let animationFrameId: number;

    const detectSpeaking = () => {
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let silenceStartTime = 0;

        const checkVolume = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          
          if (average > 25) {
            setIsSpeaking(true);
            silenceStartTime = 0;
          } else {
            // Nếu im lặng, đợi 400ms trước khi tắt viền xanh
            if (silenceStartTime === 0) {
              silenceStartTime = Date.now();
            } else if (Date.now() - silenceStartTime > 400) {
              setIsSpeaking(false);
            }
          }
          
          animationFrameId = requestAnimationFrame(checkVolume);
        };

        checkVolume();
      } catch (e) {
        // console.warn('AudioContext check error:', e);
      }
    };

    detectSpeaking();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioContext) audioContext.close();
    };
  }, [stream]);

  return isSpeaking;
};

const GroupCallManager = () => {
  const { 
    callState, conversationId, isVideo, isMinimized, callerId,
    setIncomingCall, acceptCall, endCall, setMinimized, addParticipant, removeParticipant
  } = useGroupCallStore();

  const user = useAuthStore((state) => state.user);
  const activeConversation = useChatStore((state) => state.activeConversation);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteMutes, setRemoteMutes] = useState<Record<string, boolean>>({});
  const [remoteVideoOffs, setRemoteVideoOffs] = useState<Record<string, boolean>>({});

  // Mesh Network states
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const isMutedRef = useRef(false);
  const isVideoOffRef = useRef(false);
  const mediaRequestRef = useRef<Promise<MediaStream | null> | null>(null);
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferRef = useRef<Map<string, boolean>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const ringtoneRef = useRef<HTMLAudioElement>(null);
  
  const currentConversationId = useRef<string | null>(null);
  const handleEndCallRef = useRef<(() => void) | null>(null);

  const [participantsData, setParticipantsData] = useState<Record<string, { fullName: string, avatarUrl: string }>>({});

  useEffect(() => {
    currentConversationId.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    const currentParticipantIds = Object.keys(remoteStreams);
    if (callState === 'idle' || currentParticipantIds.length === 0) return;
    
    let isMounted = true;
    const fetchUsers = async () => {
      const idsToFetch = currentParticipantIds.filter(id => !participantsData[id]);
      if (idsToFetch.length === 0) return;
      
      try {
        const { default: api } = await import('../../services/axios');
        const newFetchedData: Record<string, { fullName: string, avatarUrl: string }> = {};
        
        await Promise.all(idsToFetch.map(async (uid) => {
          try {
            const res = await api.get(`/users/${uid}`);
            const u = res.data?.data || res.data;
            if (u && (u._id || u.id || uid)) {
              newFetchedData[uid] = { 
                fullName: u.fullName || u.nickname || `User ${uid.substring(0,4)}`, 
                avatarUrl: u.avatarUrl || '' 
              };
            }
          } catch {
             // ignore failed user fetches
          }
        }));
        
        if (!isMounted) return;
        
        if (Object.keys(newFetchedData).length > 0) {
          setParticipantsData(prev => ({ ...prev, ...newFetchedData }));
        }
      } catch (err) {
        console.error('Fetch user for call error', err);
      }
    };
    fetchUsers();
    
    return () => { isMounted = false; };
  }, [remoteStreams, callState]);

  // ═════════════════ SOCKET SIGNALING LISTENERS ═════════════════ //
  useEffect(() => {
    socket.on('group_call_incoming', (data) => {
      const { conversationId: rId, callerId: cId, isVideo: isVid } = data;
      if (useGroupCallStore.getState().callState !== 'idle') {
        socket.emit('group_call_reject', { conversationId: rId, callerId: cId });
        return;
      }
      setIncomingCall(rId, cId, isVid);
    });

    socket.on('group_user_joined', async (data) => {
      if (useGroupCallStore.getState().callState !== 'in-call') return;
      const { userId } = data;
      if (userId === String(user?.id)) return;
      
      addParticipant(userId);

      // Tell the new joiner about our current state
      socket.emit('group_call_mute_state', {
        conversationId: currentConversationId.current,
        isMuted: isMutedRef.current
      });
      socket.emit('group_call_video_state', {
        conversationId: currentConversationId.current,
        isVideoOff: isVideoOffRef.current
      });
      
      // Perfect Negotiation: Just create the PC and add tracks. 
      await createPeerConnection(userId);
    });

    socket.on('group_webrtc_offer', async (data) => {
      if (useGroupCallStore.getState().callState !== 'in-call') return;
      const { senderPeerId, offer } = data;
      addParticipant(senderPeerId);
      
      const pc = await createPeerConnection(senderPeerId);
      if (!pc) return;

      try {
        const isPolite = String(user?.id) < String(senderPeerId);
        const offerCollision = makingOfferRef.current.get(senderPeerId) || pc.signalingState !== 'stable';
        
        const shouldIgnore = !isPolite && offerCollision;
        ignoreOfferRef.current.set(senderPeerId, shouldIgnore);
        
        if (shouldIgnore) {
          console.log(`[WebRTC] Ignoring offer collision from ${senderPeerId}`);
          return;
        }

        if (offerCollision) {
          await pc.setLocalDescription({ type: 'rollback' });
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
        console.error("Lỗi xử lý Offer từ", senderPeerId, e);
      }
    });

    socket.on('group_webrtc_answer', async (data) => {
      if (useGroupCallStore.getState().callState !== 'in-call') return;
      const { senderPeerId, answer } = data;
      const pc = pcsRef.current.get(senderPeerId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (e) {
          console.error("Lỗi setRemoteDescription Answer từ", senderPeerId, e);
        }
      }
    });

    socket.on('group_webrtc_ice_candidate', async (data) => {
      if (useGroupCallStore.getState().callState !== 'in-call') return;
      const { senderPeerId, candidate } = data;
      const pc = pcsRef.current.get(senderPeerId);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Lỗi addIceCandidate từ", senderPeerId, e);
        }
      }
    });

    socket.on('group_user_left', (data) => {
      if (useGroupCallStore.getState().callState !== 'in-call') return;
      const { userId } = data;
      removeParticipant(userId);
      closePeerConnection(userId);
    });

    socket.on('group_call_remote_mute', (data) => {
      if (useGroupCallStore.getState().callState !== 'in-call') return;
      const { userId, isMuted } = data;
      setRemoteMutes(prev => ({ ...prev, [userId]: isMuted }));
    });

    socket.on('group_call_remote_video_off', (data) => {
      if (useGroupCallStore.getState().callState !== 'in-call') return;
      const { userId, isVideoOff } = data;
      setRemoteVideoOffs(prev => ({ ...prev, [userId]: isVideoOff }));
    });

    socket.on('group_call_ended', (data) => {
      if (data.conversationId === currentConversationId.current) {
        handleEndCallRef.current?.();
      }
    });

    return () => {
      socket.off('group_call_incoming');
      socket.off('group_user_joined');
      socket.off('group_webrtc_offer');
      socket.off('group_webrtc_answer');
      socket.off('group_webrtc_ice_candidate');
      socket.off('group_user_left');
      socket.off('group_call_remote_mute');
      socket.off('group_call_remote_video_off');
      socket.off('group_call_ended');
    };
  }, [user]);

  // Play ringtone when ringing
  useEffect(() => {
    if (callState === 'ringing') {
      if (ringtoneRef.current) ringtoneRef.current.play().catch(e => console.warn(e));
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    }
  }, [callState]);

  // Sync local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.warn(e));
    }
  }, [localStream, callState]);

  // Initialize Local Media
  useEffect(() => {
    if (callState === 'in-call' && !localStream) {
      getUserMedia();
    }
  }, [callState]);

  // ═════════════════ WEBRTC MESH LOGIC ═════════════════ //

  const getUserMedia = async () => {
    if (mediaRequestRef.current) return mediaRequestRef.current;

    mediaRequestRef.current = (async () => {
      try {
        console.log(`[Media] Requesting getUserMedia (video: ${isVideo})`);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideo ? { facingMode: "user" } : false,
        });

        // Sync initial state with UI
        stream.getAudioTracks().forEach(t => t.enabled = !isMutedRef.current);
        stream.getVideoTracks().forEach(t => t.enabled = !isVideoOffRef.current);

        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch (error) {
        console.error('Lỗi truy cập thiết bị:', error);
        alert('Không thể truy cập Microphone/Camera. Vui lòng kiểm tra quyền truy cập.');
        handleEndCall();
        return null;
      } finally {
        // Clear the lock after a short delay to allow stable state
        setTimeout(() => { mediaRequestRef.current = null; }, 1000);
      }
    })();

    return mediaRequestRef.current;
  };

  const createPeerConnection = async (peerId: string) => {
    if (pcsRef.current.has(peerId)) return pcsRef.current.get(peerId);

    let stream = localStreamRef.current;
    if (!stream) {
      stream = await getUserMedia();
      if (!stream) return null;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(peerId, pc);

    // Thêm các track cục bộ vào để gửi cho peerId
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream!);
    });

    // Nhận luồng media từ peerId
    pc.ontrack = (event) => {
      setRemoteStreams(prev => {
        const existingStream = prev[peerId] || new MediaStream();
        
        // Tránh thêm trùng track (nếu ontrack phát hỏa nhiều lần cho cùng 1 track)
        if (!existingStream.getTracks().find(t => t.id === event.track.id)) {
          existingStream.addTrack(event.track);
        }
        
        // Tạo một đối tượng MediaStream MỚI để 'ép' React/Browser phải render lại luồng Video
        return { ...prev, [peerId]: new MediaStream(existingStream.getTracks()) };
      });
    };

    // Gửi tín hiệu ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('group_webrtc_ice_candidate', {
          targetPeerId: peerId,
          candidate: event.candidate,
          conversationId: currentConversationId.current
        });
      }
    };

    // Xử lý đứt mạng hoặc đóng kết nối
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        closePeerConnection(peerId);
      }
    };

    // Renegotiation (needed when adding tracks mid-call)
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current.set(peerId, true);
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        
        await pc.setLocalDescription(offer);
        socket.emit('group_webrtc_offer', { 
          targetPeerId: peerId, 
          offer: pc.localDescription, 
          conversationId: currentConversationId.current 
        });
      } catch (e) {
        console.error("Lỗi đàm phán lại (renegotiation) cho", peerId, e);
      } finally {
        makingOfferRef.current.set(peerId, false);
      }
    };

    return pc;
  };

  const closePeerConnection = (peerId: string) => {
    const pc = pcsRef.current.get(peerId);
    if (pc) {
      pc.close();
      pcsRef.current.delete(peerId);
    }
    setRemoteStreams(prev => {
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
  };

  const handleAcceptCall = async () => {
    acceptCall();
    await getUserMedia();
    socket.emit('group_call_join', { conversationId });
  };

  const handleRejectCall = () => {
    socket.emit('group_call_reject', { conversationId, callerId });
    endCall();
  };

  const handleEndCall = () => {
    // Lấy state mới nhất từ store để tránh closure bị cũ trong socket listeners
    const state = useGroupCallStore.getState();
    const activeConvId = state.conversationId;
    const activeCallerId = state.callerId;
    const currentParticipantIds = Object.keys(remoteStreams);
    
    if (activeConvId) {
      if (currentParticipantIds.length === 0 && String(activeCallerId) === String(user?.id)) {
        socket.emit('group_call_cancel', { conversationId: activeConvId });
      } else {
        socket.emit('group_call_leave', { conversationId: activeConvId });
      }
    }
    // Dọn dẹp cục bộ
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    isMutedRef.current = false;
    isVideoOffRef.current = false;
    setRemoteStreams({});
    setIsMuted(false);
    setIsVideoOff(false);
    endCall();
  };

  // Keep the ref updated with the latest handler on every render
  useEffect(() => {
    handleEndCallRef.current = handleEndCall;
  });

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      const newMutedValue = !isMuted;
      setIsMuted(newMutedValue);
      isMutedRef.current = newMutedValue;
      
      if (audioTrack) {
        audioTrack.enabled = !newMutedValue;
        
        socket.emit('group_call_mute_state', {
          conversationId: currentConversationId.current,
          isMuted: newMutedValue
        });
      }
    }
  };

  const toggleVideo = async () => {
    if (!localStream) return;

    let videoTrack = localStream.getVideoTracks()[0];
    
    // Nếu chưa có track Video (do bắt đầu từ cuộc gọi Thoại)
    if (!videoTrack) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        if (newVideoTrack) {
          localStream.addTrack(newVideoTrack);
          videoTrack = newVideoTrack;
          setIsVideoOff(false);
          
          // Cập nhật cho tất cả Peer Connections
          pcsRef.current.forEach((pc) => {
             const sender = pc.getSenders().find(s => s.track?.kind === 'video');
             if (sender) {
               sender.replaceTrack(newVideoTrack);
             } else {
               pc.addTrack(newVideoTrack, localStream!);
             }
          });
          
          // Trigger renegotiation if needed (Mesh network)
          socket.emit('group_call_video_state', {
            conversationId: currentConversationId.current,
            isVideoOff: false
          });
        }
      } catch (err) {
        console.error('Không thể bật camera:', err);
        alert('Không tìm thấy thiết bị Camera hoặc bị từ chối quyền!');
        return;
      }
    } else {
      // Nếu đã có track thì sử dụng UI state làm gốc để tránh lệch pha (Out of sync)
      const newVideoOffValue = !isVideoOff;
      setIsVideoOff(newVideoOffValue);
      isVideoOffRef.current = newVideoOffValue;
      videoTrack.enabled = !newVideoOffValue;

      socket.emit('group_call_video_state', {
        conversationId: currentConversationId.current,
        isVideoOff: newVideoOffValue
      });
    }
  };

  // ═════════════════ RENDER UI ═════════════════ //

  if (callState === 'idle') return null;

  if (callState === 'ringing') {
    return createPortal(
      <div className={`fixed inset-0 z-[99999] flex items-center justify-center transition-all duration-300 ${isMinimized ? 'pointer-events-none' : 'bg-black/90 backdrop-blur-sm'}`}>
        <audio ref={ringtoneRef} src={RINGTONE_URL} loop autoPlay playsInline />
        <div className="bg-[var(--bg-panel)] w-80 rounded-2xl shadow-2xl p-6 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-3xl font-bold mb-4 animate-pulse">
            <Users size={40} />
          </div>
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-1">Cuộc Gọi Nhóm</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-8">Bạn có một lời mời gọi nhóm...</p>
          
          <div className="flex w-full justify-around">
            <button onClick={handleRejectCall} className="w-14 h-14 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors">
              <PhoneOff size={24} />
            </button>
            <button onClick={handleAcceptCall} className="w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white transition-colors animate-bounce">
              {isVideo ? <Video size={24} /> : <Phone size={24} />}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Active Group Call
  const participantIds = Object.keys(remoteStreams);

  // Active Group Call
  const totalSlots = participantIds.length + 1; // +1 for local

  // Tính toán Kích thước Box
  let itemWidth = '100%';
  if (totalSlots === 1) { 
    itemWidth = 'min(90%, 1000px)'; 
  } else if (totalSlots === 2) { 
    itemWidth = 'calc(45% - 1rem)'; 
  } else if (totalSlots <= 4) { 
    itemWidth = 'calc(45% - 1rem)';
  } else if (totalSlots <= 6) { 
    itemWidth = 'calc(30% - 1rem)';
  } else { 
    itemWidth = 'calc(22% - 1rem)';
  }

  const VideoBox = ({ stream, isLocal, id }: { stream: MediaStream | null, isLocal: boolean, id: string }) => {
    const hasVideoTrack = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;
    const isRemoteVideoOff = !isLocal && remoteVideoOffs[id];
    const hideVideo = isLocal ? (isVideoOff || !hasVideoTrack) : (isRemoteVideoOff || !hasVideoTrack);
    
    // Detect speaking status
    const isSpeaking = useSpeakingDetector(stream);

    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
      const playVideo = async () => {
        if (videoRef.current && stream) {
          if (videoRef.current.srcObject !== stream) {
            videoRef.current.srcObject = stream;
          }
          
          try {
            // Chỉ gọi play nếu video đang tạm dừng
            if (videoRef.current.paused) {
              await videoRef.current.play();
            }
          } catch (e: any) {
            if (e.name !== 'AbortError') {
              console.warn('Video play error:', e);
            }
          }
        }
      };

      playVideo();
    }, [stream]);

    return (
      <div 
        key={id} 
        className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-300 bg-white aspect-video max-h-[40vh] ${
          isSpeaking ? 'border-green-500' : 'border-gray-100'
        }`} 
        style={{ width: itemWidth }}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className={`w-full h-full object-cover transition-all duration-700 ${isLocal ? 'scale-x-[-1]' : ''} ${hideVideo ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
          />
          
          {/* Avatar Fallback Layer */}
          {hideVideo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
               <div className="relative z-10 flex flex-col items-center">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gray-50 flex items-center justify-center border-2 border-gray-100 overflow-hidden mb-4">
                    {isLocal ? (
                      <img src={user?.avatarUrl || ''} alt="me" className="w-full h-full object-cover" />
                    ) : (
                      participantsData[id]?.avatarUrl ? (
                        <img src={participantsData[id].avatarUrl} alt={id} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#0068FF] flex items-center justify-center text-white text-3xl font-bold">
                          {(participantsData[id]?.fullName || 'U').charAt(0).toUpperCase()}
                        </div>
                      )
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-lg font-semibold text-gray-800 tracking-wide">
                      {isLocal ? 'Bạn' : (participantsData[id]?.fullName || `User ${id.substring(0,4)}`)}
                    </span>
                  </div>
               </div>
            </div>
          )}

          {/* User Status Badge (Bottom Left) */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10">
            {(isLocal ? isMuted : remoteMutes[id]) && (
              <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center border border-red-500/30">
                <MicOff size={14} className="text-red-500" />
              </div>
            )}
            <span className="text-xs font-semibold text-white/90 truncate max-w-[120px]">
              {isLocal ? 'Bạn' : (participantsData[id]?.fullName || `User ${id.substring(0,4)}`)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const content = (
    <div className={`fixed z-[999999] flex flex-col overflow-hidden transition-all duration-300 ${
      isMinimized 
        ? 'w-64 h-80 bottom-24 right-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[var(--border-light)]' 
        : 'inset-0 w-full h-full'
    }`}
    style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}>
      
      {/* Header */}
      <div className="absolute top-0 left-0 w-full p-5 flex justify-between items-center z-20" style={{ background: 'linear-gradient(to bottom, var(--bg-panel), transparent)' }}>
        <div className="flex flex-col">
          <span className="font-semibold text-lg flex items-center gap-2">
             <div className="p-1.5 bg-[#E5F0FF] text-[#0068FF] rounded-lg shadow-sm">
               <Users size={18}/>
             </div>
             Cuộc gọi nhóm
          </span>
          <span className="text-sm opacity-60 mt-0.5" style={{ color: 'var(--text-secondary)' }}>{totalSlots} người tham gia</span>
        </div>
        <div className="flex gap-2">
          {!isMinimized ? (
            <button onClick={() => setMinimized(true)} className="p-2.5 bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-sm rounded-full transition-transform active:scale-95">
              <Minimize2 size={20} />
            </button>
          ) : (
            <button onClick={() => setMinimized(false)} className="p-2.5 bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-sm rounded-full transition-transform active:scale-95">
              <Maximize2 size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Group Grid Area */}
      <div className="flex-1 w-full h-full p-4 pt-20 pb-28 overflow-hidden" style={{ background: 'var(--bg-chat, #f3f4f6)' }}>
        <div className="w-full h-full flex flex-wrap justify-center items-center gap-4 relative z-10 content-center">
          {/* Local Stream (Bạn) */}
          <VideoBox stream={localStream} isLocal={true} id={user?.id?.toString() || 'me'} />
          
          {/* Remote Streams */}
          {participantIds.map(id => (
            <VideoBox key={id} stream={remoteStreams[id]} isLocal={false} id={id} />
          ))}
        </div>
      </div>

      {/* Control Bar */}
      <div className="absolute bottom-0 left-0 w-full p-6 flex justify-center gap-6 items-center z-20" style={{ background: 'linear-gradient(to top, var(--bg-panel), transparent)' }}>
        <button onClick={toggleMute} className={`p-4 rounded-full transition-all active:scale-95 shadow-md flex items-center justify-center ${isMuted ? 'bg-[#FFEDED] text-[#FF3B30] border border-[#FF3B30]/20' : 'bg-[var(--bg-hover)] hover:brightness-95 text-[var(--text-primary)] border border-black/5'}`}>
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        {isVideo && (
          <button onClick={toggleVideo} className={`p-4 rounded-full transition-all active:scale-95 shadow-md flex items-center justify-center ${isVideoOff ? 'bg-[#FFEDED] text-[#FF3B30] border border-[#FF3B30]/20' : 'bg-[var(--bg-hover)] hover:brightness-95 text-[var(--text-primary)] border border-black/5'}`}>
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
        )}
        <button onClick={handleEndCall} className="p-4 bg-[#FF3B30] hover:bg-[#D92D20] text-white rounded-full transition-transform active:scale-95 shadow-lg flex items-center justify-center border border-red-800/10">
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default GroupCallManager;

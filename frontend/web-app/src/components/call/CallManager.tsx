import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCallStore } from '../../stores/callStore';
import { socket } from '../../services/socket';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Maximize2, Minimize2 } from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const RINGTONE_URL = '/ringtone.mp3';
const WAITING_TONE_URL = '/waiting-tone.wav';

const CallManager = () => {
  const {
    callState, callerInfo, isVideo, isMinimized,
    setIncomingCall, acceptCall, endCall, setMinimized
  } = useCallStore();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringtoneRef = useRef<HTMLAudioElement>(null);
  const candidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const isStartingRef = useRef(false);

  // ═════════════════ SOCKET SIGNALING LISTENERS ═════════════════ //

  useEffect(() => {
    socket.on('call_incoming', (data) => {
      const { callerId, callerInfo, isVideo, conversationId } = data;
      // If already in a call, send busy
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

    socket.on('call_rejected', (data) => {
      alert(`Cuộc gọi bị từ chối: ${data.reason || 'Bận'}`);
      cleanupCall();
    });

    socket.on('call_ended', () => {
      cleanupCall();
    });

    socket.on('webrtc_offer', async (data) => {
      if (!pcRef.current) await startPeerConnection();
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(data.offer));

      while (candidateQueue.current.length > 0) {
        pcRef.current?.addIceCandidate(new RTCIceCandidate(candidateQueue.current.shift()!)).catch(console.error);
      }

      const answer = await pcRef.current?.createAnswer();
      await pcRef.current?.setLocalDescription(answer);
      socket.emit('webrtc_answer', { peerId: data.peerId, answer });
    });

    socket.on('webrtc_answer', async (data) => {
      if (pcRef.current && pcRef.current.signalingState !== 'stable') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));

        while (candidateQueue.current.length > 0) {
          pcRef.current?.addIceCandidate(new RTCIceCandidate(candidateQueue.current.shift()!)).catch(console.error);
        }
      }
    });

    socket.on('webrtc_ice_candidate', async (data) => {
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
  }, []);

  // Play ringtone when ringing or calling
  useEffect(() => {
    const playAudio = async () => {
      try {
        if (callState === 'ringing') {
          if (ringtoneRef.current) await ringtoneRef.current.play();
        } else {
          if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
          }
        }
      } catch (e) {
        console.warn('Ringtone autoplay blocked', e);
      }
    };
    playAudio();
  }, [callState]);

  // ═════════════════ WEBRTC LOGIC ═════════════════ //

  const getUserMedia = async () => {
    try {
      const currentIsVideo = useCallStore.getState().isVideo;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: currentIsVideo ? { facingMode: "user" } : false,
      });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Lỗi truy cập thiết bị:', error);
      alert('Không thể truy cập Microphone/Camera.');
      cleanupCall();
      const currentPeerId = useCallStore.getState().peerId;
      if (useCallStore.getState().callState === 'calling' && currentPeerId) {
        socket.emit('call_ended', { peerId: currentPeerId });
      }
      return null;
    }
  };

  const startPeerConnection = async () => {
    if (pcRef.current) return;
    if (isStartingRef.current) {
      // Wait for the active initialization to complete
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
      let stream = localStream;
      if (!stream) {
        stream = await getUserMedia();
        if (!stream) return;
      }

      pcRef.current = new RTCPeerConnection(ICE_SERVERS);

      stream.getTracks().forEach((track) => {
        pcRef.current?.addTrack(track, stream!);
      });

      pcRef.current.ontrack = (event) => {
        console.log('WebRTC ontrack received:', event.track.kind);
        setRemoteStream(prev => {
          if (event.streams && event.streams[0]) {
            console.log('Using event.streams[0] length:', event.streams[0].getTracks().length);
            return new MediaStream(event.streams[0].getTracks());
          }
          const fallback = prev ? new MediaStream(prev.getTracks()) : new MediaStream();
          fallback.addTrack(event.track);
          console.log('Using fallback stream tracks:', fallback.getTracks().length);
          return fallback;
        });
      };

      pcRef.current.onicecandidate = (event) => {
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
      const offer = await pcRef.current.createOffer();
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
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
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
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        if (videoTrack.readyState === 'ended') {
          alert('Camera đã bị thu hồi quyền bởi hệ điều hành (thường do thu nhỏ trình duyệt). Vui lòng tắt gọi và gọi lại!');
          return;
        }
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        if (localVideoRef.current) {
          localVideoRef.current.play().catch(e => console.warn(e));
        }
      } else {
        alert('Không tìm thấy thiết bị Camera!');
      }
    }
  };

  // Sync streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.log('play local video err:', e));
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && isVideo) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.log('play remote video err:', e));
    }
    if (remoteAudioRef.current && remoteStream && !isVideo) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(e => console.log('play remote audio err:', e));
    }
  }, [remoteStream, isVideo, callState]);

  // ═════════════════ RENDER UI ═════════════════ //

  if (callState === 'idle') return null;

  const displayName = callerInfo?.fullName || 'Người dùng';

  // 1. Incoming Call Prompt
  if (callState === 'ringing') {
    return createPortal(
      <div className={`fixed inset-0 z-[99999] flex items-center justify-center transition-all duration-300 ${isMinimized ? 'pointer-events-none' : 'bg-black/90'}`}>
        <audio ref={ringtoneRef} src={RINGTONE_URL} loop autoPlay playsInline />
        <div className="bg-[var(--bg-panel)] w-80 rounded-2xl shadow-2xl p-6 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl font-bold mb-4 animate-pulse">
            {callerInfo?.avatarUrl ? <img src={callerInfo.avatarUrl} className="w-full h-full object-cover rounded-full" alt="avatar" /> : displayName.charAt(0).toUpperCase()}
          </div>
          <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-1">{displayName}</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-8">Đang gọi {isVideo ? 'video' : 'thoại'} tới bạn...</p>

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

  // 2. Active Call & Calling (Waiting for accept)
  const isWaiting = callState === 'calling';

  const content = (
    <div className={`fixed z-[999999] bg-[#1a1a1a] flex flex-col overflow-hidden text-white transition-all duration-300 shadow-2xl ${isMinimized
        ? 'w-64 h-80 bottom-4 right-4 rounded-xl'
        : 'inset-0 w-full h-full'
      }`}>

      {/* Header controls */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex flex-col">
          <span className="font-semibold">{displayName}</span>
          <span className="text-xs opacity-70">{isWaiting ? 'Đang gọi...' : '00:00'}</span>
        </div>
        <div className="flex gap-2">
          {!isMinimized ? (
            <button onClick={() => setMinimized(true)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
              <Minimize2 size={18} />
            </button>
          ) : (
            <button onClick={() => setMinimized(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
              <Maximize2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Video / Audio Area */}
      <div className="flex-1 relative flex items-center justify-center bg-[#111]">
        {isVideo ? (
          <>
            {/* Remote Video (Main) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={{ display: remoteStream ? 'block' : 'none' }}
            />


            {/* Local Video (PiP) - Đã sửa vị trí lên góc trên & tối ưu Callback Ref */}
            {localStream && (
              <div className={`absolute ${isMinimized ? 'bottom-2 right-2 w-16 h-24' : 'top-20 right-6 w-32 h-48'} bg-black/80 rounded-xl overflow-hidden border-2 border-white/50 shadow-2xl z-[99]`}>
                <video
                  // Sử dụng Callback Ref: Đảm bảo 100% video nhận được stream ngay khi render
                  ref={(node) => {
                    localVideoRef.current = node;
                    if (node && localStream && node.srcObject !== localStream) {
                      node.srcObject = localStream;
                      node.play().catch(e => console.warn('Lỗi play local video:', e));
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              </div>
            )}

            {/* Waiting Placeholder */}
            {(!remoteStream && !isWaiting) && (
              <div className="text-white/50 animate-pulse">Đang kết nối...</div>
            )}
            {isWaiting && (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-4xl mb-4 font-bold relative">
                  {callerInfo?.avatarUrl ? <img src={callerInfo.avatarUrl} className="w-full h-full object-cover rounded-full" alt="avatar" /> : displayName.charAt(0).toUpperCase()}
                  <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping"></div>
                </div>
                <p className="text-lg">Đang đổ chuông...</p>
                <audio src={WAITING_TONE_URL} loop autoPlay playsInline />
              </div>
            )}
          </>
        ) : (
          /* Audio Call Avatar */
          <div className="flex flex-col items-center">
            <div className={`${isMinimized ? 'w-20 h-20' : 'w-32 h-32'} bg-blue-600 rounded-full flex items-center justify-center text-5xl mb-6 font-bold shadow-2xl relative`}>
              {callerInfo?.avatarUrl ? <img src={callerInfo.avatarUrl} className="w-full h-full object-cover rounded-full" alt="avatar" /> : displayName.charAt(0).toUpperCase()}
              {!isWaiting && remoteStream && (
                <div className="absolute inset-0 rounded-full border-4 border-green-500/50 animate-pulse"></div>
              )}
            </div>
            {isWaiting && (
              <>
                <p className="text-lg opacity-80 animate-pulse">Đang đổ chuông...</p>
                <audio src={WAITING_TONE_URL} loop autoPlay playsInline />
              </>
            )}
            <audio ref={remoteAudioRef} autoPlay />
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="absolute bottom-0 left-0 w-full p-4 flex justify-center gap-6 items-center bg-gradient-to-t from-black/80 to-transparent z-10">
        <button onClick={toggleMute} className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-white text-black' : 'bg-white/20 hover:bg-white/30 text-white'}`}>
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        {isVideo && (
          <button onClick={toggleVideo} className={`p-4 rounded-full transition-colors ${isVideoOff ? 'bg-white text-black' : 'bg-white/20 hover:bg-white/30 text-white'}`}>
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
        )}
        <button onClick={handleEndCall} className="p-4 bg-red-500 hover:bg-red-600 rounded-full transition-colors shadow-lg">
          <PhoneOff size={24} color="white" />
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default CallManager;

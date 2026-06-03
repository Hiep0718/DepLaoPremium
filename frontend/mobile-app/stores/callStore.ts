import { create } from 'zustand';

export interface CallerInfo {
  id: string;
  fullName: string;
  avatarUrl?: string;
}

export type CallState = 'idle' | 'calling' | 'ringing' | 'active';

interface CallStore {
  callState: CallState;
  peerId: string | null;
  callerInfo: CallerInfo | null;
  isVideo: boolean;
  isCaller: boolean;
  isMinimized: boolean;
  conversationId: string | null;

  setIncomingCall: (peerId: string, callerInfo: CallerInfo, isVideo: boolean, conversationId: string) => void;
  setOutgoingCall: (peerId: string, callerInfo: CallerInfo, isVideo: boolean, conversationId: string) => void;
  acceptCall: () => void;
  endCall: () => void;
  setMinimized: (minimized: boolean) => void;
}

export const useCallStore = create<CallStore>((set) => ({
  callState: 'idle',
  peerId: null,
  callerInfo: null,
  isVideo: false,
  isCaller: false,
  isMinimized: false,
  conversationId: null,

  setIncomingCall: (peerId, callerInfo, isVideo, conversationId) => set({
    callState: 'ringing',
    peerId,
    callerInfo,
    isVideo,
    isCaller: false,
    isMinimized: false,
    conversationId,
  }),
  
  setOutgoingCall: (peerId, callerInfo, isVideo, conversationId) => set({
    callState: 'calling',
    peerId,
    callerInfo,
    isVideo,
    isCaller: true,
    isMinimized: false,
    conversationId,
  }),

  acceptCall: () => set({ callState: 'active' }),

  endCall: () => set({
    callState: 'idle',
    peerId: null,
    callerInfo: null,
    isVideo: false,
    isCaller: false,
    isMinimized: false,
    conversationId: null,
  }),

  setMinimized: (minimized) => set({ isMinimized: minimized }),
}));

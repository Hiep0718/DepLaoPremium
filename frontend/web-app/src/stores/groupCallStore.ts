import { create } from 'zustand';

interface GroupCallState {
  callState: 'idle' | 'ringing' | 'in-call';
  conversationId: string | null;
  isVideo: boolean;
  isMinimized: boolean;
  callerId: string | null; // ID người tạo cuộc gọi (để render UI người đó đang chờ)
  
  // Trạng thái thành viên trong phòng (có thể cập nhật mảng chứa những ai đã join)
  activeParticipantIds: string[]; 

  setIncomingCall: (conversationId: string, callerId: string, isVideo: boolean) => void;
  setOutgoingCall: (conversationId: string, callerId: string, isVideo: boolean) => void;
  acceptCall: () => void;
  endCall: () => void;
  setMinimized: (min: boolean) => void;
  addParticipant: (userId: string) => void;
  removeParticipant: (userId: string) => void;
  setParticipants: (userIds: string[]) => void;
}

export const useGroupCallStore = create<GroupCallState>((set) => ({
  callState: 'idle',
  conversationId: null,
  isVideo: false,
  isMinimized: false,
  callerId: null,
  activeParticipantIds: [],

  setIncomingCall: (conversationId, callerId, isVideo) => 
    set({ callState: 'ringing', conversationId, callerId, isVideo }),
    
  setOutgoingCall: (conversationId, callerId, isVideo) => 
    set({ callState: 'in-call', conversationId, isVideo, callerId, activeParticipantIds: [] }),
    
  acceptCall: () => 
    set({ callState: 'in-call' }),
    
  endCall: () => 
    set({ 
      callState: 'idle', 
      conversationId: null, 
      isVideo: false, 
      isMinimized: false, 
      callerId: null,
      activeParticipantIds: [] 
    }),
    
  setMinimized: (min) => 
    set({ isMinimized: min }),

  addParticipant: (userId) => 
    set((state) => ({ 
      activeParticipantIds: state.activeParticipantIds.includes(userId) 
        ? state.activeParticipantIds 
        : [...state.activeParticipantIds, userId] 
    })),

  removeParticipant: (userId) => 
    set((state) => ({
      activeParticipantIds: state.activeParticipantIds.filter(id => id !== userId)
    })),

  setParticipants: (userIds) =>
    set({ activeParticipantIds: userIds })
}));

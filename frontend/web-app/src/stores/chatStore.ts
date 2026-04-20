import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { markConversationAsRead, deleteConversationHistory } from '../services/message.service';

export interface Message {
  id: string;
  _id?: string;
  conversationId: string;
  senderId: string;
  text?: string;
  content?: string;
  messageType?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyTo?: {
    messageId: string;
    content: string;
    senderId: string;
    messageType: string;
  };
  isRevoked?: boolean;
  timestamp?: string;
  createdAt?: string;
  _uploading?: boolean;
  _uploadFailed?: boolean;
  reactions?: any[];
}

export interface Conversation {
  conversationId: string;
  _id?: string;
  participants: any[];
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  requireApproval?: boolean;
  pendingMembers?: any[];
  lastMessage?: string | any;
  unreadCount?: number;
  leftAt?: string;
}

export interface ContactInfo {
  name: string;
  avatarUrl?: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  activeContactInfo: ContactInfo | null;
  messages: Message[];
  isInfoPanelOpen: boolean;
  replyingMessage: Message | null;
  forwardingMessage: Message | null;
  isForwardModalOpen: boolean;
  markAsRead: (conversationId: string) => void;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (conversation: Conversation | null) => void;
  setActiveContactInfo: (info: ContactInfo) => void;
  updateActiveConversation: (updates: Partial<Conversation>) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  setReplyingMessage: (message: Message | null) => void;
  setForwardingMessage: (message: Message | null) => void;
  setForwardModalOpen: (isOpen: boolean) => void;
  toggleInfoPanel: () => void;
  clearChat: () => void;
  deleteActiveConversationHistory: (userId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversation: null,
  activeContactInfo: null,
  messages: [],
  isInfoPanelOpen: false,
  replyingMessage: null,
  forwardingMessage: null,
  isForwardModalOpen: false,
  markAsRead: async (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map(c =>
        c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c
      )
    }));
    try {
      const user = useAuthStore.getState().user;
      if (user?.id) {
        await markConversationAsRead(conversationId, user.id.toString());
      }
    } catch (e) {
      console.error('Failed to mark conversation as read:', e);
    }
  },
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (activeConversation) => set({ activeConversation }),
  updateActiveConversation: (updates) => set((state) => ({
    activeConversation: state.activeConversation 
      ? { ...state.activeConversation, ...updates } 
      : null,
    conversations: state.conversations.map(c => 
      c.conversationId === state.activeConversation?.conversationId 
        ? { ...c, ...updates }
        : c
    )
  })),
  setActiveContactInfo: (activeContactInfo) => set({ activeContactInfo }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (messageId, updates) => set((state) => ({
    messages: state.messages.map(msg =>
      (msg.id === messageId || msg._id === messageId) ? { ...msg, ...updates } : msg
    )
  })),
  setReplyingMessage: (replyingMessage) => set({ replyingMessage }),
  setForwardingMessage: (forwardingMessage) => set({ forwardingMessage, isForwardModalOpen: !!forwardingMessage }),
  setForwardModalOpen: (isForwardModalOpen) => set({ isForwardModalOpen }),
  toggleInfoPanel: () => set((state) => ({ isInfoPanelOpen: !state.isInfoPanelOpen })),
  clearChat: () => set({
    conversations: [],
    activeConversation: null,
    activeContactInfo: null,
    messages: [],
    replyingMessage: null,
    forwardingMessage: null,
    isForwardModalOpen: false
  }),
  deleteActiveConversationHistory: async (userId: string) => {
    const state = useChatStore.getState();
    const convId = state.activeConversation?.conversationId;
    if (!convId) return;
    try {
      await deleteConversationHistory(convId, userId);
      set((s) => ({
        conversations: s.conversations.filter(c => c.conversationId !== convId),
        activeConversation: null,
        activeContactInfo: null,
        messages: [],
        isInfoPanelOpen: false
      }));
    } catch (e) {
      console.error('Failed to delete conversation history:', e);
      throw e;
    }
  }
}));

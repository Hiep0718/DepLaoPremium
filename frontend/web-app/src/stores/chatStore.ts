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

  isAiBot?: boolean;

  groupName?: string;
  groupAvatar?: string;
  requireApproval?: boolean;
  pendingMembers?: any[];
  groupSettings?: {
    sendMessages?: string;
    pinAndPolls?: string;
    changeInfo?: string;
  };

  lastMessage?: string | any;
  unreadCount?: number;
  leftAt?: string;
  isPinned?: boolean;
  wallpaper?: string | null;
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
  isSearchPanelOpen: boolean;
  replyingMessage: Message | null;
  forwardingMessage: Message | null;
  isForwardModalOpen: boolean;
  // AI streaming state
  isAiStreaming: boolean;
  aiStreamingText: string;
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
  toggleSearchPanel: () => void;
  clearChat: () => void;
  deleteActiveConversationHistory: (userId: string) => Promise<void>;
  pinnedMessage: any | null;
  setPinnedMessage: (msg: any | null) => void;
  // AI streaming actions
  setAiStreaming: (val: boolean) => void;
  appendAiToken: (token: string) => void;
  finishAiStream: (userId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  activeContactInfo: null,
  messages: [],
  isInfoPanelOpen: false,
  isSearchPanelOpen: false,
  replyingMessage: null,
  forwardingMessage: null,
  isForwardModalOpen: false,
  isAiStreaming: false,
  aiStreamingText: '',
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
  setActiveConversation: (activeConversation) => set({ activeConversation, pinnedMessage: null }),
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
  toggleInfoPanel: () => set((state) => ({ isInfoPanelOpen: !state.isInfoPanelOpen, isSearchPanelOpen: false })),
  toggleSearchPanel: () => set((state) => ({ isSearchPanelOpen: !state.isSearchPanelOpen, isInfoPanelOpen: false })),
  clearChat: () => set({
    conversations: [],
    activeConversation: null,
    activeContactInfo: null,
    messages: [],
    replyingMessage: null,
    forwardingMessage: null,
    isForwardModalOpen: false,
    pinnedMessage: null
  }),
  pinnedMessage: null,
  setPinnedMessage: (pinnedMessage) => set({ pinnedMessage }),
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
  },
  // AI streaming
  setAiStreaming: (val) => set({ isAiStreaming: val, aiStreamingText: val ? '' : '' }),
  appendAiToken: (token) => set((s) => ({ aiStreamingText: s.aiStreamingText + token })),
  finishAiStream: (userId) => {
    const finalText = get().aiStreamingText.trim();
    if (finalText) {
      const aiMsg: Message = {
        id: `ai_${Date.now()}`,
        conversationId: `ai_food_bot_${userId}`,
        senderId: 'ai_food_bot',
        content: finalText,
        text: finalText,
        messageType: 'text',
        createdAt: new Date().toISOString(),
      };
      set((s) => ({
        messages: [...s.messages, aiMsg],
        isAiStreaming: false,
        aiStreamingText: '',
      }));
    } else {
      set({ isAiStreaming: false, aiStreamingText: '' });
    }
  },
}));

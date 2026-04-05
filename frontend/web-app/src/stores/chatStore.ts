import { create } from 'zustand';

export interface Message {
  id: string;
  _id?: string;
  conversationId: string;
  senderId: string;
  text?: string;
  content?: string;
  messageType?: string;
  fileUrl?: string;
  replyTo?: {
    messageId: string;
    content: string;
    senderId: string;
    messageType: string;
  };
  isRevoked?: boolean;
  timestamp?: string;
  createdAt?: string;
}

export interface Conversation {
  conversationId: string;
  _id?: string;
  participants: any[];
  isGroup: boolean;
  lastMessage?: string | any;
  unreadCount?: number;
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
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (conversation: Conversation) => void;
  setActiveContactInfo: (info: ContactInfo) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  setReplyingMessage: (message: Message | null) => void;
  setForwardingMessage: (message: Message | null) => void;
  setForwardModalOpen: (isOpen: boolean) => void;
  toggleInfoPanel: () => void;
  clearChat: () => void;
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
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (activeConversation) => set({ activeConversation }),
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
}));

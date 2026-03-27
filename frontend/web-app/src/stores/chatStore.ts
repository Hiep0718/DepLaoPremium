import { create } from 'zustand';

export interface Message {
  id: string;
  _id?: string;
  conversationId: string;
  senderId: string;
  text?: string;
  content?: string;
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
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (conversation: Conversation) => void;
  setActiveContactInfo: (info: ContactInfo) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  toggleInfoPanel: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversation: null,
  activeContactInfo: null,
  messages: [],
  isInfoPanelOpen: false,
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (activeConversation) => set({ activeConversation }),
  setActiveContactInfo: (activeContactInfo) => set({ activeContactInfo }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  toggleInfoPanel: () => set((state) => ({ isInfoPanelOpen: !state.isInfoPanelOpen })),
}));

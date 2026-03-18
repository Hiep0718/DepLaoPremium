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
  lastMessage?: string;
  unreadCount?: number;
}

interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (conversation: Conversation) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (activeConversation) => set({ activeConversation }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
}));

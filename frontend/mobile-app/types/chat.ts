export type MessageStatus = 'pending' | 'sent' | 'received' | 'seen';

export interface Message {
  _id: string;
  senderId: string;
  recipientId: string;
  content: string;
  imageUrl?: string;
  messageType?: string; // text | sticker | image | file | ...
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isRevoked?: boolean;
  createdAt?: string;
  timestamp?: string;
  conversationId?: string;
  tempId?: string; // Add tempId to keep keys stable for FlatList
  status: MessageStatus;
  replyTo?: {
    messageId: string;
    content: string;
    senderId: string;
    messageType: string;
  };
  seenBy?: {
    userId: string;
    timestamp?: string;
  }[];
  reactions?: {
    userId: string;
    type: string;
  }[];
}

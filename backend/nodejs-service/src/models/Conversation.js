import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    participants: [
      {
        userId: String,
        role: {
          type: String,
          enum: ['leader', 'deputy', 'member'],
          default: 'member',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
      default: null,
    },
    lastMessage: {
      content: String,
      senderId: String,
      messageType: String,
      timestamp: Date,
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    deletedAt: {
      type: Map,
      of: Date,
      default: new Map(),
    },
    leftMembers: {
      type: Map,
      of: Date,
      default: new Map(),
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Conversation', conversationSchema);

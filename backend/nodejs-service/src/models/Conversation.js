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
    groupAvatar: {
      type: String,
      default: null,
    },
    requireApproval: {
      type: Boolean,
      default: false,
    },
    groupSettings: {
      sendMessages: { type: String, enum: ['all', 'admin_only'], default: 'all' },
      pinAndPolls: { type: String, enum: ['all', 'admin_only'], default: 'all' },
      changeInfo: { type: String, enum: ['all', 'admin_only'], default: 'all' },
    },
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    pendingMembers: [
      {
        userId: String,
        addedBy: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      }
    ],
    lastMessage: {
      content: String,
      senderId: String,
      messageType: String,
      timestamp: Date,
      messageType: String,
    },
    pinnedMessage: {
      messageId: String,
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
    wallpapers: {
      type: Map,
      of: String,
      default: new Map(),
    },
    pinnedUsers: {
      type: Map,
      of: Boolean,
      default: new Map(),
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Conversation', conversationSchema);

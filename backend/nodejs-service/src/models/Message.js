import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    receiverId: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'video', 'file', 'sticker'],
      default: 'text',
    },
    fileUrl: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['sent', 'received', 'seen'],
      default: 'sent',
    },
    reaction: {
      type: String,
      default: null,
      enum: [null, 'like', 'love', 'haha', 'wow', 'sad', 'angry'],
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    replyTo: {
      messageId: String,
      content: String,
      senderId: String,
      messageType: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
messageSchema.index({ conversationId: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);

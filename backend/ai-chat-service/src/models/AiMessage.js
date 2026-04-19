import mongoose from 'mongoose';

/**
 * AiMessage — lưu từng message trong cuộc trò chuyện với AI
 * role: 'user' | 'assistant'
 */
const aiMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index để query nhanh theo userId + thứ tự thời gian
aiMessageSchema.index({ userId: 1, createdAt: 1 });

export default mongoose.model('AiMessage', aiMessageSchema);

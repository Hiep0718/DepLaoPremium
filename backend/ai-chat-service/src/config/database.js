import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/ai_chat_db';
    await mongoose.connect(uri);
    console.log('[AI-Chat] MongoDB connected:', uri);
  } catch (error) {
    console.error('[AI-Chat] MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export default connectDB;

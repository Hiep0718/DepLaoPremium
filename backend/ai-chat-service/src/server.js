import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import connectDB from './config/database.js';
import aiChatRoutes from './routes/aiChat.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// CORS
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
}));

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'ai-chat-service',
    message: 'AI Chat service is running 🍜 (Powered by Google Gemini)',
    model: 'gemini-2.5-flash',
    timestamp: new Date().toISOString(),
  });
});

// AI Chat Routes
app.use('/api/ai-chat', aiChatRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('[AI-Chat] Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start
const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🍜 AI Chat Service running on port ${PORT}`);
      console.log(`   Provider: Google Gemini`);
      console.log(`   Model:    gemini-1.5-flash`);
      console.log(`   Env:      ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start AI Chat Service:', error);
    process.exit(1);
  }
};

start();

export default app;

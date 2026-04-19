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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'ai-chat-service',
    message: 'AI Chat service is running 🍜',
    model: process.env.OLLAMA_MODEL || 'qwen2:1.5b',
    ollama: process.env.OLLAMA_URL || 'http://localhost:11434',
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

import { spawn } from 'child_process';

const startOllama = () => {
  const model = process.env.OLLAMA_MODEL || 'qwen2:1.5b';
  console.log(`[AI-Chat] Tự động khởi động Ollama model: ${model}...`);
  
  const ollamaProcess = spawn('ollama', ['run', model], {
    shell: true,
    stdio: 'ignore', // Chạy ngầm, không in log của ollama ra console node
    detached: true   // Tách riêng process
  });

  ollamaProcess.on('error', (err) => {
    console.error(`[AI-Chat] Không thể tự động chạy Ollama:`, err.message);
    console.log(`[AI-Chat] Vui lòng tự chạy lệnh: ollama run ${model}`);
  });

  if (ollamaProcess.unref) {
    ollamaProcess.unref(); // Không block nodejs khi exit
  }
};

// Start
const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🍜 AI Chat Service running on port ${PORT}`);
      console.log(`   Ollama: ${process.env.OLLAMA_URL || 'http://127.0.0.1:11434'}`);
      console.log(`   Model:  ${process.env.OLLAMA_MODEL || 'qwen2:1.5b'}`);
      console.log(`   Env:    ${process.env.NODE_ENV}`);
      
      // Tự động gọi Ollama khi server boot
      startOllama();
    });
  } catch (error) {
    console.error('Failed to start AI Chat Service:', error);
    process.exit(1);
  }
};

start();

export default app;

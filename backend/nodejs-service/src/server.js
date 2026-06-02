import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import connectDB from './config/database.js';
import messageRoutes from './routes/messages.js';
import adminRoutes from './routes/adminRoutes.js';
import postRoutes from './routes/posts.js';
import storyRoutes from './routes/stories.js';
import notificationRoutes from './routes/notifications.js';
import errorHandler from './middleware/errorHandler.js';
import setupSocketEvents from './socket/socketHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server with Socket.io
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Pass io instance to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Messaging service is running',
    timestamp: new Date().toISOString(),
    websocket: true,
  });
});

// API Routes
app.use('/api/messages', messageRoutes);
app.use('/api/messages/admin', adminRoutes);
app.use('/api/messages/notifications', notificationRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/stories', storyRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error Handler
app.use(errorHandler);

// Setup Socket.io event handlers
setupSocketEvents(io);

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();
    httpServer.listen(PORT, () => {
      console.log(`Messaging service started on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`WebSocket ready for connections`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;

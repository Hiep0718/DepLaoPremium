import express from 'express';
import { getMessages, streamChat, clearHistory, getLastMessage } from '../controllers/aiChatController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply JWT auth to all routes
router.use(authMiddleware);

// GET lịch sử chat
router.get('/messages/:userId', getMessages);

// GET last message (cho conversation list)
router.get('/last-message/:userId', getLastMessage);

// POST gửi message + stream response
router.post('/chat', streamChat);

// DELETE xóa lịch sử
router.delete('/history/:userId', clearHistory);

export default router;

import express from 'express';
import {
  sendMessage,
  getMessages,
  getConversations,
  createConversation,
  updateMessageStatus,
  searchMessages,
  markConversationAsRead,
} from '../controllers/messageController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Message endpoints
router.post('/send', sendMessage);
router.get('/conversation/:conversationId', getMessages);
router.get('/search/:conversationId', searchMessages);
router.put('/status/:messageId', updateMessageStatus);

// Conversation endpoints
router.post('/conversation', createConversation);
router.get('/conversations/:userId', getConversations);
router.put('/conversations/:conversationId/read', markConversationAsRead);

export default router;

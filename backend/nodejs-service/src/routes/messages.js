import express from 'express';
import {
  sendMessage,
  getMessages,
  getConversations,
  createConversation,
  updateMessageStatus,
  searchMessages,
} from '../controllers/messageController.js';

const router = express.Router();

// Message endpoints
router.post('/send', sendMessage);
router.get('/conversation/:conversationId', getMessages);
router.get('/search/:conversationId', searchMessages);
router.put('/status/:messageId', updateMessageStatus);

// Conversation endpoints
router.post('/conversation', createConversation);
router.get('/conversations/:userId', getConversations);

export default router;

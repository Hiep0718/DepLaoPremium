import express from 'express';
import {
  sendMessage,
  getMessages,
  getConversations,
  createConversation,
  updateMessageStatus,
  searchMessages,
  markConversationAsRead,
  deleteConversationHistory,
  updateMemberRole,
  removeMemberFromGroup,
  addMembersToGroup,
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
router.put('/conversations/:conversationId/role', updateMemberRole);
router.post('/conversations/:conversationId/members', addMembersToGroup);
router.delete('/conversations/:conversationId/members', removeMemberFromGroup);
router.delete('/conversations/:conversationId/history', deleteConversationHistory);

export default router;

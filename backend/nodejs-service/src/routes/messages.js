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
  disbandGroup,
  updateGroupInfo,
  toggleRequireApproval,
  approvePendingMember,
  rejectPendingMember,
  updateGroupPermissions,
  getConversationMedia,
  getInviteCode,
  resetInviteCode,
  joinGroupByInviteCode,
  updateConversationWallpaper,
  updateConversationPin,
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
router.get('/conversation/:conversationId/media', getConversationMedia);

// Conversation endpoints
router.post('/conversation', createConversation);
router.get('/conversations/:userId', getConversations);
router.put('/conversations/:conversationId/wallpaper', updateConversationWallpaper);
router.put('/conversations/:conversationId/pin', updateConversationPin);
router.put('/conversations/:conversationId/read', markConversationAsRead);
router.put('/conversations/:conversationId/role', updateMemberRole);
router.put('/conversations/:conversationId/info', updateGroupInfo);
router.post('/conversations/:conversationId/members', addMembersToGroup);
router.delete('/conversations/:conversationId/members', removeMemberFromGroup);
router.delete('/conversations/:conversationId/disband', disbandGroup);
router.delete('/conversations/:conversationId/history', deleteConversationHistory);
router.put('/conversations/:conversationId/approval-setting', toggleRequireApproval);
router.post('/conversations/:conversationId/pending/approve', approvePendingMember);
router.post('/conversations/:conversationId/pending/reject', rejectPendingMember);
router.put('/conversations/:conversationId/permissions', updateGroupPermissions);
router.get('/conversations/:conversationId/invite', getInviteCode);
router.post('/conversations/:conversationId/invite/reset', resetInviteCode);
router.post('/join/:inviteCode', joinGroupByInviteCode);

export default router;

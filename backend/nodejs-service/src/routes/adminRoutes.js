import express from 'express';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

/**
 * GET /api/messages/admin/stats
 * Returns messaging statistics from MongoDB
 */
router.get('/stats', async (req, res) => {
  try {
    const totalConversations = await Conversation.countDocuments();
    const totalGroups = await Conversation.countDocuments({ isGroup: true });
    const totalDirectChats = await Conversation.countDocuments({ isGroup: false });
    const totalMessages = await Message.countDocuments();

    // Messages per day (last 7 days)
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const messagesPerDay = await Message.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Message type distribution
    const messageTypes = await Message.aggregate([
      {
        $group: {
          _id: '$messageType',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        totalConversations,
        totalGroups,
        totalDirectChats,
        totalMessages,
        messagesPerDay: messagesPerDay.map((d) => ({
          date: d._id,
          count: d.count,
        })),
        messageTypes: messageTypes.map((t) => ({
          type: t._id,
          count: t.count,
        })),
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy thống kê: ' + error.message,
    });
  }
});

export default router;

import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';

export const sendMessage = async (req, res) => {
  try {
    const { conversationId, senderId, receiverId, content, messageType = 'text', fileUrl = null } = req.body;

    if (!conversationId || !senderId || !receiverId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const message = new Message({
      conversationId,
      senderId,
      receiverId,
      content,
      messageType,
      fileUrl,
      status: 'sent',
    });

    await message.save();

    // Update conversation last message and unread count
    const conversation = await Conversation.findOne({ conversationId });
    
    if (conversation) {
      conversation.lastMessage = {
        content,
        senderId,
        timestamp: new Date(),
      };
      
      // Task 1: Increment unreadCount for all participants EXCEPT the sender
      if (conversation.participants) {
        conversation.participants.forEach(p => {
          if (p.userId !== senderId) {
            const currentCount = conversation.unreadCount.get(p.userId) || 0;
            conversation.unreadCount.set(p.userId, currentCount + 1);
          }
        });
      }
      
      await conversation.save();
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message,
    });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50, userId } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let query = { conversationId };

    if (userId) {
      const conversation = await Conversation.findOne({ conversationId });
      if (conversation && conversation.deletedAt && conversation.deletedAt.get(userId)) {
        query.createdAt = { $gt: conversation.deletedAt.get(userId) };
      }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments(query);

    res.status(200).json({
      success: true,
      data: messages.reverse(), // Return in chronological order
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message,
    });
  }
};

export const getConversations = async (req, res) => {
  try {
    const { userId } = req.params;

    const conversations = await Conversation.find({
      'participants.userId': userId,
    }).sort({ 'lastMessage.timestamp': -1 });

    // Task 2: Format unreadCount as a number for the fetching user
    const formattedConversations = conversations.map(c => {
      const convObj = c.toObject();
      let count = 0;
      if (c.unreadCount && c.unreadCount.get) {
        count = c.unreadCount.get(userId) || 0;
      } else if (convObj.unreadCount && convObj.unreadCount[userId]) {
        count = convObj.unreadCount[userId] || 0;
      }
      convObj.unreadCount = count;
      return convObj;
    }).filter(c => {
      // Exclude conversations if they were deleted by the user AFTER the last message
      if (c.deletedAt && c.deletedAt[userId]) {
        const deletedTime = new Date(c.deletedAt[userId]).getTime();
        const lastMsgTime = c.lastMessage && c.lastMessage.timestamp ? new Date(c.lastMessage.timestamp).getTime() : 0;
        if (lastMsgTime <= deletedTime) {
          return false;
        }
      }
      return true;
    });

    res.status(200).json({
      success: true,
      data: formattedConversations,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message,
    });
  }
};

export const createConversation = async (req, res) => {
  try {
    const { conversationId, participants, isGroup = false, groupName = null, creatorId = null } = req.body;

    if (!conversationId || !participants || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const existingConversation = await Conversation.findOne({ conversationId });

    if (existingConversation) {
      return res.status(200).json({
        success: true,
        message: 'Conversation already exists',
        data: existingConversation,
      });
    }

    // Gán role cho từng participant
    const creator = creatorId || participants[0];
    const participantDocs = participants.map((userId) => ({
      userId,
      role: isGroup ? (userId === creator ? 'leader' : 'member') : 'member',
    }));

    const conversation = new Conversation({
      conversationId,
      participants: participantDocs,
      isGroup,
      groupName: isGroup ? groupName : null,
    });

    await conversation.save();

    res.status(201).json({
      success: true,
      message: 'Conversation created successfully',
      data: conversation,
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conversation',
      error: error.message,
    });
  }
};

export const updateMessageStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;

    if (!['sent', 'received', 'seen'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const message = await Message.findByIdAndUpdate(messageId, { status }, { new: true });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message status updated',
      data: message,
    });
  } catch (error) {
    console.error('Update message status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update message status',
      error: error.message,
    });
  }
};

export const searchMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const messages = await Message.find({
      conversationId,
      content: { $regex: query, $options: 'i' },
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search messages',
      error: error.message,
    });
  }
};

// Task 3: API markAsRead
export const markConversationAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    if (!conversationId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing conversationId or userId',
      });
    }

    const conversation = await Conversation.findOne({ conversationId });
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Set unreadCount cho user đo về 0
    conversation.unreadCount.set(userId, 0);
    await conversation.save();

    res.status(200).json({
      success: true,
      message: 'Conversation marked as read',
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark conversation as read',
      error: error.message,
    });
  }
};

export const deleteConversationHistory = async (req, res) => {
  try {
    const { conversationId: convId } = req.params;
    const { userId } = req.body;

    if (!convId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing conversationId or userId',
      });
    }

    const conversation = await Conversation.findOne({ conversationId: convId });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Set deletedAt cho user đo = hiện tại
    if (!conversation.deletedAt) {
      conversation.deletedAt = new Map();
    }
    conversation.deletedAt.set(userId, new Date());
    await conversation.save();

    res.status(200).json({
      success: true,
      message: 'Conversation history deleted for user',
    });
  } catch (error) {
    console.error('Delete history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation history',
      error: error.message,
    });
  }
};

// API cập nhật role thành viên nhóm
export const updateMemberRole = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { requesterId, targetUserId, newRole } = req.body;

    if (!conversationId || !requesterId || !targetUserId || !newRole) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: requesterId, targetUserId, newRole',
      });
    }

    if (!['leader', 'deputy', 'member'].includes(newRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be: leader, deputy, or member',
      });
    }

    const conversation = await Conversation.findOne({ conversationId });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    if (!conversation.isGroup) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change roles in a non-group conversation',
      });
    }

    // Tìm requester trong nhóm
    const requester = conversation.participants.find(p => p.userId === requesterId);
    if (!requester || requester.role !== 'leader') {
      return res.status(403).json({
        success: false,
        message: 'Only the group leader can change member roles',
      });
    }

    // Tìm target trong nhóm
    const target = conversation.participants.find(p => p.userId === targetUserId);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found in this group',
      });
    }

    // Nếu trao quyền leader → requester tự thành member
    if (newRole === 'leader') {
      requester.role = 'member';
      target.role = 'leader';
    } else {
      // Set deputy hoặc member
      target.role = newRole;
    }

    await conversation.save();

    res.status(200).json({
      success: true,
      message: `Role updated: ${targetUserId} is now ${newRole}`,
      data: conversation,
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update member role',
      error: error.message,
    });
  }
};

// API xóa thành viên khỏi nhóm
export const removeMemberFromGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { requesterId, targetUserId } = req.body;

    if (!conversationId || !requesterId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: requesterId, targetUserId',
      });
    }

    const conversation = await Conversation.findOne({ conversationId });

    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group conversation not found',
      });
    }

    // Tìm requester
    const requester = conversation.participants.find(p => p.userId === requesterId);
    if (!requester) {
       return res.status(403).json({ success: false, message: 'Requester not in group' });
    }

    // Tìm target
    const target = conversation.participants.find(p => p.userId === targetUserId);
    if (!target) {
       return res.status(404).json({ success: false, message: 'Target user not found in group' });
    }

    // Cho phép tự rời nhóm, hoặc kiểm tra quyền nếu xoá người khác
    if (requesterId === targetUserId) {
      if (requester.role === 'leader' && conversation.participants.length > 1) {
        return res.status(400).json({ success: false, message: 'Vui lòng trao quyền trưởng nhóm cho người khác trước khi rời nhóm' });
      }
    } else {
      if (requester.role === 'member') {
        return res.status(403).json({ success: false, message: 'Members cannot remove others' });
      }

      if (requester.role === 'deputy' && target.role !== 'member') {
        return res.status(403).json({ success: false, message: 'Deputies can only remove members' });
      }
    }

    // Xoá
    conversation.participants = conversation.participants.filter(p => p.userId !== targetUserId);
    await conversation.save();

    res.status(200).json({
      success: true,
      message: 'Member removed successfully',
      data: conversation,
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove member',
      error: error.message,
    });
  }
};

// API thêm thành viên mới vào nhóm
export const addMembersToGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { requesterId, targetUserIds } = req.body;

    if (!conversationId || !requesterId || !targetUserIds || !Array.isArray(targetUserIds)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: requesterId, targetUserIds (array)',
      });
    }

    const conversation = await Conversation.findOne({ conversationId });

    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group conversation not found',
      });
    }

    // Tìm requester
    const requester = conversation.participants.find(p => p.userId === requesterId);
    if (!requester) {
       return res.status(403).json({ success: false, message: 'Requester not in group' });
    }

    // Mọi thành viên đều có thể thêm người mới vào nhóm
    const currentMemberIds = new Set(conversation.participants.map(p => p.userId));
    let addedCount = 0;

    for (const userId of targetUserIds) {
      if (!currentMemberIds.has(String(userId))) {
        conversation.participants.push({
          userId: String(userId),
          role: 'member'
        });
        currentMemberIds.add(String(userId));
        addedCount++;
      }
    }

    if (addedCount > 0) {
      await conversation.save();
    }

    res.status(200).json({
      success: true,
      message: `Added ${addedCount} members successfully`,
      data: conversation,
    });
  } catch (error) {
    console.error('Add members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add members',
      error: error.message,
    });
  }
};

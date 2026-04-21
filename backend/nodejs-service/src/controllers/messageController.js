import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import crypto from 'crypto';

const generateInviteCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

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
        messageType,
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
    let pinnedMessage = null;

    if (userId) {
      const conversation = await Conversation.findOne({ conversationId });
      if (conversation) {

        if (conversation.deletedAt && conversation.deletedAt.get(userId)) {
          query.createdAt = { $gt: conversation.deletedAt.get(userId) };
        }
        pinnedMessage = conversation.pinnedMessage && conversation.pinnedMessage.messageId ? conversation.pinnedMessage : null;

        // If user deleted the chat, only show messages after deletion
        if (conversation.deletedAt && conversation.deletedAt.get(userId)) {
          query.createdAt = { ...query.createdAt, $gt: conversation.deletedAt.get(userId) };
        }
        // If user left the group, only show messages up to when they left
        if (conversation.leftMembers && conversation.leftMembers.get(userId)) {
          const leftAt = conversation.leftMembers.get(userId);
          query.createdAt = { ...(query.createdAt || {}), $lte: leftAt };
        }
      }
      query.deletedBy = { $ne: userId };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments(query);

    res.status(200).json({
      success: true,
      data: messages.reverse(), // Return in chronological order
      pinnedMessage,
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
      $or: [
        { 'participants.userId': userId },
        { [`leftMembers.${userId}`]: { $exists: true } },
      ]
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

      // Check if user has left the group
      let leftAt = null;
      if (c.leftMembers && c.leftMembers.get) {
        leftAt = c.leftMembers.get(userId) || null;
      } else if (convObj.leftMembers && convObj.leftMembers[userId]) {
        leftAt = convObj.leftMembers[userId] || null;
      }
      if (leftAt) {
        convObj.leftAt = leftAt;
        convObj.unreadCount = 0; // No unread for left members
      }

      return convObj;
    }).filter(convObj => {
      // Retrieve deletedAt for the user.
      let delTimestamp = null;
      if (convObj.deletedAt instanceof Map) {
        delTimestamp = convObj.deletedAt.get(userId);
      } else if (convObj.deletedAt && typeof convObj.deletedAt === 'object') {
        delTimestamp = convObj.deletedAt[userId];
      }

      if (delTimestamp) {
        const deletedTime = new Date(delTimestamp).getTime();
        const lastMsgTime = convObj.lastMessage && convObj.lastMessage.timestamp
          ? new Date(convObj.lastMessage.timestamp).getTime()
          : 0;

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
    const { conversationId, participants, isGroup = false, groupName = null, creatorId = null, groupAvatar = null } = req.body;

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
      groupAvatar: isGroup ? groupAvatar : null,
      inviteCode: isGroup ? generateInviteCode() : null,
    });

    await conversation.save();

    if (isGroup && req.io) {
      try {
        const sysMsg = new Message({
          conversationId,
          senderId: creator,
          receiverId: conversationId,
          messageType: 'system',
          content: 'Nhóm đã được tạo',
          status: 'sent',
        });
        await sysMsg.save();

        conversation.lastMessage = {
          content: sysMsg.content,
          senderId: creator,
          messageType: 'system',
          timestamp: new Date(),
        };

        // Increment unread count for everyone except creator
        conversation.participants.forEach(p => {
          if (p.userId !== creator) {
            conversation.unreadCount.set(p.userId, 1);
          }
        });
        await conversation.save();

        const payload = {
          messageId: sysMsg._id,
          conversationId,
          senderId: creator,
          messageType: 'system',
          content: sysMsg.content,
          timestamp: sysMsg.createdAt,
          status: 'received',
        };

        conversation.participants.forEach(p => {
          req.io.to(`user_${p.userId}`).emit('message_received', payload);
        });
      } catch (err) {
        console.error('Failed to emit system message for group creation:', err);
      }
    }

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

    // Emit system message for role change
    if (req.io) {
      try {
        let sysContent = '';
        if (newRole === 'leader') {
          sysContent = `role_leader:${requesterId}:${targetUserId}`;
        } else if (newRole === 'deputy') {
          sysContent = `role_deputy:${requesterId}:${targetUserId}`;
        } else if (newRole === 'member') {
          sysContent = `role_undeputy:${requesterId}:${targetUserId}`;
        }

        if (sysContent) {
          const sysMsg = new Message({
            conversationId,
            senderId: requesterId,
            receiverId: conversationId,
            messageType: 'system',
            content: sysContent,
            status: 'sent',
          });
          await sysMsg.save();

          conversation.lastMessage = {
            content: sysContent,
            senderId: requesterId,
            messageType: 'system',
            timestamp: new Date(),
          };

          conversation.participants.forEach(p => {
            if (p.userId !== requesterId) {
              const current = conversation.unreadCount.get(p.userId) || 0;
              conversation.unreadCount.set(p.userId, current + 1);
            }
          });
          await conversation.save();

          const payload = {
            messageId: sysMsg._id,
            conversationId,
            senderId: requesterId,
            messageType: 'system',
            content: sysContent,
            timestamp: sysMsg.createdAt,
            status: 'received',
          };

          conversation.participants.forEach(p => {
            req.io.to(`user_${p.userId}`).emit('message_received', payload);
          });
        }
      } catch (err) {
        console.error('Failed to emit role change system message:', err);
      }
    }

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
      if (requester.role === 'leader') {
        // Tự động giải tán nhóm nếu người rời là nhóm trưởng
        if (req.io) {
          try {
            const sysContent = `group_disbanded:${requesterId}`;
            const payload = {
              messageId: `disband_${conversationId}_${Date.now()}`,
              conversationId,
              senderId: requesterId,
              messageType: 'system',
              content: sysContent,
              timestamp: new Date().toISOString(),
              status: 'received',
            };

            conversation.participants.forEach(p => {
              req.io.to(`user_${p.userId}`).emit('message_received', payload);
            });
          } catch (err) {
            console.error('Failed to emit disband notification:', err);
          }
        }
        await Conversation.deleteOne({ conversationId });
        return res.status(200).json({
          success: true,
          message: 'Group disbanded successfully because the leader left',
        });
      }
    } else {
      if (requester.role === 'member') {
        return res.status(403).json({ success: false, message: 'Members cannot remove others' });
      }

      if (requester.role === 'deputy' && target.role !== 'member') {
        return res.status(403).json({ success: false, message: 'Deputies can only remove members' });
      }
    }

    // Ghi lại thời điểm rời nhóm để giữ hội thoại trong danh sách của người đó
    if (!conversation.leftMembers) {
      conversation.leftMembers = new Map();
    }
    conversation.leftMembers.set(targetUserId, new Date());

    // Xoá khỏi danh sách thành viên hiện tại
    conversation.participants = conversation.participants.filter(p => p.userId !== targetUserId);

    // Emit system message
    if (req.io) {
      try {
        const isSelfLeave = requesterId === targetUserId;
        const sysContent = isSelfLeave
          ? `member_left:${targetUserId}`
          : `member_removed:${requesterId}:${targetUserId}`;

        const sysMsg = new Message({
          conversationId,
          senderId: requesterId,
          receiverId: conversationId,
          messageType: 'system',
          content: sysContent,
          status: 'sent',
        });
        await sysMsg.save();

        conversation.lastMessage = {
          content: sysContent,
          senderId: requesterId,
          messageType: 'system',
          timestamp: new Date(),
        };

        // Increment unread for remaining participants
        conversation.participants.forEach(p => {
          if (p.userId !== requesterId) {
            const current = conversation.unreadCount.get(p.userId) || 0;
            conversation.unreadCount.set(p.userId, current + 1);
          }
        });

        const payload = {
          messageId: sysMsg._id,
          conversationId,
          senderId: requesterId,
          messageType: 'system',
          content: sysContent,
          timestamp: sysMsg.createdAt,
          status: 'received',
        };

        // Emit to remaining participants
        conversation.participants.forEach(p => {
          req.io.to(`user_${p.userId}`).emit('message_received', payload);
        });
        // Also emit to the removed/left user so they see the notification
        req.io.to(`user_${targetUserId}`).emit('message_received', payload);
      } catch (err) {
        console.error('Failed to emit system message for member removal:', err);
      }
    }

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

    // Kiểm tra cài đặt duyệt thành viên
    const isApprovalRequired = conversation.requireApproval && requester.role === 'member';

    const currentMemberIds = new Set(conversation.participants.map(p => p.userId));
    const currentPendingIds = new Set((conversation.pendingMembers || []).map(p => p.userId));
    
    let addedCount = 0;
    let pendingCount = 0;
    const addedIds = [];
    const pendingIds = [];

    for (const userId of targetUserIds) {
      if (!currentMemberIds.has(String(userId))) {
        if (isApprovalRequired) {
          if (!currentPendingIds.has(String(userId))) {
            if (!conversation.pendingMembers) conversation.pendingMembers = [];
            conversation.pendingMembers.push({
              userId: String(userId),
              addedBy: requesterId,
            });
            currentPendingIds.add(String(userId));
            pendingIds.push(String(userId));
            pendingCount++;
          }
        } else {
          conversation.participants.push({
            userId: String(userId),
            role: 'member'
          });
          currentMemberIds.add(String(userId));
          addedIds.push(String(userId));
          addedCount++;

          // Clear leftMembers entry if re-adding a former member
          if (conversation.leftMembers && conversation.leftMembers.get(String(userId))) {
            conversation.leftMembers.delete(String(userId));
          }
        }
      }
    }

    if (addedCount > 0) {
      if (req.io) {
        try {
          const sysMsg = new Message({
            conversationId,
            senderId: requesterId,
            receiverId: conversationId,
            messageType: 'system',
            content: `added_members:${addedIds.join(',')}`,
            status: 'sent',
          });
          await sysMsg.save();

          conversation.lastMessage = {
            content: sysMsg.content,
            senderId: requesterId,
            messageType: 'system',
            timestamp: new Date(),
          };

          // Increment unread limit for everyone except requester
          conversation.participants.forEach(p => {
            if (p.userId !== requesterId) {
              const current = conversation.unreadCount.get(p.userId) || 0;
              conversation.unreadCount.set(p.userId, current + 1);
            }
          });

          const payload = {
            messageId: sysMsg._id,
            conversationId,
            senderId: requesterId,
            messageType: 'system',
            content: sysMsg.content,
            timestamp: sysMsg.createdAt,
            status: 'received',
          };

          conversation.participants.forEach(p => {
            req.io.to(`user_${p.userId}`).emit('message_received', payload);
          });
        } catch (err) {
          console.error('Failed to emit system message for adding members:', err);
        }
      }
    }

    if (pendingCount > 0 && req.io) {
      // Báo cho leader/deputy biết có thành viên chờ duyệt
      conversation.participants.forEach(p => {
        if (p.role === 'leader' || p.role === 'deputy') {
          req.io.to(`user_${p.userId}`).emit('pending_members_updated', {
            conversationId,
            pendingMembers: conversation.pendingMembers
          });
        }
      });
    }

    await conversation.save();

    res.status(200).json({
      success: true,
      message: isApprovalRequired 
        ? `Added ${pendingCount} members to pending list` 
        : `Added ${addedCount} members successfully`,
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

// API Giải tán nhóm
export const disbandGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { requesterId } = req.body;

    if (!conversationId || !requesterId) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Group conversation not found' });
    }

    const requester = conversation.participants.find(p => p.userId === requesterId);
    if (!requester || requester.role !== 'leader') {
      return res.status(403).json({ success: false, message: 'Only leader can disband group' });
    }

    // Emit system message to all participants BEFORE deleting
    if (req.io) {
      try {
        const sysContent = `group_disbanded:${requesterId}`;
        const payload = {
          messageId: `disband_${conversationId}_${Date.now()}`,
          conversationId,
          senderId: requesterId,
          messageType: 'system',
          content: sysContent,
          timestamp: new Date().toISOString(),
          status: 'received',
        };

        conversation.participants.forEach(p => {
          req.io.to(`user_${p.userId}`).emit('message_received', payload);
        });
      } catch (err) {
        console.error('Failed to emit disband notification:', err);
      }
    }

    // Xoá toàn bộ conversation
    await Conversation.deleteOne({ conversationId });

    res.status(200).json({
      success: true,
      message: 'Group disbanded successfully',
    });
  } catch (error) {
    console.error('Disband group error:', error);
    res.status(500).json({ success: false, message: 'Failed to disband group' });
  }
};
// API thay đổi thông tin nhóm (tên, avatar)
export const updateGroupInfo = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { requesterId, groupName, groupAvatar } = req.body;

    if (!conversationId || !requesterId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: requesterId',
      });
    }

    const conversation = await Conversation.findOne({ conversationId });

    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group conversation not found',
      });
    }

    // Checking if requester is in the group
    const requester = conversation.participants.find(p => p.userId === requesterId);
    if (!requester) {
      return res.status(403).json({ success: false, message: 'Requester not in group' });
    }

    // Role check for changeInfo
    if (conversation.groupSettings?.changeInfo === 'admin_only') {
      if (requester.role !== 'leader' && requester.role !== 'deputy') {
        return res.status(403).json({ success: false, message: 'Only leader or deputy can change group info' });
      }
    }

    const updates = [];
    if (groupName !== undefined && groupName !== conversation.groupName) {
      conversation.groupName = groupName;
      updates.push(`tên nhóm|${groupName}`);
    }
    
    if (groupAvatar !== undefined && groupAvatar !== conversation.groupAvatar) {
      conversation.groupAvatar = groupAvatar;
      updates.push('ảnh nhóm');
    }

    if (updates.length > 0) {
      await conversation.save();

      // Emit system message
      if (req.io) {
        try {
          const sysContent = `group_updated:${requesterId}:${updates.join(',')}`;

          const sysMsg = new Message({
            conversationId,
            senderId: requesterId,
            receiverId: conversationId,
            messageType: 'system',
            content: sysContent,
            status: 'sent',
          });
          await sysMsg.save();

          conversation.lastMessage = {
            content: sysContent,
            senderId: requesterId,
            messageType: 'system',
            timestamp: new Date(),
          };

          // Increment unread count for others
          conversation.participants.forEach(p => {
             if (p.userId !== requesterId) {
               const current = conversation.unreadCount.get(p.userId) || 0;
               conversation.unreadCount.set(p.userId, current + 1);
             }
          });
          await conversation.save();

          const payload = {
            messageId: sysMsg._id,
            conversationId,
            senderId: requesterId,
            messageType: 'system',
            content: sysContent,
            timestamp: sysMsg.createdAt,
            status: 'received',
          };

          conversation.participants.forEach(p => {
            req.io.to(`user_${p.userId}`).emit('message_received', payload);
            req.io.to(`user_${p.userId}`).emit('group_updated', {
              conversationId,
              groupName: conversation.groupName,
              groupAvatar: conversation.groupAvatar
            });
          });
        } catch (err) {
          console.error('Failed to emit system message for group update:', err);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Group info updated successfully',
      data: conversation,
    });
  } catch (error) {
    console.error('Update group info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update group info',
      error: error.message,
    });
  }
};

// API Bật/Tắt chế độ duyệt thành viên
export const toggleRequireApproval = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { requesterId, requireApproval } = req.body;

    if (!conversationId || !requesterId || requireApproval === undefined) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const requester = conversation.participants.find(p => p.userId === requesterId);
    if (!requester || (requester.role !== 'leader' && requester.role !== 'deputy')) {
      return res.status(403).json({ success: false, message: 'Only leader or deputy can change this setting' });
    }

    conversation.requireApproval = requireApproval;

    await conversation.save();

    if (req.io) {
      conversation.participants.forEach(p => {
        req.io.to(`user_${p.userId}`).emit('group_settings_updated', {
          conversationId,
          settings: { requireApproval }
        });
      });
    }

    res.status(200).json({ success: true, message: 'Approval setting updated', data: conversation });
  } catch (error) {
    console.error('Toggle require approval error:', error);
    res.status(500).json({ success: false, message: 'Failed to update setting', error: error.message });
  }
};

// API Duyệt thành viên đang chờ
export const approvePendingMember = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { requesterId, targetUserIds } = req.body;

    if (!conversationId || !requesterId || !targetUserIds || !Array.isArray(targetUserIds)) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const requester = conversation.participants.find(p => p.userId === requesterId);
    if (!requester || (requester.role !== 'leader' && requester.role !== 'deputy')) {
      return res.status(403).json({ success: false, message: 'Only leader or deputy can approve members' });
    }

    const approvedIds = [];
    const currentMemberIds = new Set(conversation.participants.map(p => p.userId));

    // Lọc ra những người có trong pendingMembers và chưa có trong participants
    const pendingToApprove = (conversation.pendingMembers || []).filter(pm => targetUserIds.includes(pm.userId));

    for (const pm of pendingToApprove) {
      if (!currentMemberIds.has(String(pm.userId))) {
        conversation.participants.push({
          userId: String(pm.userId),
          role: 'member'
        });
        approvedIds.push(String(pm.userId));

        // Clear leftMembers entry
        if (conversation.leftMembers && conversation.leftMembers.get(String(pm.userId))) {
          conversation.leftMembers.delete(String(pm.userId));
        }
      }
    }

    // Xóa khỏi danh sách chờ
    conversation.pendingMembers = conversation.pendingMembers.filter(pm => !targetUserIds.includes(pm.userId));

    if (approvedIds.length > 0 && req.io) {
      try {
        const sysMsg = new Message({
          conversationId,
          senderId: requesterId,
          receiverId: conversationId,
          messageType: 'system',
          content: `added_members:${approvedIds.join(',')}`,
          status: 'sent',
        });
        await sysMsg.save();

        conversation.lastMessage = {
          content: sysMsg.content,
          senderId: requesterId,
          messageType: 'system',
          timestamp: new Date(),
        };

        // Emit message
        const payload = {
          messageId: sysMsg._id,
          conversationId,
          senderId: requesterId,
          messageType: 'system',
          content: sysMsg.content,
          timestamp: sysMsg.createdAt,
          status: 'received',
        };

        conversation.participants.forEach(p => {
          if (p.userId !== requesterId) {
            const current = conversation.unreadCount.get(p.userId) || 0;
            conversation.unreadCount.set(p.userId, current + 1);
          }
          req.io.to(`user_${p.userId}`).emit('message_received', payload);
        });

      } catch (err) {
        console.error('Failed to emit system message for approved members:', err);
      }
    }

    await conversation.save();

    // Thông báo cho admin khác là danh sách pending đã cập nhật
    if (req.io) {
      conversation.participants.forEach(p => {
        if (p.role === 'leader' || p.role === 'deputy') {
          req.io.to(`user_${p.userId}`).emit('pending_members_updated', {
            conversationId,
            pendingMembers: conversation.pendingMembers
          });
        }
      });
    }

    res.status(200).json({ success: true, message: `Approved ${approvedIds.length} members`, data: conversation });
  } catch (error) {
    console.error('Approve member error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve member', error: error.message });
  }
};

// API cập nhật cài đặt phân quyền nhóm (Group Permissions)
export const updateGroupPermissions = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { requesterId, settings } = req.body;

    if (!conversationId || !requesterId || !settings) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const requester = conversation.participants.find(p => p.userId === requesterId);
    if (!requester || (requester.role !== 'leader' && requester.role !== 'deputy')) {
      return res.status(403).json({ success: false, message: 'Only leader or deputy can change group permissions' });
    }

    if (!conversation.groupSettings) {
      conversation.groupSettings = { sendMessages: 'all', pinAndPolls: 'all', changeInfo: 'all' };
    }

    // Cập nhật các trường được truyền lên
    if (settings.sendMessages) conversation.groupSettings.sendMessages = settings.sendMessages;
    if (settings.pinAndPolls) conversation.groupSettings.pinAndPolls = settings.pinAndPolls;
    if (settings.changeInfo) conversation.groupSettings.changeInfo = settings.changeInfo;

    await conversation.save();

    // Phát socket cho tất cả thành viên trong nhóm
    if (req.io) {
      conversation.participants.forEach(p => {
        req.io.to(`user_${p.userId}`).emit('group_settings_updated', {
          conversationId,
          settings: { groupSettings: conversation.groupSettings }
        });
      });
    }

    res.status(200).json({ success: true, message: 'Group permissions updated', data: conversation });
  } catch (error) {
    console.error('Update group permissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to update permissions', error: error.message });
  }
};

// API Từ chối thành viên đang chờ
export const rejectPendingMember = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { requesterId, targetUserIds } = req.body;

    if (!conversationId || !requesterId || !targetUserIds || !Array.isArray(targetUserIds)) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const requester = conversation.participants.find(p => p.userId === requesterId);
    if (!requester || (requester.role !== 'leader' && requester.role !== 'deputy')) {
      return res.status(403).json({ success: false, message: 'Only leader or deputy can reject members' });
    }

    // Xóa khỏi danh sách chờ
    conversation.pendingMembers = conversation.pendingMembers.filter(pm => !targetUserIds.includes(pm.userId));

    await conversation.save();

    // Thông báo cho admin khác là danh sách pending đã cập nhật
    if (req.io) {
      conversation.participants.forEach(p => {
        if (p.role === 'leader' || p.role === 'deputy') {
          req.io.to(`user_${p.userId}`).emit('pending_members_updated', {
            conversationId,
            pendingMembers: conversation.pendingMembers
          });
        }
      });
    }

    res.status(200).json({ success: true, message: 'Rejected members', data: conversation });
  } catch (error) {
    console.error('Reject member error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject member', error: error.message });
  }
};

export const getConversationMedia = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { type, senderId, startDate, endDate } = req.query;

    let query = { conversationId, isRevoked: { $ne: true } };

    if (senderId) {
      query.senderId = senderId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Filter by type
    if (type === 'media') {
      query.messageType = { $in: ['image', 'video'] };
    } else if (type === 'file') {
      query.messageType = 'file';
    } else if (type === 'audio') {
      query.messageType = 'audio';
    } else if (type === 'link') {
      query.messageType = 'text';
      query.content = { $regex: /https?:\/\/[^\s]+/i };
    }


    const limitNum = parseInt(req.query.limit) || 0;
    let queryExec = Message.find(query).sort({ createdAt: -1 });
    if (limitNum > 0) {
      queryExec = queryExec.limit(limitNum);
    }
    const messages = await queryExec;

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('Get conversation media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation media',
      error: error.message,
    });
  }
};

export const getInviteCode = async (req, res) => {
  try {
    const { conversationId } = req.params;
    let conversation = await Conversation.findOne({ conversationId });

    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (!conversation.inviteCode) {
      conversation.inviteCode = generateInviteCode();
      await conversation.save();
    }

    res.status(200).json({
      success: true,
      data: { inviteCode: conversation.inviteCode }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resetInviteCode = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { requesterId } = req.body;

    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const requester = conversation.participants.find(p => p.userId === requesterId);
    if (!requester || (requester.role !== 'leader' && requester.role !== 'deputy')) {
      return res.status(403).json({ success: false, message: 'Only admins can reset invite link' });
    }

    conversation.inviteCode = generateInviteCode();
    await conversation.save();

    res.status(200).json({
      success: true,
      message: 'Invite link reset successfully',
      data: { inviteCode: conversation.inviteCode }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const joinGroupByInviteCode = async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'UserId is required' });
    }

    const conversation = await Conversation.findOne({ inviteCode });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Invalid invite link' });
    }

    // Check if already a member
    const isMember = conversation.participants.some(p => p.userId === userId);
    if (isMember) {
      return res.status(200).json({
        success: true,
        message: 'Already a member',
        data: conversation
      });
    }

    // Handle require approval
    if (conversation.requireApproval) {
      const isPending = conversation.pendingMembers?.some(pm => pm.userId === userId);
      if (!isPending) {
        if (!conversation.pendingMembers) conversation.pendingMembers = [];
        conversation.pendingMembers.push({
          userId,
          addedBy: 'link', // Joined via link
          timestamp: new Date()
        });
        await conversation.save();
        
        // Notify admins about pending request if needed
        if (req.io) {
          const admins = conversation.participants.filter(p => p.role === 'leader' || p.role === 'deputy');
          admins.forEach(admin => {
            req.io.to(`user_${admin.userId}`).emit('pending_members_updated', {
              conversationId: conversation.conversationId,
              pendingMembers: conversation.pendingMembers
            });
          });
        }
      }
      return res.status(202).json({
        success: true,
        message: 'Approval required to join this group',
        approvalRequired: true
      });
    }

    // Join directly
    conversation.participants.push({
      userId,
      role: 'member',
      joinedAt: new Date()
    });

    // Clear leftMembers if re-joining
    if (conversation.leftMembers && conversation.leftMembers.get(userId)) {
      conversation.leftMembers.delete(userId);
    }

    await conversation.save();

    // Emit system message
    if (req.io) {
      try {
        const sysMsg = new Message({
          conversationId: conversation.conversationId,
          senderId: userId,
          receiverId: conversation.conversationId,
          messageType: 'system',
          content: `member_joined_via_link:${userId}`,
          status: 'sent',
        });
        await sysMsg.save();

        conversation.lastMessage = {
          content: sysMsg.content,
          senderId: userId,
          messageType: 'system',
          timestamp: new Date(),
        };
        await conversation.save();

        const payload = {
          messageId: sysMsg._id,
          conversationId: conversation.conversationId,
          senderId: userId,
          messageType: 'system',
          content: sysMsg.content,
          timestamp: sysMsg.createdAt,
          status: 'received',
        };

        conversation.participants.forEach(p => {
          req.io.to(`user_${p.userId}`).emit('message_received', payload);
        });
      } catch (err) {
        console.error('Failed to emit system message for link join:', err);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Joined group successfully',
      data: conversation
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

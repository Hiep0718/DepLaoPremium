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

    // Update conversation last message
    await Conversation.updateOne(
      { conversationId },
      {
        lastMessage: {
          content,
          senderId,
          timestamp: new Date(),
        },
      }
    );

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
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments({ conversationId });

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

    res.status(200).json({
      success: true,
      data: conversations,
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
    const { conversationId, participants, isGroup = false, groupName = null } = req.body;

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

    const conversation = new Conversation({
      conversationId,
      participants: participants.map((userId) => ({ userId })),
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

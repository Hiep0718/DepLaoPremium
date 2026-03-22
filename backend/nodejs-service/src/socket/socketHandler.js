import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';

// Store active users: userId -> socketId
const activeUsers = new Map();

const setupSocketEvents = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    // User joins with their userId
    socket.on('user_join', (userId) => {
      activeUsers.set(userId, socket.id);
      socket.userId = userId;
      socket.join(`user_${userId}`);
      
      // Broadcast user online status
      io.emit('user_online', {
        userId,
        status: 'online',
        timestamp: new Date(),
      });
      
      console.log(`[Socket] User ${userId} joined. Active users: ${activeUsers.size}`);
    });

    // Send message via WebSocket
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, senderId, text, recipientId } = data;

        // Save message to database (use 'content' and 'receiverId' to match Message schema)
        const message = new Message({
          conversationId,
          senderId,
          receiverId: recipientId,
          content: text,
          status: 'sent',
        });

        await message.save();

        // Update conversation lastMessage (match Conversation schema format)
        await Conversation.findOneAndUpdate(
          { conversationId },
          {
            lastMessage: {
              content: text,
              senderId,
              timestamp: new Date(),
            },
            lastMessageTime: new Date(),
          }
        );

        // Emit to both sender and recipient
        io.to(`user_${senderId}`).emit('message_sent', {
          messageId: message._id,
          conversationId,
          senderId,
          text,
          timestamp: message.createdAt,
          status: 'sent',
        });

        io.to(`user_${recipientId}`).emit('message_received', {
          messageId: message._id,
          conversationId,
          senderId,
          text,
          timestamp: message.createdAt,
          status: 'received',
        });

        console.log(`[Socket] Message sent from ${senderId} to ${recipientId}`);
      } catch (error) {
        console.error('[Socket] Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Mark message as seen
    socket.on('mark_as_seen', async (data) => {
      try {
        const { messageId, conversationId, userId } = data;

        await Message.findByIdAndUpdate(messageId, {
          status: 'seen',
          seenAt: new Date(),
        });

        // Notify sender that message was seen
        io.emit('message_seen', {
          messageId,
          conversationId,
          seenBy: userId,
          timestamp: new Date(),
        });

        console.log(`[Socket] Message ${messageId} marked as seen`);
      } catch (error) {
        console.error('[Socket] Error marking message as seen:', error);
      }
    });

    // User typing indicator
    socket.on('typing', (data) => {
      const { conversationId, userId, isTyping } = data;

      io.to(`conv_${conversationId}`).emit('user_typing', {
        conversationId,
        userId,
        isTyping,
      });
    });

    // User joins conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conv_${conversationId}`);
      console.log(`[Socket] User joined conversation: ${conversationId}`);
    });

    // User leaves conversation room
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conv_${conversationId}`);
      console.log(`[Socket] User left conversation: ${conversationId}`);
    });

    // User disconnects
    socket.on('disconnect', () => {
      if (socket.userId) {
        activeUsers.delete(socket.userId);

        // Broadcast user offline status
        io.emit('user_offline', {
          userId: socket.userId,
          status: 'offline',
          timestamp: new Date(),
        });

        console.log(`[Socket] User ${socket.userId} disconnected. Active users: ${activeUsers.size}`);
      }
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('[Socket] Error:', error);
    });
  });
};

export default setupSocketEvents;
export { activeUsers };

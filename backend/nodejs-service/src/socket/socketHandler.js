import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import crypto from 'crypto';

// Store active users: userId -> socketId
const activeUsers = new Map();

// Store QR login sessions: sessionId -> { webSocketId, status, createdAt, ... }
const qrSessions = new Map();
const QR_SESSION_TTL = 180000; // 3 minutes in ms

// Cleanup expired QR sessions every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of qrSessions) {
    if (now - session.createdAt > QR_SESSION_TTL) {
      qrSessions.delete(sessionId);
    }
  }
}, 30000);

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

    // ═══════════════════ QR LOGIN EVENTS ═══════════════════

    // Web requests a new QR login session
    socket.on('qr_login_init', () => {
      const sessionId = crypto.randomUUID();
      const qrData = JSON.stringify({
        type: 'qr_login',
        sessionId,
        timestamp: Date.now(),
        app: 'deplao',
      });

      qrSessions.set(sessionId, {
        webSocketId: socket.id,
        status: 'pending',
        createdAt: Date.now(),
      });

      socket.join(`qr_${sessionId}`);

      socket.emit('qr_login_session', { sessionId, qrData });
      console.log(`[QR Login] Session created: ${sessionId} for socket ${socket.id}`);
    });

    // Mobile scans the QR code
    socket.on('qr_login_scan', (data) => {
      const { sessionId, userId } = data;
      const session = qrSessions.get(sessionId);

      if (!session) {
        socket.emit('qr_login_error', { message: 'Session không tồn tại hoặc đã hết hạn' });
        return;
      }

      if (session.status !== 'pending') {
        socket.emit('qr_login_error', { message: 'Session đã được quét rồi' });
        return;
      }

      // Check TTL
      if (Date.now() - session.createdAt > QR_SESSION_TTL) {
        qrSessions.delete(sessionId);
        socket.emit('qr_login_error', { message: 'Mã QR đã hết hạn' });
        return;
      }

      session.status = 'scanned';
      session.scannedByUserId = userId;
      session.mobileSocketId = socket.id;

      // Notify web that QR has been scanned
      io.to(session.webSocketId).emit('qr_login_scanned', { sessionId });
      console.log(`[QR Login] Session ${sessionId} scanned by user ${userId}`);
    });

    // Mobile confirms login (sends tokens for web)
    socket.on('qr_login_confirm', (data) => {
      const { sessionId, accessToken, refreshToken, user } = data;
      const session = qrSessions.get(sessionId);

      if (!session || session.status !== 'scanned') {
        socket.emit('qr_login_error', { message: 'Session không hợp lệ' });
        return;
      }

      session.status = 'confirmed';

      // Send tokens to web client
      io.to(session.webSocketId).emit('qr_login_confirmed', {
        sessionId,
        accessToken,
        refreshToken,
        user,
      });

      console.log(`[QR Login] Session ${sessionId} confirmed. Web client will login.`);
      
      // Cleanup session
      qrSessions.delete(sessionId);
    });

    // Web cancels QR session (expired or navigated away)
    socket.on('qr_login_cancel', (data) => {
      const { sessionId } = data;
      if (qrSessions.has(sessionId)) {
        qrSessions.delete(sessionId);
        console.log(`[QR Login] Session ${sessionId} cancelled`);
      }
    });

    // ═══════════════════ END QR LOGIN ═══════════════════

    // User disconnects
    socket.on('disconnect', () => {
      // Cleanup any QR sessions owned by this web socket
      for (const [sessionId, session] of qrSessions) {
        if (session.webSocketId === socket.id) {
          qrSessions.delete(sessionId);
          console.log(`[QR Login] Session ${sessionId} cleaned up (web disconnected)`);
        }
      }

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

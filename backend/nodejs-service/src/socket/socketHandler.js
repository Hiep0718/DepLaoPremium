import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import mongoose from 'mongoose';
import crypto from 'crypto';

// Store active users: userId -> { socketId, platform }
// platform: 'web' | 'mobile'
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

    // User joins with their userId and platform
    // data can be: string (userId) for backward compat, or { userId, platform }
    socket.on('user_join', (data) => {
      let userId, platform;
      if (typeof data === 'object' && data !== null) {
        userId = String(data.userId);  // Always normalize to string
        platform = data.platform || 'mobile';
      } else {
        userId = String(data);  // Always normalize to string
        platform = 'mobile';
      }

      console.log(`[Socket] user_join received: userId=${userId}, platform=${platform}, socketId=${socket.id}`);
      console.log(`[Socket] Current activeUsers:`, JSON.stringify([...activeUsers.entries()]));

      // ═══ Single Session: Force logout previous WEB session ═══
      if (platform === 'web') {
        const existing = activeUsers.get(userId);
        console.log(`[Socket] Checking existing session for ${userId}:`, existing);
        if (existing && existing.platform === 'web' && existing.socketId !== socket.id) {
          console.log(`[Socket] ★ Force logout previous web session for user ${userId} (old socket: ${existing.socketId}, new socket: ${socket.id})`);
          io.to(existing.socketId).emit('force_logout', {
            message: 'Tài khoản của bạn đã được đăng nhập trên một trình duyệt khác.',
          });
        }
      }

      activeUsers.set(userId, { socketId: socket.id, platform });
      socket.userId = userId;
      socket.platform = platform;
      socket.join(`user_${userId}`);

      // Broadcast user online status
      io.emit('user_online', {
        userId,
        status: 'online',
        timestamp: new Date(),
      });

      console.log(`[Socket] User ${userId} joined (${platform}). Active users: ${activeUsers.size}`);
    });

    // Send message via WebSocket
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, senderId, text, recipientId, messageType, fileUrl, fileName, fileSize, replyTo, tempId } = data;

        // Save message to database (use 'content' and 'receiverId' to match Message schema)
        // Also map optional messageType and fileUrl
        const message = new Message({
          conversationId,
          senderId,
          receiverId: recipientId,
          content: text,
          messageType: messageType || 'text',
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          replyTo: replyTo || null,
          status: 'sent',
        });

        await message.save();

        // Update conversation lastMessage (match Conversation schema format)
        await Conversation.findOneAndUpdate(
          { conversationId },
          {
            lastMessage: {
              content: text, // e.g. '[Nhãn dán]' or '[Hình ảnh]' sent from client
              senderId,
              messageType: messageType || 'text',
              timestamp: new Date(),
            },
            lastMessageTime: new Date(),
          }
        );

        // Emit to both sender and recipient
        io.to(`user_${senderId}`).emit('message_sent', {
          messageId: message._id,
          tempId,
          conversationId,
          senderId,
          text,
          messageType: message.messageType,
          fileUrl: message.fileUrl,
          fileName: message.fileName,
          fileSize: message.fileSize,
          replyTo: message.replyTo,
          isRevoked: message.isRevoked,
          timestamp: message.createdAt,
          status: 'sent',
        });

        io.to(`user_${recipientId}`).emit('message_received', {
          messageId: message._id,
          conversationId,
          senderId,
          text,
          messageType: message.messageType,
          fileUrl: message.fileUrl,
          fileName: message.fileName,
          fileSize: message.fileSize,
          replyTo: message.replyTo,
          isRevoked: message.isRevoked,
          timestamp: message.createdAt,
          status: 'received',
        });

        console.log(`[Socket] Message sent from ${senderId} to ${recipientId} (type: ${message.messageType})`);
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

    // Revoke message
    socket.on('revoke_message', async (data) => {
      try {
        const { messageId, conversationId, userId } = data;

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          return;
        }

        const message = await Message.findById(messageId);
        if (!message || message.senderId !== userId) return;

        message.isRevoked = true;
        await message.save();

        io.to(`conv_${conversationId}`).emit('message_revoked', {
          messageId,
          conversationId,
        });

        // Also emit to users directly if they aren't in conv_ room
        io.to(`user_${message.senderId}`).emit('message_revoked', { messageId, conversationId });
        io.to(`user_${message.receiverId}`).emit('message_revoked', { messageId, conversationId });

        console.log(`[Socket] Message ${messageId} revoked by ${userId}`);
      } catch (error) {
        console.error('[Socket] Error revoking message:', error);
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
        // Lấy thông tin session hiện tại đang lưu
        const currentUserSession = activeUsers.get(socket.userId);

        // CHỈ XÓA khi socket ngắt kết nối chính là socket đang được lưu là active
        if (currentUserSession && currentUserSession.socketId === socket.id) {
          activeUsers.delete(socket.userId);

          // Broadcast user offline status
          io.emit('user_offline', {
            userId: socket.userId,
            status: 'offline',
            timestamp: new Date(),
          });

          console.log(`[Socket] User ${socket.userId} disconnected. Active users: ${activeUsers.size}`);
        } else {
          // Ghi log để biết là một session cũ/phụ vừa ngắt kết nối, không ảnh hưởng session chính
          console.log(`[Socket] Old/Secondary session for user ${socket.userId} disconnected (socket: ${socket.id}). Active users remains: ${activeUsers.size}`);
        }
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

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
        const { conversationId, senderId, text, recipientId, messageType, fileUrl, fileName, fileSize, replyTo, tempId, content } = data;

        const messageContent = content || text;

        // Fetch conversation to determine if it's a group and get participants
        const conversation = await Conversation.findOne({ conversationId });
        const isGroup = conversation?.isGroup;
        const actualReceiverId = isGroup ? conversationId : recipientId;

        // Save message to database
        const message = new Message({
          conversationId,
          senderId,
          receiverId: recipientId || conversationId,
          content: messageContent,
          messageType: messageType || 'text',
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          replyTo: replyTo || null,
          status: 'sent',
        });

        await message.save();

        // Update conversation lastMessage and unreadCounts
        if (conversation) {
          conversation.lastMessage = {
            content: messageContent,
            senderId,
            messageType: messageType || 'text',
            timestamp: new Date(),
          };
          conversation.lastMessageTime = new Date();

          // Increment unreadCount for all participants except the sender
          if (conversation.participants) {
            conversation.participants.forEach(p => {
              const pId = p.userId || p.id || p;
              const pIdStr = String(pId);
              if (pId && pIdStr !== String(senderId)) {
                // Skip if user has left the group
                if (conversation.leftMembers && conversation.leftMembers.has(pIdStr)) {
                  return;
                }
                const currentCount = conversation.unreadCount.get(pIdStr) || 0;
                conversation.unreadCount.set(pIdStr, currentCount + 1);
              }
            });
          }
          await conversation.save();
        }

        const basePayload = {
          conversationId,
          senderId,
          text: messageContent,
          content: messageContent,
          messageType: message.messageType,
          fileUrl: message.fileUrl,
          fileName: message.fileName,
          fileSize: message.fileSize,
          replyTo: message.replyTo,
          isRevoked: message.isRevoked,
          timestamp: message.createdAt,
        };

        // Emit 'message_sent' back to sender
        io.to(`user_${senderId}`).emit('message_sent', {
          ...basePayload,
          messageId: message._id,
          tempId,
          status: 'sent',
        });

        // Broadcast 'message_received' to recipients
        const receivePayload = {
          ...basePayload,
          messageId: message._id,
          status: 'received',
        };

        if (isGroup && conversation?.participants) {
          conversation.participants.forEach(p => {
            const pId = p.userId || p.id || p;
            if (pId && String(pId) !== String(senderId)) {
              io.to(`user_${pId}`).emit('message_received', receivePayload);
            }
          });
        } else if (recipientId) {
          io.to(`user_${recipientId}`).emit('message_received', receivePayload);
        }

        console.log(`[Socket] Message sent in ${conversationId} from ${senderId} (isGroup: ${!!isGroup})`);
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

        if (!mongoose.Types.ObjectId.isValid(messageId)) return;

        const message = await Message.findById(messageId);
        if (!message || String(message.senderId) !== String(userId)) return;

        message.isRevoked = true;
        await message.save();

        const conversation = await Conversation.findOne({ conversationId });
        if (conversation) {
          // Update lastMessage if it was the revoked one
          // We compare timestamps as a heuristic since we don't store messageId in lastMessage
          if (conversation.lastMessage && 
              new Date(conversation.lastMessage.timestamp).getTime() === new Date(message.createdAt).getTime()) {
            conversation.lastMessage.content = 'Tin nhắn đã bị thu hồi';
            await conversation.save();
          }

          if (conversation.participants) {
            conversation.participants.forEach(p => {
               io.to(`user_${p.userId}`).emit('message_revoked', { messageId, conversationId });
            });
          }
        }

        console.log(`[Socket] Message ${messageId} revoked by ${userId}`);
      } catch (error) {
        console.error('[Socket] Error revoking message:', error);
      }
    });

    // Delete message (For me only)
    socket.on('delete_message_for_me', async (data) => {
      try {
        const { messageId, userId } = data;
        if (!mongoose.Types.ObjectId.isValid(messageId)) return;

        const message = await Message.findById(messageId);
        if (!message) return;

        if (!message.deletedBy) message.deletedBy = [];
        if (!message.deletedBy.includes(userId)) {
          message.deletedBy.push(userId);
          await message.save();
        }
        
        io.to(`user_${userId}`).emit('message_deleted', { messageId });
        console.log(`[Socket] Message ${messageId} deleted for user ${userId}`);
      } catch (error) {
        console.error('[Socket] Error deleting message:', error);
      }
    });

    // Pin message
    socket.on('pin_message', async (data) => {
      try {
        const { messageId, conversationId, userId } = data;
        if (!mongoose.Types.ObjectId.isValid(messageId)) return;

        const message = await Message.findById(messageId);
        const conversation = await Conversation.findOne({ conversationId });
        
        if (!message || !conversation) return;

        conversation.pinnedMessage = {
          messageId: message._id.toString(),
          content: message.content,
          senderId: message.senderId,
          messageType: message.messageType,
          timestamp: new Date()
        };
        await conversation.save();

        if (conversation.participants) {
          conversation.participants.forEach(p => {
             io.to(`user_${p.userId}`).emit('message_pinned', { conversationId, pinnedMessage: conversation.pinnedMessage });
          });
        }
        console.log(`[Socket] Message ${messageId} pinned in conv ${conversationId}`);
      } catch (error) {
        console.error('[Socket] Error pinning message:', error);
      }
    });

    // Unpin message
    socket.on('unpin_message', async (data) => {
      try {
        const { conversationId, userId } = data;
        const conversation = await Conversation.findOne({ conversationId });
        
        if (!conversation) return;

        conversation.pinnedMessage = null; // Remove pin
        await conversation.save();

        if (conversation.participants) {
          conversation.participants.forEach(p => {
             io.to(`user_${p.userId}`).emit('message_unpinned', { conversationId });
          });
        }
        console.log(`[Socket] Message unpinned in conv ${conversationId}`);
      } catch (error) {
        console.error('[Socket] Error unpinning message:', error);
      }
    });

    // React to a message
    socket.on('react_message', async (data) => {
      try {
        const { messageId, conversationId, userId, reactionType } = data;
        if (!mongoose.Types.ObjectId.isValid(messageId)) return;

        const message = await Message.findById(messageId);
        if (!message) return;

        if (!message.reactions) message.reactions = [];
        
        if (!message.reactions) message.reactions = [];
        
        // Always push to allow multiple reactions of same or different types from one user
        message.reactions.push({ userId, type: reactionType });
        
        await message.save();

        const conversation = await Conversation.findOne({ conversationId });
        if (conversation && conversation.participants) {
          conversation.participants.forEach(p => {
             io.to(`user_${p.userId}`).emit('message_reacted', {
               messageId,
               conversationId,
               reactions: message.reactions
             });
          });
        }
        console.log(`[Socket] Message ${messageId} reacted with ${reactionType} by ${userId}`);
      } catch (error) {
        console.error('[Socket] Error reacting to message:', error);
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

    // ═══════════════════ FRIEND ACTIONS ═══════════════════

    // Friend Action Event Handler
    socket.on('friend_action', (data) => {
      const { recipientId, action, senderId } = data;
      // Tránh tự gửi cho mình nếu lỗi logic frontend
      if (String(recipientId) === String(socket.userId)) return;

      console.log(`[Socket] friend_action: ${action} from ${socket.userId} to ${recipientId}`);
      // Phát tín hiệu cho recipient để họ cập nhật Real-time (Badge/Danh sách)
      io.to(`user_${recipientId}`).emit('friend_action_received', {
        action,
        senderId: socket.userId
      });
    });

    // ═══════════════════ WEBRTC CALL SIGNALING ═══════════════════

    // Initiate a call
    socket.on('call_request', (data) => {
      const { recipientId, callerInfo, isVideo, conversationId } = data;
      
      // Prevent self-calling
      if (String(recipientId) === String(socket.userId)) {
        return;
      }

      console.log(`[Call] Request from ${socket.userId} to ${recipientId} (Video: ${isVideo})`);
      io.to(`user_${recipientId}`).emit('call_incoming', {
        callerId: socket.userId,
        callerInfo,
        isVideo,
        conversationId
      });
    });

    // Accept a call
    socket.on('call_accepted', (data) => {
      const { callerId } = data;
      console.log(`[Call] Callee ${socket.userId} accepted call from ${callerId}`);
      io.to(`user_${callerId}`).emit('call_accepted', {
        calleeId: socket.userId
      });
    });

    // Reject/Busy a call
    socket.on('call_rejected', async (data) => {
      const { callerId, reason, conversationId } = data;
      console.log(`[Call] Callee ${socket.userId} rejected call from ${callerId}. Reason: ${reason}`);
      io.to(`user_${callerId}`).emit('call_rejected', {
        calleeId: socket.userId,
        reason
      });

      // Save system message
      if (conversationId) {
        try {
          const sysMsg = new Message({
            conversationId,
            senderId: socket.userId, // System message attributed to callee
            receiverId: callerId,
            messageType: 'system',
            content: `📞 Nhỡ cuộc gọi từ ${callerId === socket.userId ? 'tôi' : 'người gọi'}`,
            status: 'sent'
          });
          await sysMsg.save();
          
          await Conversation.findOneAndUpdate(
            { conversationId },
            {
              lastMessage: {
                content: sysMsg.content,
                senderId: socket.userId,
                messageType: 'system',
                timestamp: new Date(),
              },
              lastMessageTime: new Date(),
            }
          );
          
          const payload = {
            messageId: sysMsg._id,
            conversationId,
            senderId: socket.userId,
            messageType: 'system',
            content: sysMsg.content,
            timestamp: sysMsg.createdAt,
            status: 'sent'
          };
          io.to(`user_${socket.userId}`).emit('message_received', payload);
          io.to(`user_${callerId}`).emit('message_received', payload);
        } catch (err) {
          console.error("Failed to save missed call message", err);
        }
      }
    });

    // ═══════════════════ GROUP POLLS ═══════════════════

    // Create a new poll
    socket.on('create_poll', async (data) => {
      const { conversationId, question, options, isMultipleChoice = false } = data;
      const userId = socket.userId;

      try {
        const pollContent = JSON.stringify({
          question,
          options: options.map((opt, idx) => ({ id: idx, text: opt, votes: [] })),
          isMultipleChoice
        });

        const pollMsg = new Message({
          conversationId,
          senderId: userId,
          messageType: 'poll',
          content: pollContent,
          status: 'sent'
        });

        await pollMsg.save();

        // Update conversation last message
        await Conversation.findOneAndUpdate(
          { conversationId },
          {
            lastMessage: {
              content: `📊 Bình chọn: ${question}`,
              senderId: userId,
              messageType: 'poll',
              timestamp: new Date()
            },
            lastMessageTime: new Date()
          }
        );

        // Broadcast to all participants
        const conversation = await Conversation.findOne({ conversationId });
        if (conversation) {
          conversation.participants.forEach(p => {
            io.to(`user_${p.userId}`).emit('message_received', {
              messageId: pollMsg._id,
              conversationId,
              senderId: userId,
              messageType: 'poll',
              content: pollContent,
              timestamp: pollMsg.createdAt,
              status: 'sent'
            });
          });
        }
      } catch (err) {
        console.error("[Socket] create_poll error:", err);
      }
    });

    // Vote on a poll
    socket.on('vote_poll', async (data) => {
      const { messageId, optionId, conversationId } = data;
      const userId = socket.userId;

      try {
        const message = await Message.findById(messageId);
        if (!message || message.messageType !== 'poll') return;

        let pollData = JSON.parse(message.content);
        
        // Logic: Single choice for now
        // Remove userId from all other options
        pollData.options.forEach(opt => {
          opt.votes = (opt.votes || []).filter(v => String(v) !== String(userId));
        });

        // Add userId to the selected option
        const targetOption = pollData.options.find(opt => opt.id === optionId);
        if (targetOption) {
          targetOption.votes.push(userId);
        }

        message.content = JSON.stringify(pollData);
        await message.save();

        // Broadcast update
        const conversation = await Conversation.findOne({ conversationId });
        if (conversation) {
          conversation.participants.forEach(p => {
            io.to(`user_${p.userId}`).emit('message_reacted', { 
              messageId: message._id,
              conversationId,
              content: message.content, 
              reactions: message.reactions 
            });
          });
        }
      } catch (err) {
        console.error("[Socket] vote_poll error:", err);
      }
    });

    // Edit a poll
    socket.on('update_poll', async (data) => {
      const { messageId, question, options, conversationId } = data;
      const userId = socket.userId;

      try {
        const pollMsg = await Message.findById(messageId);
        if (!pollMsg) return;

        // Only sender can edit
        if (pollMsg.senderId.toString() !== userId) {
          return socket.emit('error', { message: 'Bạn không có quyền chỉnh sửa bình chọn này' });
        }

        const currentContent = JSON.parse(pollMsg.content);
        
        // Update question
        currentContent.question = question;
        
        // Update options (keep votes for existing ones, add new ones)
        const updatedOptions = options.map((optText, idx) => {
           const existing = currentContent.options.find(o => o.text === optText);
           if (existing) return existing;
           return { id: currentContent.options.length + idx, text: optText, votes: [] };
        });
        
        // Actually simpler: if the user sends the WHOLE new options array, we might lose votes.
        // Let's assume for now they just edit the text or add.
        // A better way is to pass option objects.
        
        currentContent.options = options.map((opt, idx) => {
          // If opt is a string, it's a new option text
          if (typeof opt === 'string') {
            // Find if there was an option with this text before
            const oldOpt = currentContent.options.find(o => o.text === opt);
            if (oldOpt) return oldOpt;
            return { id: Date.now() + idx, text: opt, votes: [] };
          }
          // If opt is an object {id, text}
          const oldOpt = currentContent.options.find(o => o.id === opt.id);
          if (oldOpt) {
            oldOpt.text = opt.text;
            return oldOpt;
          }
          return { id: opt.id || (Date.now() + idx), text: opt.text, votes: [] };
        });

        pollMsg.content = JSON.stringify(currentContent);
        await pollMsg.save();

        // Broadcast update
        io.to(`conversation_${conversationId}`).emit('message_reacted', {
          messageId: pollMsg._id,
          conversationId,
          content: pollMsg.content,
          reactions: pollMsg.reactions
        });

        // Update conversation last message if it was the last one
        await Conversation.findOneAndUpdate(
          { conversationId, 'lastMessage.timestamp': pollMsg.createdAt },
          { 'lastMessage.content': `📊 Bình chọn: ${question}` }
        );

      } catch (err) {
        console.error("[Socket] update_poll error:", err);
      }
    });

    // End a call
    socket.on('call_ended', async (data) => {
      const { peerId, conversationId } = data;
      console.log(`[Call] User ${socket.userId} ended call with ${peerId}`);
      io.to(`user_${peerId}`).emit('call_ended', {
        peerId: socket.userId
      });

      // Save system message
      if (conversationId) {
        try {
          const sysMsg = new Message({
            conversationId,
            senderId: socket.userId,
            receiverId: peerId,
            messageType: 'system',
            content: `📞 Cuộc gọi đã kết thúc`,
            status: 'sent'
          });
          await sysMsg.save();
          
          await Conversation.findOneAndUpdate(
            { conversationId },
            {
              lastMessage: {
                content: sysMsg.content,
                senderId: socket.userId,
                messageType: 'system',
                timestamp: new Date(),
              },
              lastMessageTime: new Date(),
            }
          );
          
          const payload = {
            messageId: sysMsg._id,
            conversationId,
            senderId: socket.userId,
            messageType: 'system',
            content: sysMsg.content,
            timestamp: sysMsg.createdAt,
            status: 'sent'
          };
          io.to(`user_${socket.userId}`).emit('message_received', payload);
          io.to(`user_${peerId}`).emit('message_received', payload);
          
          console.log(`[Call] System message saved and emitted to users`);
        } catch (err) {
          console.error("[Call] Failed to save ended call message:", err);
        }
      }
    });

    // WebRTC: Send Offer
    socket.on('webrtc_offer', (data) => {
      const { peerId, offer } = data;
      io.to(`user_${peerId}`).emit('webrtc_offer', {
        peerId: socket.userId,
        offer
      });
    });

    // WebRTC: Send Answer
    socket.on('webrtc_answer', (data) => {
      const { peerId, answer } = data;
      io.to(`user_${peerId}`).emit('webrtc_answer', {
        peerId: socket.userId,
        answer
      });
    });

    // WebRTC: ICE Candidate
    socket.on('webrtc_ice_candidate', (data) => {
      const { peerId, candidate } = data;
      io.to(`user_${peerId}`).emit('webrtc_ice_candidate', {
        peerId: socket.userId,
        candidate
      });
    });

    // ═══════════════════ END WEBRTC CALL SIGNALING ═══════════════════

    // ═══════════════════ GROUP CALL SIGNALING ═══════════════════

    // Start a Group Call
    socket.on('group_call_start', async (data) => {
      const { conversationId, callerInfo, isVideo } = data;
      
      try {
        const conversation = await Conversation.findOne({ conversationId });
        if (!conversation || !conversation.participants) return;

        const callContent = isVideo ? 'video' : 'audio';

        // Save group call message
        const msg = new Message({
          conversationId,
          senderId: socket.userId,
          receiverId: conversationId,
          messageType: 'group_call',
          content: callContent,
          status: 'sent'
        });
        await msg.save();
        
        await Conversation.findOneAndUpdate(
          { conversationId },
          {
            lastMessage: {
              content: '📞 Cuộc gọi nhóm',
              senderId: socket.userId,
              messageType: 'group_call',
              timestamp: new Date(),
            },
            lastMessageTime: new Date(),
          }
        );

        const payload = {
          messageId: msg._id,
          conversationId,
          senderId: socket.userId,
          messageType: 'group_call',
          content: msg.content,
          timestamp: msg.createdAt,
          status: 'sent'
        };

        // Emit message back to sender
        io.to(`user_${socket.userId}`).emit('message_sent', {
          ...payload,
          status: 'sent',
        });

        // Broadcast to all participants EXCEPT the caller
        conversation.participants.forEach((p) => {
          const pId = p.userId || p.id || (typeof p === 'string' ? p : null);
          if (pId && String(pId) !== String(socket.userId)) {
            io.to(`user_${pId}`).emit('group_call_incoming', {
              conversationId,
              callerId: socket.userId,
              callerInfo,
              isVideo
            });
            // Also emit the message to display bubble
            io.to(`user_${pId}`).emit('message_received', payload);
          }
        });
        console.log(`[Group Call] Started by ${socket.userId} in room ${conversationId}`);
      } catch (err) {
        console.error("Failed to start group call", err);
      }
    });

    // Accept and Join a Group Call
    socket.on('group_call_join', (data) => {
      const { conversationId } = data;
      const roomName = `group_call_${conversationId}`;
      
      socket.join(roomName);

      // Notify others in the room that this user joined
      socket.to(roomName).emit('group_user_joined', {
        userId: socket.userId,
      });
      console.log(`[Group Call] User ${socket.userId} joined room ${roomName}`);
    });

    // WebRTC: Group Offer
    socket.on('group_webrtc_offer', (data) => {
      const { targetPeerId, offer, conversationId } = data;
      io.to(`user_${targetPeerId}`).emit('group_webrtc_offer', {
        senderPeerId: socket.userId,
        offer,
        conversationId
      });
    });

    // WebRTC: Group Answer
    socket.on('group_webrtc_answer', (data) => {
      const { targetPeerId, answer, conversationId } = data;
      io.to(`user_${targetPeerId}`).emit('group_webrtc_answer', {
        senderPeerId: socket.userId,
        answer,
        conversationId
      });
    });

    // WebRTC: Group ICE Candidate
    socket.on('group_webrtc_ice_candidate', (data) => {
      const { targetPeerId, candidate, conversationId } = data;
      io.to(`user_${targetPeerId}`).emit('group_webrtc_ice_candidate', {
        senderPeerId: socket.userId,
        candidate,
        conversationId
      });
    });

    // Leave a Group Call
    socket.on('group_call_leave', async (data) => {
      const { conversationId } = data;
      const roomName = `group_call_${conversationId}`;
      
      socket.leave(roomName);

      // Notify others in the room
      socket.to(roomName).emit('group_user_left', {
        userId: socket.userId,
      });
      console.log(`[Group Call] User ${socket.userId} left room ${roomName}`);

      // Check if room is empty
      const room = io.sockets.adapter.rooms.get(roomName);
      if (!room || room.size === 0) {
        try {
          const sysMsg = new Message({
            conversationId,
            senderId: socket.userId,
            receiverId: conversationId,
            messageType: 'system',
            content: `Cuộc gọi nhóm đã kết thúc`,
            status: 'sent'
          });
          await sysMsg.save();
          
          await Conversation.findOneAndUpdate(
            { conversationId },
            {
              lastMessage: {
                content: `📞 Cuộc gọi nhóm đã kết thúc`,
                senderId: socket.userId,
                messageType: 'system',
                timestamp: new Date(),
              },
              lastMessageTime: new Date(),
            }
          );
          
          const payload = {
            messageId: sysMsg._id,
            conversationId,
            senderId: socket.userId,
            messageType: 'system',
            content: sysMsg.content,
            timestamp: sysMsg.createdAt,
            status: 'sent'
          };
          
          // Emit to all users in the conversation
          const conversation = await Conversation.findOne({ conversationId });
          if (conversation && conversation.participants) {
            conversation.participants.forEach((p) => {
              const pId = p.userId || p.id || (typeof p === 'string' ? p : null);
              if (pId) {
                io.to(`user_${pId}`).emit('message_received', payload);
              }
            });
          }
        } catch (err) {
          console.error("[Group Call] Failed to save group call ended message:", err);
        }
      }
    });

    // Decline / Reject an incoming group call (does not affect the room, just dismisses the ringing)
    socket.on('group_call_reject', (data) => {
      const { conversationId, callerId } = data;
      // You can notify the caller if needed, but in a group context it might be noisy.
      // Usually, we just quietly ignore it. 
      console.log(`[Group Call] User ${socket.userId} rejected incoming group call from ${callerId}`);
    });

    // Mute signaling
    socket.on('group_call_mute_state', (data) => {
      const { conversationId, isMuted } = data;
      const roomName = `group_call_${conversationId}`;
      // Broadcast to other users in the group room
      socket.to(roomName).emit('group_call_remote_mute', {
        userId: socket.userId,
        isMuted
      });
    });

    // Video state signaling
    socket.on('group_call_video_state', (data) => {
      const { conversationId, isVideoOff } = data;
      const roomName = `group_call_${conversationId}`;
      // Broadcast to other users in the group room
      socket.to(roomName).emit('group_call_remote_video_off', {
        userId: socket.userId,
        isVideoOff
      });
    });

    // Cancel / End call before anyone joins
    socket.on('group_call_cancel', async (data) => {
      const { conversationId } = data;
      try {
        const conversation = await Conversation.findOne({ conversationId });
        if (conversation && conversation.participants) {
          // 1. Broadcast "ended" signal to stop ringing
          conversation.participants.forEach((p) => {
            const pId = p.userId || p.id || (typeof p === 'string' ? p : null);
            if (pId) {
              io.to(`user_${pId}`).emit('group_call_ended', { conversationId });
            }
          });

          // 2. Save and Broadcast System Message
          const sysMsg = new Message({
            conversationId,
            senderId: socket.userId,
            receiverId: conversationId,
            messageType: 'system',
            content: `Cuộc gọi nhóm đã kết thúc`,
            status: 'sent'
          });
          await sysMsg.save();

          await Conversation.findOneAndUpdate(
            { conversationId },
            {
              lastMessage: {
                content: `📞 Cuộc gọi nhóm đã kết thúc`,
                senderId: socket.userId,
                messageType: 'system',
                timestamp: new Date(),
              },
              lastMessageTime: new Date(),
            }
          );

          const payload = {
            messageId: sysMsg._id,
            conversationId,
            senderId: socket.userId,
            messageType: 'system',
            content: sysMsg.content,
            timestamp: sysMsg.createdAt,
            status: 'sent'
          };

          conversation.participants.forEach((p) => {
            const pId = p.userId || p.id || (typeof p === 'string' ? p : null);
            if (pId) {
              io.to(`user_${pId}`).emit('message_received', payload);
            }
          });
        }
      } catch (err) {
        console.error("[Group Call] Cancel error:", err);
      }
    });

    // ═══════════════════ END GROUP CALL SIGNALING ═══════════════════

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

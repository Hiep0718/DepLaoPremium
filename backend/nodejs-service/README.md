# Messaging Service (Node.js + Express + MongoDB)

Dịch vụ nhắn tin thời gian thực phục vụ cho hệ thống Zalo clone.

## Cài đặt

### 1. Cài đặt Dependencies
```bash
npm install
# hoặc
yarn install
```

### 2. Cấu hình Environment
```bash
cp .env.example .env
```

Điền các giá trị:
- `MONGO_URI` - MongoDB connection string (từ MongoDB Atlas)
- `PORT` - Port server (mặc định 3001)
- `SPRING_BOOT_URL` - URL Spring Boot service
- `JWT_SECRET` - JWT secret (phải khớp với Spring Boot)
- `CORS_ORIGIN` - CORS allowed origins

### 3. Chạy Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

## API Endpoints

### Messages

#### Gửi tin nhắn
```
POST /api/messages/send
Content-Type: application/json

{
  "conversationId": "user1-user2",
  "senderId": "user1",
  "receiverId": "user2",
  "content": "Hello!",
  "messageType": "text",
  "fileUrl": null
}
```

#### Lấy tin nhắn
```
GET /api/messages/conversation/{conversationId}?page=1&limit=50
```

#### Tìm kiếm tin nhắn
```
GET /api/messages/search/{conversationId}?query=hello
```

#### Cập nhật trạng thái tin nhắn
```
PUT /api/messages/status/{messageId}
Content-Type: application/json

{
  "status": "seen"
}
```

### Conversations

#### Tạo conversation
```
POST /api/messages/conversation
Content-Type: application/json

{
  "conversationId": "user1-user2",
  "participants": ["user1", "user2"],
  "isGroup": false
}
```

#### Lấy danh sách conversations
```
GET /api/messages/conversations/{userId}
```

## Cấu trúc Dự án

```
nodejs-messaging-service/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB config
│   ├── models/
│   │   ├── Message.js           # Message schema
│   │   └── Conversation.js      # Conversation schema
│   ├── controllers/
│   │   └── messageController.js # Message logic
│   ├── routes/
│   │   └── messages.js          # API routes
│   ├── middleware/
│   │   └── errorHandler.js      # Error handling
│   └── server.js                # Main server
├── .env.example                 # Environment template
├── package.json
└── README.md
```

## Database Schema

### Messages Collection
- `conversationId` - ID của conversation
- `senderId` - ID người gửi
- `receiverId` - ID người nhận
- `content` - Nội dung tin nhắn
- `messageType` - Loại: text, image, video, file, sticker
- `fileUrl` - URL file (nếu có)
- `status` - Trạng thái: sent, received, seen
- `reaction` - Reaction: like, love, haha, wow, sad, angry
- `isEdited` - Có được edit hay không
- `createdAt` - Thời gian tạo
- `updatedAt` - Thời gian update

### Conversations Collection
- `conversationId` - ID conversation duy nhất
- `participants` - Danh sách người tham gia
- `isGroup` - Là group chat hay 1-1
- `groupName` - Tên group (nếu là group)
- `lastMessage` - Tin nhắn cuối cùng
- `unreadCount` - Số tin nhắn chưa đọc

## WebSocket (Socket.io) Events

Real-time messaging qua WebSocket. Chi tiết xem file `SOCKET_EVENTS.md`

### Main Events:
- **user_join** - Khi user connect vào server
- **send_message** - Gửi tin nhắn real-time
- **message_received** - Nhận tin nhắn
- **mark_as_seen** - Đánh dấu tin nhắn đã xem
- **typing** - Gửi typing indicator
- **user_online / user_offline** - Trạng thái online/offline

### WebSocket Connection:
```javascript
const socket = io('http://localhost:3001');
socket.emit('user_join', userId);
socket.emit('send_message', { conversationId, senderId, recipientId, text });
socket.on('message_received', (data) => { /* ... */ });
```

## Phát triển tiếp theo

- [x] WebSocket/Socket.io cho real-time messaging
- [ ] File upload to S3
- [ ] Group messaging
- [ ] Message reactions
- [ ] Group management
- [ ] Rate limiting
- [ ] Message encryption

## Integration với Spring Boot

1. Gọi `/api/auth/validate` từ Spring Boot để verify token
2. Sử dụng `userId` từ response để tạo conversation/send message
3. CORS phải được cấu hình để allow Spring Boot service

## License

MIT

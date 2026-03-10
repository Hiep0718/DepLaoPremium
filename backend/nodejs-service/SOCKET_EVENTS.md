# WebSocket Events Documentation

## Connection

Connect to WebSocket server:
```
ws://localhost:3001
```

## Events

### 1. User Join (Client → Server)
**Event:** `user_join`
```javascript
socket.emit('user_join', userId)
```
**Example:**
```javascript
socket.emit('user_join', '507f1f77bcf86cd799439011')
```

---

### 2. Send Message (Client → Server)
**Event:** `send_message`
```javascript
socket.emit('send_message', {
  conversationId: string,    // MongoDB conversation ID
  senderId: string,          // Sender user ID
  recipientId: string,       // Recipient user ID
  text: string               // Message content
})
```
**Example:**
```javascript
socket.emit('send_message', {
  conversationId: '507f1f77bcf86cd799439011',
  senderId: '507f1f77bcf86cd799439012',
  recipientId: '507f1f77bcf86cd799439013',
  text: 'Hello, how are you?'
})
```

### Receive: `message_sent` (Server → Sender)
```javascript
socket.on('message_sent', (data) => {
  console.log(data)
  // {
  //   messageId: string,
  //   conversationId: string,
  //   senderId: string,
  //   text: string,
  //   timestamp: ISO8601,
  //   status: 'sent'
  // }
})
```

### Receive: `message_received` (Server → Recipient)
```javascript
socket.on('message_received', (data) => {
  console.log(data)
  // {
  //   messageId: string,
  //   conversationId: string,
  //   senderId: string,
  //   text: string,
  //   timestamp: ISO8601,
  //   status: 'received'
  // }
})
```

---

### 3. Mark Message as Seen (Client → Server)
**Event:** `mark_as_seen`
```javascript
socket.emit('mark_as_seen', {
  messageId: string,         // MongoDB message ID
  conversationId: string,    // Conversation ID
  userId: string             // User ID who saw the message
})
```
**Example:**
```javascript
socket.emit('mark_as_seen', {
  messageId: '507f1f77bcf86cd799439014',
  conversationId: '507f1f77bcf86cd799439011',
  userId: '507f1f77bcf86cd799439013'
})
```

### Receive: `message_seen` (Server → All)
```javascript
socket.on('message_seen', (data) => {
  console.log(data)
  // {
  //   messageId: string,
  //   conversationId: string,
  //   seenBy: string,
  //   timestamp: ISO8601
  // }
})
```

---

### 4. Typing Indicator (Client → Server)
**Event:** `typing`
```javascript
socket.emit('typing', {
  conversationId: string,    // Conversation ID
  userId: string,            // User who is typing
  isTyping: boolean          // true = typing, false = stopped
})
```
**Example:**
```javascript
socket.emit('typing', {
  conversationId: '507f1f77bcf86cd799439011',
  userId: '507f1f77bcf86cd799439012',
  isTyping: true
})
```

### Receive: `user_typing` (Server → Conversation Members)
```javascript
socket.on('user_typing', (data) => {
  console.log(data)
  // {
  //   conversationId: string,
  //   userId: string,
  //   isTyping: boolean
  // }
})
```

---

### 5. Join Conversation (Client → Server)
**Event:** `join_conversation`
```javascript
socket.emit('join_conversation', conversationId)
```
**Example:**
```javascript
socket.emit('join_conversation', '507f1f77bcf86cd799439011')
```

---

### 6. Leave Conversation (Client → Server)
**Event:** `leave_conversation`
```javascript
socket.emit('leave_conversation', conversationId)
```
**Example:**
```javascript
socket.emit('leave_conversation', '507f1f77bcf86cd799439011')
```

---

### 7. User Online Status (Server → All)
**Event:** `user_online`
```javascript
socket.on('user_online', (data) => {
  console.log(data)
  // {
  //   userId: string,
  //   status: 'online',
  //   timestamp: ISO8601
  // }
})
```

---

### 8. User Offline Status (Server → All)
**Event:** `user_offline`
```javascript
socket.on('user_offline', (data) => {
  console.log(data)
  // {
  //   userId: string,
  //   status: 'offline',
  //   timestamp: ISO8601
  // }
})
```

---

## Client Example (JavaScript)

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

// Connect and join
socket.on('connect', () => {
  console.log('Connected to messaging server');
  socket.emit('user_join', 'user123');
});

// Send message
function sendMessage(conversationId, senderId, recipientId, text) {
  socket.emit('send_message', {
    conversationId,
    senderId,
    recipientId,
    text
  });
}

// Receive message
socket.on('message_received', (data) => {
  console.log('New message:', data.text);
});

// Listen for typing
socket.on('user_typing', (data) => {
  if (data.isTyping) {
    console.log(`${data.userId} is typing...`);
  }
});

// Disconnect
socket.on('disconnect', () => {
  console.log('Disconnected from messaging server');
});
```

---

## Testing with Socket.io Client CLI

Install Socket.io CLI:
```bash
npm install -g socket.io-client-cli
```

Connect to server:
```bash
socket.io-client http://localhost:3001
```

Then use `emit` commands:
```
/emit user_join "507f1f77bcf86cd799439011"

/emit send_message '{"conversationId":"507f1f77bcf86cd799439011","senderId":"507f1f77bcf86cd799439012","recipientId":"507f1f77bcf86cd799439013","text":"Hello"}'

/emit mark_as_seen '{"messageId":"507f1f77bcf86cd799439014","conversationId":"507f1f77bcf86cd799439011","userId":"507f1f77bcf86cd799439013"}'

/emit typing '{"conversationId":"507f1f77bcf86cd799439011","userId":"507f1f77bcf86cd799439012","isTyping":true}'
```

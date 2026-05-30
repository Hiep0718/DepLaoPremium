# Class Diagram - Domain Model

Tài liệu này mở rộng phần class diagram trong `README.md`. Trọng tâm là mô hình miền dữ liệu đang được triển khai thực tế trong:

- Spring Boot + MariaDB
- Node.js Messaging Service + MongoDB
- Node.js AI Chat Service + MongoDB

## Điểm còn thiếu ở sơ đồ cũ

- `User` hiện có thêm `coverUrl`, `gender`, `birthday`, `role`, `isLocked`.
- `Contact` không chỉ lưu `userId/contactId` mà còn có `nickname`, `notes`, `updatedAt`.
- `FriendRequest` có thêm `message`, `updatedAt`.
- `Conversation` có nhiều embedded object quan trọng: `Participant`, `GroupSettings`, `PendingMember`, `LastMessageSnapshot`, `PinnedMessageSnapshot`.
- `Message` đang hỗ trợ nhiều kiểu hơn `TEXT/IMAGE/FILE`: `video`, `audio`, `sticker`, `contact`, `system`, `location`, `reminder`, `group_call`, `poll`.
- `Message` còn có `Reaction`, `ReplyInfo`, `isEdited`, `isRevoked`, `deletedBy`.
- Tin nhắn poll thực tế có payload riêng, dù đang được serialize trong `Message.content`.

## Mermaid UML

```mermaid
classDiagram
direction LR

class User {
  +Long id
  +String phone
  +String passwordHash
  +String fullName
  +String avatarUrl
  +String coverUrl
  +String gender
  +LocalDate birthday
  +UserRole role
  +Boolean isLocked
  +LocalDateTime createdAt
}

class UserRole {
  <<enumeration>>
  USER
  ADMIN
}

class Contact {
  +Long id
  +String nickname
  +String notes
  +LocalDateTime createdAt
  +LocalDateTime updatedAt
}

class FriendRequest {
  +Long id
  +FriendRequestStatus status
  +String message
  +LocalDateTime createdAt
  +LocalDateTime updatedAt
}

class FriendRequestStatus {
  <<enumeration>>
  PENDING
  ACCEPTED
  REJECTED
}

class Conversation {
  +String conversationId
  +Boolean isGroup
  +String groupName
  +String groupAvatar
  +Boolean requireApproval
  +String inviteCode
  +Map unreadCountByUser
  +Map deletedAtByUser
  +Map leftAtByUser
  +Date createdAt
  +Date updatedAt
}

class Participant {
  +String userId
  +ParticipantRole role
  +Date joinedAt
}

class ParticipantRole {
  <<enumeration>>
  leader
  deputy
  member
}

class GroupSettings {
  +PermissionMode sendMessages
  +PermissionMode pinAndPolls
  +PermissionMode changeInfo
}

class PermissionMode {
  <<enumeration>>
  all
  admin_only
}

class PendingMember {
  +String userId
  +String addedBy
  +Date timestamp
}

class LastMessageSnapshot {
  +String content
  +String senderId
  +MessageType messageType
  +Date timestamp
}

class PinnedMessageSnapshot {
  +String messageId
  +String content
  +String senderId
  +MessageType messageType
  +Date timestamp
}

class Message {
  +String _id
  +String conversationId
  +String senderId
  +String receiverId
  +String content
  +MessageType messageType
  +String fileUrl
  +String fileName
  +Number fileSize
  +MessageStatus status
  +Boolean isEdited
  +Date editedAt
  +Boolean isRevoked
  +String[] deletedBy
  +Date createdAt
  +Date updatedAt
}

class MessageType {
  <<enumeration>>
  text
  image
  video
  audio
  file
  sticker
  contact
  system
  location
  reminder
  group_call
  poll
}

class MessageStatus {
  <<enumeration>>
  sent
  received
  seen
}

class Reaction {
  +String userId
  +ReactionType type
}

class ReactionType {
  <<enumeration>>
  like
  love
  haha
  wow
  sad
  angry
}

class ReplyInfo {
  +String messageId
  +String content
  +String senderId
  +MessageType messageType
}

class PollPayload {
  +String question
  +Boolean isMultipleChoice
}

class PollOption {
  +Number id
  +String text
  +String[] votes
}

class AiMessage {
  +String _id
  +String userId
  +AiRole role
  +String content
  +Date createdAt
  +Date updatedAt
}

class AiRole {
  <<enumeration>>
  user
  assistant
}

User --> UserRole
FriendRequest --> FriendRequestStatus
Participant --> ParticipantRole
GroupSettings --> PermissionMode
Message --> MessageType
Message --> MessageStatus
Reaction --> ReactionType
AiMessage --> AiRole

User "1" --> "0..*" Contact : owns
User "1" --> "0..*" Contact : appears as contactUser
User "1" --> "0..*" FriendRequest : sends
User "1" --> "0..*" FriendRequest : receives

Conversation *-- "1..*" Participant
Conversation *-- "1" GroupSettings
Conversation *-- "0..*" PendingMember
Conversation *-- "0..1" LastMessageSnapshot : lastMessage
Conversation *-- "0..1" PinnedMessageSnapshot : pinnedMessage
Conversation o-- "0..*" Message : history

Message *-- "0..*" Reaction
Message *-- "0..1" ReplyInfo
Message ..> PollPayload : when type = poll
PollPayload *-- "1..*" PollOption

Participant ..> User : virtual link by userId
PendingMember ..> User : virtual link by userId
Message ..> User : virtual link by senderId/receiverId
AiMessage ..> User : virtual link by userId
```

## Gợi ý trình bày trong báo cáo

- Nếu cần sơ đồ ngắn gọn để đưa vào chương 3, giữ lại các lớp chính: `User`, `Contact`, `FriendRequest`, `Conversation`, `Message`, `AiMessage`.
- Nếu cần sơ đồ đầy đủ để bảo vệ hoặc giải thích code, thêm các lớp nhúng: `Participant`, `GroupSettings`, `PendingMember`, `Reaction`, `ReplyInfo`, `PollPayload`, `PollOption`.
- Với `Conversation` và `Message`, nên chú thích rõ đây là document MongoDB có embedded subdocument, không phải toàn bộ đều là collection độc lập.

## Mapping với source code

- Relational entities:
  - `backend/spring-boot-api/src/main/java/com/zaloclone/core/entities/User.java`
  - `backend/spring-boot-api/src/main/java/com/zaloclone/core/entities/Contact.java`
  - `backend/spring-boot-api/src/main/java/com/zaloclone/core/entities/FriendRequest.java`
  - `backend/spring-boot-api/src/main/java/com/zaloclone/core/entities/FriendRequestStatus.java`
- MongoDB documents:
  - `backend/nodejs-service/src/models/Conversation.js`
  - `backend/nodejs-service/src/models/Message.js`
  - `backend/ai-chat-service/src/models/AiMessage.js`
- Poll behavior:
  - `backend/nodejs-service/src/socket/socketHandler.js`

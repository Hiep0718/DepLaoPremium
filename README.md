# 🚀 DepLao Premium — Zalo Clone (Tài Liệu Phân Tích & Thiết Kế UML)

Dự án **DepLao Premium** là ứng dụng nhắn tin real-time clone theo Zalo, được xây dựng trên kiến trúc **Polyglot Microservices**. File README này cung cấp đầy đủ thông tin về dự án, đặc tả các chức năng chi tiết để phục vụ cho việc **vẽ sơ đồ UML** trong các chương Phân tích và Thiết kế.

🌐 **Trải nghiệm ứng dụng thực tế tại:** [https://deplaopremium.io.vn](https://deplaopremium.io.vn)

---

## 🌟 1. Tổng Quan Kỹ Thuật (Tech Stack)

| Layer | Technology |
|---|---|
| **Backend API (Core)** | Java 17, Spring Boot 3.3.5, Spring Security, JPA, MariaDB |
| **Messaging Service** | Node.js, Express, Socket.io, MongoDB |
| **AI Chat Service** | Node.js, Express, Google Gemini API (Model: `gemini-2.5-flash`), MongoDB |
| **Web App** | React 19, TypeScript, Vite 8, TailwindCSS v4, Zustand |
| **Mobile App** | React Native 0.81, Expo SDK 54 |
| **DevOps** | Docker, Docker Compose |

---

## 🎯 2. Đặc Tả Chức Năng (Features)

1. **Quản lý Tài Khoản (Auth & User):**
   - Đăng ký, Đăng nhập (JWT authentication), Cấp lại token (Refresh token).
   - Xem và cập nhật hồ sơ cá nhân (Avatar, tên hiển thị).
   - Tìm kiếm người dùng qua số điện thoại hoặc tên.
2. **Quản lý Danh Bạ (Contacts):**
   - Gửi yêu cầu kết bạn, Chấp nhận/Từ chối yêu cầu.
   - Hiển thị danh sách bạn bè, xóa bạn bè.
3. **Chat Cá Nhân (1-1):**
   - Nhắn tin theo thời gian thực (Socket.io).
   - Cập nhật trạng thái tin nhắn (đã gửi, đã nhận, đã xem).
4. **Chat Nhóm (Group Chat):**
   - Tạo nhóm, tạo mã mời (Invite Code).
   - Quản lý phân quyền thành viên: `leader`, `deputy`, `member`.
   - Phê duyệt thành viên mới (Require Approval).
   - Cài đặt nhóm (Chỉ admin được gửi tin, ghim tin nhắn...).
   - Ghim tin nhắn (Pinned Message).
5. **Trợ Lý AI (AI Chatbot):**
   - Nhắn tin trực tiếp với AI tích hợp sẵn (Sử dụng model Gemini 2.5 Flash).
   - Lưu trữ lịch sử trò chuyện với AI.

---

## 📊 3. CHƯƠNG 3: PHÂN TÍCH VÀ THIẾT KẾ (DỮ LIỆU ĐỂ VẼ UML)

### 3.1 Phân tích yêu cầu bằng UML

#### 3.1.2 Danh sách tác nhân và mô tả (Actors)
| Tên tác nhân | Mô tả |
|---|---|
| **Người dùng (User)** | Người sử dụng ứng dụng (Web/Mobile), đã có tài khoản và đăng nhập vào hệ thống. Thực hiện các chức năng nhắn tin, gọi điện, kết bạn. |
| **Khách (Guest)** | Người chưa đăng nhập, chỉ có thể thực hiện Đăng ký, Đăng nhập. |
| **Hệ thống AI (AI Assistant)** | Tác nhân phụ, phản hồi tự động các câu hỏi của người dùng thông qua AI Chat Service. |

#### 3.1.1 & 3.1.3 Danh sách các tình huống hoạt động (Use Cases)
**Nhóm Use case Quản lý tài khoản:**
- Đăng nhập / Đăng ký
- Quản lý hồ sơ cá nhân (Cập nhật thông tin, avatar)
- Đăng xuất

**Nhóm Use case Giao tiếp (Messaging):**
- Gửi tin nhắn cá nhân (1-1)
- Xem lịch sử tin nhắn
- Tạo nhóm chat
- Tham gia nhóm chat (qua mã mời hoặc được thêm)
- Quản lý nhóm chat (Phân quyền Leader/Deputy, Phê duyệt thành viên)
- Ghim tin nhắn trong nhóm
- Chat với Trợ lý AI

**Nhóm Use case Danh bạ:**
- Tìm kiếm người dùng
- Gửi yêu cầu kết bạn
- Đồng ý / Từ chối kết bạn
- Xóa bạn bè

#### 3.1.4 Tình huống hoạt động chi tiết (Scenarios - Ví dụ tiêu biểu)
**Scenario 1: Gửi tin nhắn 1-1**
1. Người dùng chọn một hội thoại (Conversation) từ danh sách.
2. Hệ thống tải lịch sử tin nhắn của hội thoại đó.
3. Người dùng nhập nội dung và nhấn "Gửi".
4. Web App gửi sự kiện qua WebSocket (Socket.io) lên Node.js Messaging Service.
5. Service lưu tin nhắn vào MongoDB và phát (broadcast) tin nhắn đến người nhận.
6. Hệ thống hiển thị tin nhắn mới trên màn hình cả hai người dùng.

**Scenario 2: Đăng nhập**
1. Người dùng nhập Số điện thoại và Mật khẩu.
2. Web App gọi API `/api/auth/login` đến Spring Boot.
3. Spring Boot kiểm tra với MariaDB. Nếu đúng, tạo Access Token và Refresh Token trả về.
4. Web App lưu Token và chuyển hướng người dùng vào trang chủ (Chat).

---

### 3.2 Class Diagram (Sơ đồ lớp)

Mô hình dữ liệu chia thành 2 phần do kiến trúc Polyglot:

**1. Relational Entities (Spring Boot - MariaDB):**
- `User`: `id`, `phoneNumber`, `password`, `fullName`, `avatar`, `createdAt`...
- `Contact`: `id`, `userId`, `contactId`, `createdAt`
- `FriendRequest`: `id`, `senderId`, `receiverId`, `status` (PENDING, ACCEPTED, REJECTED), `createdAt`

**2. NoSQL Documents (Node.js - MongoDB):**
- `Conversation`: `conversationId`, `isGroup`, `participants` (mảng gồm userId, role), `groupName`, `groupAvatar`, `requireApproval`, `lastMessage`, `pinnedMessage`.
- `Message`: `messageId`, `conversationId`, `senderId`, `content`, `messageType` (TEXT, IMAGE, FILE), `status` (SENT, DELIVERED, READ), `timestamp`.
- `AiMessage`: `userId`, `role` (user/ai), `content`, `timestamp`.

*(Khi vẽ sơ đồ lớp, có thể kết nối ảo giữa `Conversation.participants.userId` và `User.id`)*

---

### 3.3 Architecture Diagram (Sơ đồ kiến trúc)

Kiến trúc hệ thống bao gồm các thành phần sau:
1. **Presentation Layer:** Web App (React) và Mobile App (React Native).
2. **Gateway / API Routing:** Các request HTTP và WebSocket được gọi trực tiếp đến các services dựa theo port hoặc thông qua bộ định tuyến.
3. **Core API Service (Spring Boot - Port 8082):** Xử lý nghiệp vụ lõi, xác thực người dùng, quản lý danh bạ. Kết nối với **MariaDB** (Port 3306).
4. **Messaging Service (Node.js - Port 3001):** Quản lý luồng tin nhắn real-time bằng Socket.io. Kết nối với **MongoDB** (Port 27017). Nhận JWT token và xác thực qua Spring Boot.
5. **AI Chat Service (Node.js - Port 3002):** Chứa logic giao tiếp với LLM engine. Đẩy prompt qua Google Gemini API. Kết nối với **MongoDB** để lưu lịch sử chat AI.

---

### 3.4 Deployment Diagram (Sơ đồ triển khai)

Hệ thống triển khai trên Docker với sơ đồ các Node:

- **Client Node (Thiết bị người dùng):**
  - Chạy Web Browser (Truy cập Web App) hoặc Mobile OS (Chạy Mobile App).
- **Server Node (Docker Host - Chạy Docker Compose):**
  - Container `deplao-web`: Chạy ứng dụng React trên port 80.
  - Container `deplao-spring-api`: Chạy Spring Boot trên port 8082.
  - Container `deplao-messaging`: Chạy Node.js Socket.io trên port 3001.
  - Container `deplao-ai-chat`: Chạy Node.js AI Service trên port 3002.
  - Container `deplao-mariadb`: Cơ sở dữ liệu SQL trên port 3307/3306.
  - Container `deplao-mongodb`: Cơ sở dữ liệu NoSQL trên port 27017.
  - (*External API*): Google Gemini API phục vụ AI Model.

---
*Tài liệu được chuẩn bị dành riêng cho việc chuyển đổi thành các biểu đồ UML phân tích và thiết kế hệ thống phần mềm.*

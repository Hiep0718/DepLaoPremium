# 🚀 DepLao Premium — Zalo Clone

Ứng dụng nhắn tin real-time clone theo Zalo, xây dựng trên kiến trúc **polyglot microservices**.

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend API** | Java 17, Spring Boot 3.3.5, Spring Security, JPA, MariaDB |
| **Messaging** | Node.js, Express, Socket.io, MongoDB |
| **Web App** | React 19, TypeScript, Vite 8, TailwindCSS v4, Zustand |
| **Mobile App** | React Native 0.81, Expo SDK 54 |
| **DevOps** | Docker, Docker Compose |

## Kiến Trúc

```
┌──────────────┐    ┌──────────────┐
│   Web App    │    │  Mobile App  │
│  (React/TS)  │    │ (React Native│
│   :5173      │    │    /Expo)    │
└──────┬───────┘    └──────┬───────┘
       │  REST + WebSocket │
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│ Spring Boot  │◄──►│  Node.js     │
│  Auth/Users  │    │  Messaging   │
│  Contacts    │    │  Socket.io   │
│   :8082      │    │   :3001      │
└──────┬───────┘    └──────┬───────┘
       │                   │
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│   MariaDB    │    │   MongoDB    │
│   :3306      │    │   :27017     │
└──────────────┘    └──────────────┘
```

## Cài Đặt & Chạy

### Option 1: Docker Compose (Khuyến nghị)

```bash
# Clone project
git clone <repo-url>
cd deplao

# Chạy toàn bộ hệ thống
docker compose up -d

# Xem logs
docker compose logs -f
```

### Option 2: Chạy Thủ Công

#### 1. Database

```bash
# MariaDB (port 3306)
docker run -d --name mariadb -p 3306:3306 \
  -e MARIADB_ROOT_PASSWORD=sapassword \
  -e MARIADB_DATABASE=zalo_db \
  mariadb:10.11

# MongoDB (port 27017)
docker run -d --name mongodb -p 27017:27017 mongo:6.0
```

#### 2. Spring Boot API

```bash
cd backend/spring-boot-api
./mvnw spring-boot:run
# API: http://localhost:8082
# Swagger: http://localhost:8082/swagger-ui.html
```

#### 3. Node.js Messaging Service

```bash
cd backend/nodejs-service
npm install
npm run dev
# Server: http://localhost:3001
```

#### 4. Web App

```bash
cd frontend/web-app
npm install
npm run dev
# App: http://localhost:5173
```

#### 5. Mobile App

```bash
cd frontend/mobile-app
npm install
npx expo start
```

## API Documentation

### Auth (`/api/auth/`)
| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/register` | Đăng ký tài khoản |
| `POST` | `/login` | Đăng nhập |
| `POST` | `/refresh` | Làm mới token |
| `POST` | `/validate` | Validate access token |

### Users (`/api/users/`)
| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/profile` | Lấy hồ sơ cá nhân |
| `PUT` | `/profile` | Cập nhật hồ sơ |
| `GET` | `/search?search=` | Tìm kiếm user |
| `GET` | `/:userId` | Lấy thông tin user |

### Contacts (`/api/contacts/`)
| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/` | Thêm contact |
| `GET` | `/` | Danh sách contacts |
| `GET` | `/:contactId` | Chi tiết contact |
| `PUT` | `/:contactId` | Cập nhật contact |
| `DELETE` | `/:contactId` | Xóa contact |
| `GET` | `/search?search=` | Tìm kiếm contact |

### Messaging (`/api/messages/`) — Node.js :3001
| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/send` | Gửi tin nhắn |
| `GET` | `/conversation/:id` | Lịch sử tin nhắn |
| `POST` | `/conversation` | Tạo conversation |
| `GET` | `/conversations/:userId` | Danh sách conversations |

## Thành Viên

| Tên | Vai trò |
|---|---|
| Thanh Hiệp | Developer |
| Ngọc Đăng | Developer |
| Văn Khang | Developer |
| Viết Hiếu | Developer |

## License

MIT

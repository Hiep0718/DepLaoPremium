# Spring Boot API Documentation

Tài liệu này mô tả chi tiết các REST API được cung cấp bởi `spring-boot-api` service, bao gồm các đường dẫn (endpoints), phương thức (HTTP methods), và cấu trúc dữ liệu gửi/nhận (DTOs).

Mọi request được bảo vệ (ngoại trừ `/api/auth/**`) yêu cầu Header:
`Authorization: Bearer <access_token>`

Tất cả các response sẽ được bọc trong một đối tượng `ApiResponse` chuẩn:
```json
{
  "success": true/false,
  "message": "Nội dung thông báo",
  "data": { ... } // Payload thực tế (nếu có)
}
```

Đối với các API trả về danh sách có phân trang, cấu trúc `data` sẽ là `PageResponse`:
```json
{
  "content": [ ... ],
  "pageNumber": 0,
  "pageSize": 20,
  "totalElements": 100,
  "totalPages": 5,
  "last": false
}
```

---

## 1. AuthController (`/api/auth`)

Quản lý xác thực và đăng xuất.

### 1.1 Đăng ký (Register)
- **URL:** `/api/auth/register`
- **Method:** `POST`
- **Body:**
```json
{
  "phone": "0123456789",
  "password": "mypassword",
  "fullName": "Nguyen Van A"
}
```
- **Response Data:** `null` (Chỉ cần kiểm tra `success: true`)

### 1.2 Đăng nhập (Login)
- **URL:** `/api/auth/login`
- **Method:** `POST`
- **Body:**
```json
{
  "phone": "0123456789",
  "password": "mypassword"
}
```
- **Response Data:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

### 1.3 Làm mới Token (Refresh Token)
- **URL:** `/api/auth/refresh`
- **Method:** `POST`
- **Body:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```
- **Response Data:** Cùng định dạng với Đăng nhập (trả về access và refresh token mới).

### 1.4 Xác thực Token (Validate Token)
- **URL:** `/api/auth/validate`
- **Method:** `POST`
- **Body:**
```json
{
  "token": "eyJhbGci..."
}
```
- **Response Data:** Trả về `UserResponse` (Xem định nghĩa ở phần UserController).

---

## 2. UserController (`/api/users`)

Quản lý thông tin và hồ sơ người dùng.

### 2.1 Lấy hồ sơ cá nhân
- **URL:** `/api/users/profile`
- **Method:** `GET`
- **Response Data (`UserResponse`):**
```json
{
  "id": 1,
  "phone": "0123456789",
  "fullName": "Nguyen Van A",
  "avatarUrl": "https://...",
  "role": "USER"
}
```

### 2.2 Cập nhật hồ sơ cá nhân
- **URL:** `/api/users/profile`
- **Method:** `PUT`
- **Body:**
```json
{
  "fullName": "Nguyen Van B",
  "avatarUrl": "https://..."
}
```
- **Response Data:** Trả về `UserResponse` đã được cập nhật.

### 2.3 Lấy thông tin User theo ID
- **URL:** `/api/users/{userId}`
- **Method:** `GET`
- **Response Data:** Trả về `UserResponse`.

### 2.4 Tìm kiếm User
- **URL:** `/api/users/search`
- **Method:** `GET`
- **Query Params:** 
  - `search` (Bắt buộc): Tên hoặc số điện thoại
  - `page`: Trang số mấy (Mặc định: 0)
  - `size`: Số lượng mỗi trang (Mặc định: 20)
  - `sort`: Trường để sắp xếp (Mặc định: fullName)
  - `direction`: ASC hoặc DESC (Mặc định: ASC)
- **Response Data:** `PageResponse<UserResponse>`

### 2.5 Xóa tài khoản
- **URL:** `/api/users/{userId}`
- **Method:** `DELETE`
- **Response Data:** `null`

---

## 3. ContactController (`/api/contacts`)

Quản lý danh bạ của người dùng.

### 3.1 Lấy danh sách danh bạ
- **URL:** `/api/contacts`
- **Method:** `GET`
- **Query Params:** `page`, `size`, `sort`, `direction`
- **Response Data (`PageResponse<ContactResponse>`):**
```json
{
  "content": [
    {
      "id": 1,
      "contactUserId": 2,
      "phone": "0987654321",
      "fullName": "Tran Van B",
      "avatarUrl": "https://...",
      "nickname": "Anh B",
      "notes": "Đồng nghiệp",
      "createdAt": "2024-03-20T10:00:00",
      "updatedAt": "2024-03-20T10:00:00"
    }
  ],
  ...
}
```

### 3.2 Lấy chi tiết một Contact
- **URL:** `/api/contacts/{contactId}`
- **Method:** `GET`
- **Response Data:** `ContactResponse`

### 3.3 Thêm người vào danh bạ
- **URL:** `/api/contacts`
- **Method:** `POST`
- **Body:**
```json
{
  "phone": "0987654321",
  "nickname": "Anh B",
  "notes": "Bạn học cũ"
}
```
- **Response Data:** Trả về `ContactResponse` vừa được tạo.

### 3.4 Cập nhật Contact
- **URL:** `/api/contacts/{contactId}`
- **Method:** `PUT`
- **Body:**
```json
{
  "nickname": "Anh B (Cơ quan mới)",
  "notes": "Đã chuyển sang công ty X"
}
```
- **Response Data:** Trả về `ContactResponse` đã được cập nhật.

### 3.5 Tìm kiếm trong danh bạ
- **URL:** `/api/contacts/search`
- **Method:** `GET`
- **Query Params:** `search` (theo tên, số điện thoại, nickname), `page`, `size`, `sort`, `direction`
- **Response Data:** `PageResponse<ContactResponse>`

### 3.6 Đếm số lượng Contact
- **URL:** `/api/contacts/count`
- **Method:** `GET`
- **Response Data:**
```json
{
  "count": 15
}
```

### 3.7 Xóa Contact
- **URL:** `/api/contacts/{contactId}`
- **Method:** `DELETE`
- **Response Data:** `null`

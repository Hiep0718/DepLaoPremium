package com.zaloclone.core.controllers;

import com.zaloclone.core.dtos.*;
import com.zaloclone.core.security.AuthorizationUtil;
import com.zaloclone.core.services.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final AuthorizationUtil authorizationUtil;

    /**
     * Lấy thông tin hồ sơ của user hiện tại
     */
    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<?>> getProfile() {
        try {
            var user = authorizationUtil.getCurrentUser();
            UserResponse profile = userService.getUserProfile(user);
            return ResponseEntity.ok(ApiResponse.success("Lấy hồ sơ thành công", profile));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Lấy hồ sơ thất bại: " + e.getMessage()));
        }
    }

    /**
     * Cập nhật thông tin hồ sơ (fullName, avatarUrl)
     */
    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<?>> updateProfile(
            @Valid @RequestBody UpdateUserProfileRequest request) {
        try {
            var user = authorizationUtil.getCurrentUser();
            UserResponse updatedProfile = userService.updateProfile(user, request);
            return ResponseEntity.ok(ApiResponse.success("Cập nhật hồ sơ thành công", updatedProfile));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Cập nhật hồ sơ thất bại: " + e.getMessage()));
        }
    }

    /**
     * Lấy thông tin user theo ID
     */
    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse<?>> getUserById(@PathVariable Long userId) {
        try {
            var user = userService.getUserById(userId);
            UserResponse userResponse = userService.getUserProfile(user);
            return ResponseEntity.ok(ApiResponse.success("Lấy thông tin user thành công", userResponse));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Lấy thông tin user thất bại: " + e.getMessage()));
        }
    }

    /**
     * Tìm kiếm user (theo tên hoặc số điện thoại)
     * Query params: search, page (0-indexed), size, sort
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<?>> searchUsers(
            @RequestParam(name = "search") String search,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @RequestParam(name = "sort", defaultValue = "fullName") String sort,
            @RequestParam(name = "direction", defaultValue = "ASC") Sort.Direction direction) {
        try {
            if (search == null || search.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Tìm kiếm không được để trống"));
            }

            Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sort));
            Page<UserResponse> result = userService.searchUsers(search, pageable);

            PageResponse<UserResponse> pageResponse = PageResponse.from(result);
            return ResponseEntity.ok(ApiResponse.success("Tìm kiếm thành công", pageResponse));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Tìm kiếm thất bại: " + e.getMessage()));
        }
    }

    /**
     * Xóa tài khoản user (chỉ admin hoặc chính user đó)
     * Chức năng này cần thêm soft delete hoặc xóa toàn bộ dữ liệu liên quan
     */
    @DeleteMapping("/{userId}")
    public ResponseEntity<ApiResponse<?>> deleteUser(@PathVariable Long userId) {
        try {
            var currentUser = authorizationUtil.getCurrentUser();

            // Kiểm tra quyền: chỉ admin hoặc chính user đó mới được xóa
            if (!currentUser.getId().equals(userId) &&
                    !currentUser.getRole().toString().equals("ADMIN")) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(ApiResponse.error("Bạn không có quyền xóa tài khoản này"));
            }

            // Placeholder: Implement actual deletion logic
            // userService.deleteUser(userId);

            return ResponseEntity.ok(ApiResponse.success("Xóa tài khoản thành công", null));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Xóa tài khoản thất bại: " + e.getMessage()));
        }
    }
}

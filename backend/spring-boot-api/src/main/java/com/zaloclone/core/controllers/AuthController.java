package com.zaloclone.core.controllers;

import com.zaloclone.core.dtos.*;
import com.zaloclone.core.entities.User;
import com.zaloclone.core.security.JwtProvider;
import com.zaloclone.core.services.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final UserService userService;
    private final JwtProvider jwtProvider;

    @PostMapping(value = "/register", consumes = "application/json")
    public ResponseEntity<ApiResponse<?>> register(@Valid @RequestBody RegisterRequest request) {
        try {
            User user = userService.register(request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.success("Đăng ký thành công", null));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Đăng ký thất bại: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/login", consumes = "application/json")
    public ResponseEntity<ApiResponse<?>> login(@Valid @RequestBody LoginRequest request) {
        try {
            User user = userService.login(request);

            String accessToken = jwtProvider.generateAccessToken(user.getPhone());
            String refreshToken = jwtProvider.generateRefreshToken(user.getPhone());

            TokenResponse tokenResponse = TokenResponse.builder()
                    .accessToken(accessToken)
                    .refreshToken(refreshToken)
                    .tokenType("Bearer")
                    .expiresIn(900L)
                    .build();

            return ResponseEntity.ok()
                    .body(ApiResponse.success("Đăng nhập thành công", tokenResponse));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Đăng nhập thất bại: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/refresh", consumes = "application/json")
    public ResponseEntity<ApiResponse<?>> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        try {
            if (!jwtProvider.validateToken(request.getRefreshToken())) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Refresh token không hợp lệ hoặc đã hết hạn"));
            }

            String tokenType = jwtProvider.getTokenType(request.getRefreshToken());
            if (!"refresh".equals(tokenType)) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Token không phải là refresh token"));
            }

            String phone = jwtProvider.getPhoneFromToken(request.getRefreshToken());
            String newAccessToken = jwtProvider.generateAccessToken(phone);
            String newRefreshToken = jwtProvider.generateRefreshToken(phone);

            TokenResponse tokenResponse = TokenResponse.builder()
                    .accessToken(newAccessToken)
                    .refreshToken(newRefreshToken)
                    .tokenType("Bearer")
                    .expiresIn(900L)
                    .build();

            return ResponseEntity.ok()
                    .body(ApiResponse.success("Làm mới token thành công", tokenResponse));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Làm mới token thất bại: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/validate", consumes = "application/json")
    public ResponseEntity<ApiResponse<?>> validateToken(@RequestBody Map<String, String> request) {
        try {
            String token = request.get("token");
            if (token == null || token.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Token không được để trống"));
            }

            if (!jwtProvider.validateToken(token)) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Token không hợp lệ hoặc đã hết hạn"));
            }

            String tokenType = jwtProvider.getTokenType(token);
            if (!"access".equals(tokenType)) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Chỉ có thể validate access token"));
            }

            String phone = jwtProvider.getPhoneFromToken(token);
            User user = userService.getUserByPhone(phone);

            UserResponse userResponse = UserResponse.builder()
                    .id(user.getId())
                    .phone(user.getPhone())
                    .fullName(user.getFullName())
                    .avatarUrl(user.getAvatarUrl())
                    .role(user.getRole().toString())
                    .build();

            return ResponseEntity.ok()
                    .body(ApiResponse.success("Token hợp lệ", userResponse));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Validate token thất bại: " + e.getMessage()));
        }
    }
}

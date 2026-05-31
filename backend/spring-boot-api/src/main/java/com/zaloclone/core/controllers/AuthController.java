package com.zaloclone.core.controllers;

import com.zaloclone.core.dtos.*;
import com.zaloclone.core.entities.User;
import com.zaloclone.core.security.JwtProvider;
import com.zaloclone.core.services.OtpService;
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
    private final OtpService otpService;

    @PostMapping(value = "/send-otp", consumes = "application/json")
    public ResponseEntity<ApiResponse<?>> sendOtp(@Valid @RequestBody SendOtpRequest request) {
        try {
            otpService.generateAndSendOtp(request.getPhone(), request.getEmail());
            String msg = (request.getEmail() != null && !request.getEmail().trim().isEmpty())
                ? "Đã gửi mã OTP về email " + maskEmail(request.getEmail())
                : "Đã gửi mã OTP thành công";
            return ResponseEntity.ok(ApiResponse.success(msg, null));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Lỗi khi gửi mã OTP: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/verify-otp", consumes = "application/json")
    public ResponseEntity<ApiResponse<?>> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        try {
            boolean isValid = otpService.verifyOtp(request.getPhone(), request.getOtp());
            if (isValid) {
                return ResponseEntity.ok(ApiResponse.success("Xác thực OTP thành công", null));
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("Mã OTP không chính xác hoặc đã hết hạn"));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Lỗi xác thực: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/forgot-password/send-otp", consumes = "application/json")
    public ResponseEntity<ApiResponse<?>> sendForgotPasswordOtp(@Valid @RequestBody SendOtpRequest request) {
        try {
            User user = userService.getUserByPhone(request.getPhone());
            
            String emailToSend = user.getEmail();
            if (request.getEmail() != null && !request.getEmail().trim().isEmpty()) {
                emailToSend = request.getEmail().trim();
            } else if (emailToSend == null || emailToSend.trim().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("REQUIRE_EMAIL"));
            }
            
            otpService.generateAndSendOtp(request.getPhone(), emailToSend);
            
            String maskedEmail = maskEmail(emailToSend);
            return ResponseEntity.ok(ApiResponse.success("Đã gửi mã OTP về email " + maskedEmail, null));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Số điện thoại không tồn tại trong hệ thống"));
        }
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "";
        String[] parts = email.split("@");
        if (parts[0].length() <= 2) return parts[0] + "@" + parts[1];
        return parts[0].substring(0, 2) + "***" + parts[0].substring(parts[0].length() - 1) + "@" + parts[1];
    }

    @PostMapping(value = "/forgot-password/reset", consumes = "application/json")
    public ResponseEntity<ApiResponse<?>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        try {
            boolean isValid = otpService.verifyOtp(request.getPhone(), request.getOtp());
            if (!isValid) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("Mã OTP không chính xác hoặc đã hết hạn"));
            }
            userService.resetPassword(request);
            return ResponseEntity.ok(ApiResponse.success("Đặt lại mật khẩu thành công", null));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Lỗi: " + e.getMessage()));
        }
    }

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

    /**
     * QR Login: Mobile xác nhận đăng nhập cho Web.
     * Mobile gửi accessToken của mình → Server validate → Tạo token mới cho Web session.
     */
    @PostMapping(value = "/qr-login/confirm", consumes = "application/json")
    public ResponseEntity<ApiResponse<?>> qrLoginConfirm(@RequestBody Map<String, String> request) {
        try {
            String mobileToken = request.get("accessToken");
            if (mobileToken == null || mobileToken.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Access token không được để trống"));
            }

            // Validate mobile token
            if (!jwtProvider.validateToken(mobileToken)) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Token không hợp lệ hoặc đã hết hạn"));
            }

            String tokenType = jwtProvider.getTokenType(mobileToken);
            if (!"access".equals(tokenType)) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Chỉ chấp nhận access token"));
            }

            // Get user from mobile token
            String phone = jwtProvider.getPhoneFromToken(mobileToken);
            User user = userService.getUserByPhone(phone);

            // Generate new token pair for web session
            String webAccessToken = jwtProvider.generateAccessToken(phone);
            String webRefreshToken = jwtProvider.generateRefreshToken(phone);

            // Build response with tokens + user info
            Map<String, Object> responseData = new java.util.HashMap<>();
            responseData.put("accessToken", webAccessToken);
            responseData.put("refreshToken", webRefreshToken);
            responseData.put("tokenType", "Bearer");
            responseData.put("expiresIn", 900L);
            responseData.put("user", UserResponse.builder()
                    .id(user.getId())
                    .phone(user.getPhone())
                    .fullName(user.getFullName())
                    .avatarUrl(user.getAvatarUrl())
                    .role(user.getRole().toString())
                    .build());

            return ResponseEntity.ok()
                    .body(ApiResponse.success("Xác nhận QR login thành công", responseData));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("QR login thất bại: " + e.getMessage()));
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

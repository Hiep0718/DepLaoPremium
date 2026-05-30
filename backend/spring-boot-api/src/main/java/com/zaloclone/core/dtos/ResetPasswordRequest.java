package com.zaloclone.core.dtos;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ResetPasswordRequest {
    @NotBlank(message = "Số điện thoại không được để trống")
    private String phone;

    @NotBlank(message = "Mã OTP không được để trống")
    private String otp;

    @NotBlank(message = "Mật khẩu mới không được để trống")
    private String newPassword;

    private String email;
}

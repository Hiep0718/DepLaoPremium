package com.zaloclone.core.dtos;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;

@Data
public class VerifyOtpRequest {
    @NotBlank(message = "Số điện thoại không được để trống")
    private String phone;
    
    @NotBlank(message = "Mã OTP không được để trống")
    private String otp;
}

package com.zaloclone.core.dtos;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;

@Data
public class SendOtpRequest {
    @NotBlank(message = "Số điện thoại không được để trống")
    private String phone;
}

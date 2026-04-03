package com.zaloclone.core.dtos;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SendFriendRequestRequest {
    @NotBlank(message = "Số điện thoại không được để trống")
    private String phone;
    
    private String message;
}

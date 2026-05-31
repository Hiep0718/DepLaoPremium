package com.zaloclone.core.dtos;

import lombok.Data;

@Data
public class RegisterRequest {
    private String phone;
    private String password;
    private String fullName;
    private String email;
}

package com.zaloclone.core.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UserResponse {

    private Long id;
    private String phone;
    private String fullName;
    private String avatarUrl;
    private String coverUrl;
    private String gender;
    private LocalDate birthday;
    private String role;
    private Boolean isLocked;
    private LocalDateTime createdAt;
}

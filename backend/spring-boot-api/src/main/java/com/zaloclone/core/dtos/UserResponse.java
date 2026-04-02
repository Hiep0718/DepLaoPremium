package com.zaloclone.core.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

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
}

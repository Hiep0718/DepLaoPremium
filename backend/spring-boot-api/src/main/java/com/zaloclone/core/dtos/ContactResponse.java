package com.zaloclone.core.dtos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContactResponse {

    private Long id;
    private Long contactUserId;
    private String phone;
    private String fullName;
    private String avatarUrl;
    private String nickname;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

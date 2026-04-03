package com.zaloclone.core.dtos;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class FriendRequestResponse {
    private Long id;
    private UserResponse sender;
    private UserResponse receiver;
    private String status;
    private String message;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

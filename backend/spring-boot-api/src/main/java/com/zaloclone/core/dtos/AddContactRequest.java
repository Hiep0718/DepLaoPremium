package com.zaloclone.core.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AddContactRequest {

    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(regexp = "^0\\d{8,14}$", message = "Số điện thoại không hợp lệ")
    private String phone;

    private String nickname;

    private String notes;
}

package com.zaloclone.core.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
        // Dòng này yêu cầu tất cả các API trong Swagger phải có security tên là "bearerAuth"
        security = {@SecurityRequirement(name = "bearerAuth")}
)
@SecurityScheme(
        // Định nghĩa "bearerAuth" là gì (ở đây là JWT Token)
        name = "bearerAuth",
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT",
        description = "Nhập JWT token của bạn vào đây (không cần gõ chữ Bearer)"
)
public class OpenApiConfig {
}

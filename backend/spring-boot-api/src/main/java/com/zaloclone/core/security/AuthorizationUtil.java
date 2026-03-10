package com.zaloclone.core.security;

import com.zaloclone.core.entities.User;
import com.zaloclone.core.services.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AuthorizationUtil {

    private final UserService userService;

    /**
     * Get current authenticated user's phone
     */
    public String getCurrentUserPhone() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof String) {
                return (String) principal;
            }
        }
        return null;
    }

    /**
     * Check if user is authenticated
     */
    public boolean isAuthenticated() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated();
    }

    /**
     * Check if current user has admin role
     */
    public boolean isAdmin() {
        // TODO: Implement when role-based authorization is needed
        return false;
    }

    /**
     * Validate if current user owns the resource
     */
    public boolean isOwner(String resourceOwnerPhone) {
        String currentPhone = getCurrentUserPhone();
        return currentPhone != null && currentPhone.equals(resourceOwnerPhone);
    }

    /**
     * Get current authenticated user object
     */
    public User getCurrentUser() {
        String phone = getCurrentUserPhone();
        if (phone == null) {
            throw new RuntimeException("Người dùng không được xác thực");
        }
        return userService.getUserByPhone(phone);
    }
}

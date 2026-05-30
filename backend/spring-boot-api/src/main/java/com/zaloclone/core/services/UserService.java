package com.zaloclone.core.services;

import com.zaloclone.core.dtos.*;
import com.zaloclone.core.entities.User;
import com.zaloclone.core.repositories.UserRepository;
import com.zaloclone.core.security.JwtProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;

    public User register(RegisterRequest request) {
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new RuntimeException("Số điện thoại đã tồn tại!");
        }

        User user = User.builder()
                .phone(request.getPhone())
                .fullName(request.getFullName())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(User.Role.USER)
                .isLocked(false)
                .build();

        return userRepository.save(user);
    }

    public User login(LoginRequest request) {
        User user = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new RuntimeException("Tài khoản không tồn tại!"));

        if (Boolean.TRUE.equals(user.getIsLocked())) {
            throw new RuntimeException("Tài khoản đã bị khóa bởi quản trị viên!");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Mật khẩu không chính xác!");
        }

        return user;
    }

    public User getUserByPhone(String phone) {
        return userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại!"));
    }

    public User getUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại!"));
    }

    @Transactional
    public UserResponse updateProfile(User user, UpdateUserProfileRequest request) {
        user.setFullName(request.getFullName());

        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl());
        }
        if (request.getCoverUrl() != null) {
            user.setCoverUrl(request.getCoverUrl());
        }
        if (request.getGender() != null) {
            user.setGender(request.getGender());
        }
        if (request.getBirthday() != null) {
            user.setBirthday(request.getBirthday());
        }

        User updatedUser = userRepository.save(user);
        return toUserResponse(updatedUser);
    }

    @Transactional
    public void updatePassword(User user, UpdatePasswordRequest request) {
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Mật khẩu hiện tại không chính xác!");
        }
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new RuntimeException("Số điện thoại không tồn tại ghép nối trong hệ thống!"));

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        
        if (request.getEmail() != null && !request.getEmail().trim().isEmpty()) {
            if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
                user.setEmail(request.getEmail().trim());
            }
        }
        
        userRepository.save(user);
    }

    public UserResponse getUserProfile(User user) {
        return toUserResponse(user);
    }

    public Page<UserResponse> searchUsers(String search, Pageable pageable) {
        Page<User> users = userRepository.searchUsers(search, pageable);
        return users.map(this::toUserResponse);
    }

    // ─── Admin Methods ───────────────────────────────────────────────────────

    public Page<UserResponse> getAllUsers(Pageable pageable) {
        Page<User> users = userRepository.findAll(pageable);
        return users.map(this::toUserResponse);
    }

    @Transactional
    public UserResponse lockUser(Long userId, boolean lock) {
        User user = getUserById(userId);
        if (user.getRole() == User.Role.ADMIN) {
            throw new RuntimeException("Không thể khóa tài khoản admin!");
        }
        user.setIsLocked(lock);
        return toUserResponse(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(Long userId) {
        User user = getUserById(userId);
        if (user.getRole() == User.Role.ADMIN) {
            throw new RuntimeException("Không thể xóa tài khoản admin!");
        }
        userRepository.delete(user);
    }

    public Map<String, Object> getAdminStats() {
        Map<String, Object> stats = new HashMap<>();

        long totalUsers = userRepository.count();
        stats.put("totalUsers", totalUsers);

        // Users created today (null-safe)
        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();
        long newUsersToday = userRepository.countByCreatedAtIsNotNullAndCreatedAtAfter(startOfToday);
        stats.put("newUsersToday", newUsersToday);

        // Users this week
        LocalDateTime startOfWeek = LocalDate.now().minusDays(7).atStartOfDay();
        long newUsersThisWeek = userRepository.countByCreatedAtIsNotNullAndCreatedAtAfter(startOfWeek);
        stats.put("newUsersThisWeek", newUsersThisWeek);

        // Users this month
        LocalDateTime startOfMonth = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        long newUsersThisMonth = userRepository.countByCreatedAtIsNotNullAndCreatedAtAfter(startOfMonth);
        stats.put("newUsersThisMonth", newUsersThisMonth);

        // New users per day (last 7 days) for chart
        List<Map<String, Object>> chartData = new ArrayList<>();
        try {
            LocalDateTime since7Days = LocalDate.now().minusDays(6).atStartOfDay();
            List<Object[]> perDay = userRepository.countNewUsersPerDay(since7Days);
            for (Object[] row : perDay) {
                Map<String, Object> point = new HashMap<>();
                point.put("date", row[0].toString());
                point.put("count", ((Number) row[1]).longValue());
                chartData.add(point);
            }
        } catch (Exception e) {
            // Chart data unavailable — silently ignore
        }
        stats.put("userGrowthChart", chartData);

        return stats;
    }

    /**
     * Ensure admin account exists for phone 9999999999
     */
    @Transactional
    public void ensureAdminAccount() {
        Optional<User> existing = userRepository.findByPhone("9999999999");
        if (existing.isEmpty()) {
            User admin = User.builder()
                    .phone("9999999999")
                    .fullName("Admin")
                    .passwordHash(passwordEncoder.encode("123456"))
                    .role(User.Role.ADMIN)
                    .isLocked(false)
                    .build();
            userRepository.save(admin);
        } else {
            // Ensure existing account has ADMIN role
            User user = existing.get();
            if (user.getRole() != User.Role.ADMIN) {
                user.setRole(User.Role.ADMIN);
                userRepository.save(user);
            }
        }
    }

    private UserResponse toUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .phone(user.getPhone())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .coverUrl(user.getCoverUrl())
                .gender(user.getGender())
                .birthday(user.getBirthday())
                .role(user.getRole().toString())
                .isLocked(user.getIsLocked())
                .createdAt(user.getCreatedAt())
                .build();
    }
}


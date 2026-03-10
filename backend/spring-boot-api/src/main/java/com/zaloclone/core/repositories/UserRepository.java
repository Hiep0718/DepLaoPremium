package com.zaloclone.core.repositories;

import com.zaloclone.core.entities.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    // Phương thức tìm người dùng bằng số điện thoại để phục vụ Login
    Optional<User> findByPhone(String phone);

    // Kiểm tra số điện thoại đã tồn tại chưa để phục vụ Đăng ký
    Boolean existsByPhone(String phone);

    // Tìm kiếm user theo tên hoặc số điện thoại
    @Query("SELECT u FROM User u WHERE " +
            "LOWER(u.fullName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "u.phone LIKE CONCAT('%', :search, '%')")
    Page<User> searchUsers(@Param("search") String search, Pageable pageable);
}

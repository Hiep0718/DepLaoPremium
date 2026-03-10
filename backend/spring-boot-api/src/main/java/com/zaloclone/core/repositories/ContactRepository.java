package com.zaloclone.core.repositories;

import com.zaloclone.core.entities.Contact;
import com.zaloclone.core.entities.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ContactRepository extends JpaRepository<Contact, Long> {

    // Lấy contact từ user A đến user B
    Optional<Contact> findByUserAndContactUser(User user, User contactUser);

    // Kiểm tra xem đã là contact chưa
    boolean existsByUserAndContactUser(User user, User contactUser);

    // Lấy danh sách contact của một user
    Page<Contact> findByUser(User user, Pageable pageable);

    // Tìm kiếm contact theo tên hoặc nickname
    @Query("SELECT c FROM Contact c WHERE c.user = :user AND " +
            "(LOWER(c.contactUser.fullName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(c.nickname) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "c.contactUser.phone LIKE CONCAT('%', :search, '%'))")
    Page<Contact> searchContacts(@Param("user") User user, @Param("search") String search, Pageable pageable);

    // Xóa contact
    void deleteByUserAndContactUser(User user, User contactUser);

    // Đếm số lượng contact
    long countByUser(User user);
}

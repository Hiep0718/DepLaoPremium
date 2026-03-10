package com.zaloclone.core.controllers;

import com.zaloclone.core.dtos.*;
import com.zaloclone.core.security.AuthorizationUtil;
import com.zaloclone.core.services.ContactService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/contacts")
@RequiredArgsConstructor
public class ContactController {

    private final ContactService contactService;
    private final AuthorizationUtil authorizationUtil;

    /**
     * Thêm người vào danh bạ
     */
    @PostMapping(value = "", consumes = "application/json")
    public ResponseEntity<ApiResponse<?>> addContact(
            @Valid @RequestBody AddContactRequest request) {
        try {
            var user = authorizationUtil.getCurrentUser();
            ContactResponse contact = contactService.addContact(user, request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.success("Thêm contact thành công", contact));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Thêm contact thất bại: " + e.getMessage()));
        }
    }

    /**
     * Cập nhật thông tin contact (nickname, notes)
     */
    @PutMapping(value = "/{contactId}", consumes = "application/json")
    public ResponseEntity<ApiResponse<?>> updateContact(
            @PathVariable Long contactId,
            @Valid @RequestBody UpdateContactRequest request) {
        try {
            var user = authorizationUtil.getCurrentUser();
            ContactResponse contact = contactService.updateContact(user, contactId, request);
            return ResponseEntity.ok(ApiResponse.success("Cập nhật contact thành công", contact));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Cập nhật contact thất bại: " + e.getMessage()));
        }
    }

    /**
     * Xóa contact khỏi danh bạ
     */
    @DeleteMapping("/{contactId}")
    public ResponseEntity<ApiResponse<?>> deleteContact(@PathVariable Long contactId) {
        try {
            var user = authorizationUtil.getCurrentUser();
            contactService.deleteContact(user, contactId);
            return ResponseEntity.ok(ApiResponse.success("Xóa contact thành công", null));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Xóa contact thất bại: " + e.getMessage()));
        }
    }

    /**
     * Lấy chi tiết contact theo ID
     */
    @GetMapping("/{contactId}")
    public ResponseEntity<ApiResponse<?>> getContact(@PathVariable Long contactId) {
        try {
            var user = authorizationUtil.getCurrentUser();
            ContactResponse contact = contactService.getContact(user, contactId);
            return ResponseEntity.ok(ApiResponse.success("Lấy contact thành công", contact));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Lấy contact thất bại: " + e.getMessage()));
        }
    }

    /**
     * Lấy danh sách contact của user hiện tại (có pagination)
     * Query params: page (0-indexed), size, sort, direction
     */
    @GetMapping("")
    public ResponseEntity<ApiResponse<?>> getContacts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sort,
            @RequestParam(defaultValue = "DESC") Sort.Direction direction) {
        try {
            var user = authorizationUtil.getCurrentUser();
            Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sort));
            Page<ContactResponse> contacts = contactService.getContacts(user, pageable);

            PageResponse<ContactResponse> pageResponse = PageResponse.from(contacts);
            return ResponseEntity.ok(ApiResponse.success("Lấy danh sách contact thành công", pageResponse));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Lấy danh sách contact thất bại: " + e.getMessage()));
        }
    }

    /**
     * Tìm kiếm contact (theo tên, nickname, hoặc số điện thoại)
     * Query params: search, page, size, sort, direction
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<?>> searchContacts(
            @RequestParam String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "nickname") String sort,
            @RequestParam(defaultValue = "ASC") Sort.Direction direction) {
        try {
            if (search == null || search.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("Tìm kiếm không được để trống"));
            }

            var user = authorizationUtil.getCurrentUser();
            Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sort));
            Page<ContactResponse> contacts = contactService.searchContacts(user, search, pageable);

            PageResponse<ContactResponse> pageResponse = PageResponse.from(contacts);
            return ResponseEntity.ok(ApiResponse.success("Tìm kiếm contact thành công", pageResponse));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Tìm kiếm contact thất bại: " + e.getMessage()));
        }
    }

    /**
     * Lấy số lượng contact
     */
    @GetMapping("/count")
    public ResponseEntity<ApiResponse<?>> getContactCount() {
        try {
            var user = authorizationUtil.getCurrentUser();
            long count = contactService.getContactCount(user);
            Map<String, Long> response = new HashMap<>();
            response.put("count", count);
            return ResponseEntity.ok(ApiResponse.success("Lấy số lượng contact thành công", response));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Lấy số lượng contact thất bại: " + e.getMessage()));
        }
    }
}

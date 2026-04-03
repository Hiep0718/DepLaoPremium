package com.zaloclone.core.services;

import com.zaloclone.core.dtos.AddContactRequest;
import com.zaloclone.core.dtos.ContactResponse;
import com.zaloclone.core.dtos.UpdateContactRequest;
import com.zaloclone.core.entities.Contact;
import com.zaloclone.core.entities.User;
import com.zaloclone.core.repositories.ContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ContactService {

    private final ContactRepository contactRepository;
    private final UserService userService;

    @Transactional
    public ContactResponse addContact(User user, AddContactRequest request) {
        // Tìm user từ số điện thoại
        User contactUser = userService.getUserByPhone(request.getPhone());

        // Không thể thêm chính mình làm contact
        if (contactUser.getId().equals(user.getId())) {
            throw new RuntimeException("Không thể thêm chính mình làm contact");
        }

        // Kiểm tra đã là contact chưa
        if (contactRepository.existsByUserAndContactUser(user, contactUser)) {
            throw new RuntimeException("Người này đã được thêm vào danh bạ");
        }

        Contact contact = Contact.builder()
                .user(user)
                .contactUser(contactUser)
                .nickname(request.getNickname() != null && !request.getNickname().trim().isEmpty() ? request.getNickname() : null)
                .notes(request.getNotes())
                .build();

        Contact savedContact = contactRepository.save(contact);
        return toContactResponse(savedContact);
    }

    @Transactional
    public ContactResponse updateContact(User user, Long contactId, UpdateContactRequest request) {
        Contact contact = contactRepository.findById(contactId)
                .orElseThrow(() -> new RuntimeException("Contact không tồn tại"));

        // Kiểm tra quyền: contact phải thuộc về user
        if (!contact.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Bạn không có quyền cập nhật contact này");
        }

        if (request.getNickname() != null) {
            contact.setNickname(request.getNickname());
        }
        if (request.getNotes() != null) {
            contact.setNotes(request.getNotes());
        }

        Contact updatedContact = contactRepository.save(contact);
        return toContactResponse(updatedContact);
    }

    @Transactional
    public void deleteContact(User user, Long contactId) {
        Contact contact = contactRepository.findById(contactId)
                .orElseThrow(() -> new RuntimeException("Contact không tồn tại"));

        // Kiểm tra quyền
        if (!contact.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Bạn không có quyền xóa contact này");
        }

        contactRepository.delete(contact);
    }

    public ContactResponse getContact(User user, Long contactId) {
        Contact contact = contactRepository.findById(contactId)
                .orElseThrow(() -> new RuntimeException("Contact không tồn tại"));

        if (!contact.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("Bạn không có quyền xem contact này");
        }

        return toContactResponse(contact);
    }

    public Page<ContactResponse> getContacts(User user, Pageable pageable) {
        Page<Contact> contacts = contactRepository.findByUser(user, pageable);
        return contacts.map(this::toContactResponse);
    }

    public Page<ContactResponse> searchContacts(User user, String search, Pageable pageable) {
        Page<Contact> contacts = contactRepository.searchContacts(user, search, pageable);
        return contacts.map(this::toContactResponse);
    }

    public long getContactCount(User user) {
        return contactRepository.countByUser(user);
    }

    private ContactResponse toContactResponse(Contact contact) {
        User contactUser = contact.getContactUser();
        return ContactResponse.builder()
                .id(contact.getId())
                .contactUserId(contactUser.getId())
                .phone(contactUser.getPhone())
                .fullName(contactUser.getFullName())
                .avatarUrl(contactUser.getAvatarUrl())
                .nickname(contact.getNickname())
                .notes(contact.getNotes())
                .createdAt(contact.getCreatedAt())
                .updatedAt(contact.getUpdatedAt())
                .build();
    }
}

package com.zaloclone.core.services;

import com.zaloclone.core.dtos.AddContactRequest;
import com.zaloclone.core.dtos.ContactResponse;
import com.zaloclone.core.dtos.UpdateContactRequest;
import com.zaloclone.core.entities.Contact;
import com.zaloclone.core.entities.User;
import com.zaloclone.core.repositories.ContactRepository;
import com.zaloclone.core.repositories.FriendRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ContactService {

    private final ContactRepository contactRepository;
    private final FriendRequestRepository friendRequestRepository;
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

    // ================= FRIEND REQUEST LOGIC =================

    @Transactional
    public com.zaloclone.core.dtos.FriendRequestResponse sendFriendRequest(User sender, com.zaloclone.core.dtos.SendFriendRequestRequest request) {
        User receiver = userService.getUserByPhone(request.getPhone());

        if (sender.getId().equals(receiver.getId())) {
            throw new RuntimeException("Không thể gửi lời mời kết bạn cho chính mình");
        }

        if (contactRepository.existsByUserAndContactUser(sender, receiver)) {
            throw new RuntimeException("Người này đã là bạn bè");
        }

        var existingReq = friendRequestRepository.findBySenderAndReceiver(sender, receiver);
        if (existingReq.isPresent()) {
            if (existingReq.get().getStatus() == com.zaloclone.core.entities.FriendRequestStatus.PENDING) {
                throw new RuntimeException("Bạn đã gửi lời mời kết bạn rồi, vui lòng chờ xác nhận");
            } else if (existingReq.get().getStatus() == com.zaloclone.core.entities.FriendRequestStatus.ACCEPTED) {
                throw new RuntimeException("Người này đã là bạn bè");
            }
            // Nếu đã REJECTED trước đây, có thể gửi lại bằng cách cập nhật
            com.zaloclone.core.entities.FriendRequest req = existingReq.get();
            req.setStatus(com.zaloclone.core.entities.FriendRequestStatus.PENDING);
            req.setMessage(request.getMessage());
            return toFriendRequestResponse(friendRequestRepository.save(req));
        }

        com.zaloclone.core.entities.FriendRequest friendRequest = com.zaloclone.core.entities.FriendRequest.builder()
                .sender(sender)
                .receiver(receiver)
                .status(com.zaloclone.core.entities.FriendRequestStatus.PENDING)
                .message(request.getMessage())
                .build();

        return toFriendRequestResponse(friendRequestRepository.save(friendRequest));
    }

    public Page<com.zaloclone.core.dtos.FriendRequestResponse> getPendingRequests(User receiver, Pageable pageable) {
        Page<com.zaloclone.core.entities.FriendRequest> requests = friendRequestRepository.findByReceiverAndStatus(receiver, com.zaloclone.core.entities.FriendRequestStatus.PENDING, pageable);
        return requests.map(this::toFriendRequestResponse);
    }

    public Page<com.zaloclone.core.dtos.FriendRequestResponse> getSentRequests(User sender, Pageable pageable) {
        Page<com.zaloclone.core.entities.FriendRequest> requests = friendRequestRepository.findBySenderAndStatus(sender, com.zaloclone.core.entities.FriendRequestStatus.PENDING, pageable);
        return requests.map(this::toFriendRequestResponse);
    }

    @Transactional
    public void acceptFriendRequest(User receiver, Long requestId) {
        com.zaloclone.core.entities.FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Lời mời không tồn tại"));

        if (!request.getReceiver().getId().equals(receiver.getId())) {
            throw new RuntimeException("Bạn không có quyền thao tác lời mời này");
        }

        if (request.getStatus() != com.zaloclone.core.entities.FriendRequestStatus.PENDING) {
            throw new RuntimeException("Lời mời không ở trạng thái chờ");
        }

        request.setStatus(com.zaloclone.core.entities.FriendRequestStatus.ACCEPTED);
        friendRequestRepository.save(request);

        // Tạo contact 2 chiều
        User sender = request.getSender();
        
        if (!contactRepository.existsByUserAndContactUser(sender, receiver)) {
            contactRepository.save(Contact.builder().user(sender).contactUser(receiver).build());
        }
        if (!contactRepository.existsByUserAndContactUser(receiver, sender)) {
            contactRepository.save(Contact.builder().user(receiver).contactUser(sender).build());
        }
    }

    @Transactional
    public void rejectFriendRequest(User receiver, Long requestId) {
        com.zaloclone.core.entities.FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Lời mời không tồn tại"));

        if (!request.getReceiver().getId().equals(receiver.getId())) {
            throw new RuntimeException("Bạn không có quyền thao tác lời mời này");
        }

        request.setStatus(com.zaloclone.core.entities.FriendRequestStatus.REJECTED);
        friendRequestRepository.save(request);
    }

    @Transactional
    public void cancelFriendRequest(User sender, Long requestId) {
        com.zaloclone.core.entities.FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Lời mời không tồn tại"));

        if (!request.getSender().getId().equals(sender.getId())) {
            throw new RuntimeException("Bạn không có quyền thao tác lời mời này");
        }
        
        if (request.getStatus() != com.zaloclone.core.entities.FriendRequestStatus.PENDING) {
            throw new RuntimeException("Chỉ có thể hủy lời mời đang chờ xác nhận");
        }

        friendRequestRepository.delete(request);
    }

    private com.zaloclone.core.dtos.FriendRequestResponse toFriendRequestResponse(com.zaloclone.core.entities.FriendRequest req) {
        return com.zaloclone.core.dtos.FriendRequestResponse.builder()
                .id(req.getId())
                .sender(userService.getUserProfile(req.getSender()))
                .receiver(userService.getUserProfile(req.getReceiver()))
                .status(req.getStatus().name())
                .message(req.getMessage())
                .createdAt(req.getCreatedAt())
                .updatedAt(req.getUpdatedAt())
                .build();
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

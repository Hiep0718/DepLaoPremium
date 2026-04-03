package com.zaloclone.core.repositories;

import com.zaloclone.core.entities.FriendRequest;
import com.zaloclone.core.entities.FriendRequestStatus;
import com.zaloclone.core.entities.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {
    
    Page<FriendRequest> findByReceiverAndStatus(User receiver, FriendRequestStatus status, Pageable pageable);
    
    Page<FriendRequest> findBySenderAndStatus(User sender, FriendRequestStatus status, Pageable pageable);
    
    Optional<FriendRequest> findBySenderAndReceiver(User sender, User receiver);
}

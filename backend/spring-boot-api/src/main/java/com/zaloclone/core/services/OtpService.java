package com.zaloclone.core.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import lombok.RequiredArgsConstructor;

import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class OtpService {
    private static final Logger logger = LoggerFactory.getLogger(OtpService.class);
    
    private final JavaMailSender mailSender;
    
    // Lưu trữ OTP tạm thời trong bộ nhớ (SĐT -> mã OTP)
    // Thực tế nên dùng Redis và set thời gian sinh trưởng (TTL)
    private final ConcurrentHashMap<String, String> otpStorage = new ConcurrentHashMap<>();

    public String generateAndSendOtp(String phone, String email) {
        String otp = String.format("%06d", new Random().nextInt(999999));
        otpStorage.put(phone, otp);
        
        System.out.println("==================================================");
        System.out.println("📱 SMS/EMAIL GỬI ĐẾN: " + (email != null ? email : phone));
        System.out.println("Mã OTP của bạn là: " + otp);
        System.out.println("==================================================");
        
        if (email != null && !email.isEmpty()) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(email);
                message.setSubject("Mã OTP Khôi Phục Mật Khẩu - DepLao Premium");
                message.setText("Xin chào,\n\nMã OTP để khôi phục mật khẩu của bạn là: " + otp + "\n\nVui lòng không chia sẻ mã này cho bất kỳ ai.\n\nTrân trọng,\nDepLao Premium Team");
                mailSender.send(message);
                logger.info("Đã gửi email OTP thành công đến {}", email);
            } catch (Exception e) {
                logger.error("Lỗi gửi email OTP: {}", e.getMessage());
            }
        }
        
        return otp;
    }

    public boolean verifyOtp(String phone, String otpInput) {
        String storedOtp = otpStorage.get(phone);
        if (storedOtp != null && storedOtp.equals(otpInput)) {
            // Xác thực xong có thể xoá mã khỏi cache
            otpStorage.remove(phone);
            return true;
        }
        return false;
    }
}

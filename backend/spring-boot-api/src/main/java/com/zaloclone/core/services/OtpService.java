package com.zaloclone.core.services;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OtpService {
    private static final Logger logger = LoggerFactory.getLogger(OtpService.class);
    
    // Lưu trữ OTP tạm thời trong bộ nhớ (SĐT -> mã OTP)
    // Thực tế nên dùng Redis và set thời gian sinh trưởng (TTL)
    private final ConcurrentHashMap<String, String> otpStorage = new ConcurrentHashMap<>();

    public String generateAndSendOtp(String phone) {
        String otp = String.format("%06d", new Random().nextInt(999999));
        otpStorage.put(phone, otp);
        
        // Mô phỏng việc gửi tin nhắn bằng cách in ra log server
        System.out.println("==================================================");
        System.out.println("📱 SMS GỬI ĐẾN SỐ: " + phone);
        System.out.println("Mã OTP của bạn là: " + otp);
        System.out.println("==================================================");
        
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

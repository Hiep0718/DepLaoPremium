package com.zaloclone.core.config;

import com.zaloclone.core.services.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminSeeder implements CommandLineRunner {

    private final UserService userService;

    @Override
    public void run(String... args) {
        try {
            userService.ensureAdminAccount();
            log.info("Admin account (9999999999) ensured.");
        } catch (Exception e) {
            log.warn("Failed to seed admin account: {}", e.getMessage());
        }
    }
}

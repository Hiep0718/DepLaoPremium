package com.zaloclone.core.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Slf4j
@Component
public class JwtProvider {

    @Value("${app.jwt.secret-key:zalo-clone-secret-key-very-long-string-for-jwt-signing-operations}")
    private String jwtSecretKey;

    @Value("${app.jwt.access-token-expiration:900000}") // 15 minutes in milliseconds
    private long accessTokenExpiration;

    @Value("${app.jwt.refresh-token-expiration:604800000}") // 7 days in milliseconds
    private long refreshTokenExpiration;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecretKey.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Generate Access Token (short-lived)
     * @param phone User phone number (unique identifier)
     * @return JWT Access Token
     */
    public String generateAccessToken(String phone) {
        return generateToken(phone, accessTokenExpiration, "access");
    }

    /**
     * Generate Refresh Token (long-lived)
     * @param phone User phone number (unique identifier)
     * @return JWT Refresh Token
     */
    public String generateRefreshToken(String phone) {
        return generateToken(phone, refreshTokenExpiration, "refresh");
    }

    /**
     * Generic token generation method
     */
    private String generateToken(String phone, long expirationTime, String tokenType) {
        Instant now = Instant.now();
        Date issuedAt = Date.from(now);
        Date expiresAt = Date.from(now.plusMillis(expirationTime));

        return Jwts.builder()
                .subject(phone)
                .issuedAt(issuedAt)
                .expiration(expiresAt)
                .claim("type", tokenType)
                .signWith(getSigningKey(), SignatureAlgorithm.HS512)
                .compact();
    }

    /**
     * Extract phone from token
     */
    public String getPhoneFromToken(String token) {
        return Jwts.parser()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody()
                .getSubject();
    }

    /**
     * Validate token and check if it's still valid
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .setSigningKey(getSigningKey())
                    .build()
                    .parseClaimsJws(token);
            return true;
        } catch (MalformedJwtException e) {
            log.error("Invalid JWT token: {}", e.getMessage());
        } catch (ExpiredJwtException e) {
            log.error("Expired JWT token: {}", e.getMessage());
        } catch (UnsupportedJwtException e) {
            log.error("Unsupported JWT token: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            log.error("JWT claims string is empty: {}", e.getMessage());
        }
        return false;
    }

    /**
     * Get token type (access or refresh)
     */
    public String getTokenType(String token) {
        try {
            return Jwts.parser()
                    .setSigningKey(getSigningKey())
                    .build()
                    .parseClaimsJws(token)
                    .getBody()
                    .get("type", String.class);
        } catch (JwtException e) {
            log.error("Cannot extract token type: {}", e.getMessage());
            return null;
        }
    }
}

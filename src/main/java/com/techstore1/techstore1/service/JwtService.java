package com.techstore1.techstore1.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.expiration}")
    private long expiration;

    // Cache signing key để không phải tính lại nhiều lần.
    private volatile SecretKey cachedSigningKey;

    private SecretKey signingKey() {
        // JJWT 0.11+ (Java 9+) yêu cầu key đủ mạnh cho HS256 (>= 256-bit).
        // Để tránh lỗi key quá ngắn khi cấu hình secret dạng text,
        // ta băm SHA-256 secret => luôn ra 32 bytes (256-bit) rồi dùng làm HMAC key.
        //
        // Production: nên dùng secret random dài và lưu an toàn (env/secret manager).
        if (cachedSigningKey == null) {
            synchronized (this) {
                if (cachedSigningKey == null) {
                    byte[] secretBytes = (secretKey == null ? "" : secretKey).getBytes(StandardCharsets.UTF_8);
                    byte[] keyBytes = sha256(secretBytes);
                    cachedSigningKey = Keys.hmacShaKeyFor(keyBytes);
                }
            }
        }
        return cachedSigningKey;
    }

    private byte[] sha256(byte[] input) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(input);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    public String extractUsername(String token) {
        // Subject của token được dùng làm username.
        return extractClaim(token, Claims::getSubject);
    }

    public Date extractExpiration(String token) {
        // Expiration dùng để kiểm tra token còn hạn hay không.
        return extractClaim(token, Claims::getExpiration);
    }

    public <T> T extractClaim(String token, Function<Claims, T> resolver) {
        // Đọc toàn bộ claims và apply resolver.
        final Claims claims = extractAllClaims(token);
        return resolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {

        // Parse token và verify chữ ký (HS256 + secretKey).
        return Jwts.parserBuilder()
                .setSigningKey(signingKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public String generateToken(UserDetails userDetails) {

        // Có thể mở rộng claim ở đây (ví dụ: role, email...), hiện tại chỉ cần subject=username.
        Map<String, Object> claims = new HashMap<>();

        return createToken(claims, userDetails.getUsername());
    }

    private String createToken(Map<String, Object> claims, String username) {

        // Xây JWT: subject + issuedAt + expiration + ký bằng secretKey.
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(username)
                .setIssuedAt(new Date(System.currentTimeMillis()))

                .setExpiration(new Date(System.currentTimeMillis() + expiration))

                // Ký token bằng HS256 + signing key (đã derive từ secret).
                .signWith(signingKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {

        final String username = extractUsername(token);

        // Valid nếu đúng username và chưa hết hạn.
        return username.equals(userDetails.getUsername())
                && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {

        return extractExpiration(token).before(new Date());
    }

    public long getExpirationMillis() {
        // Expose TTL for cookie max-age so browser session lifetime matches JWT lifetime.
        return expiration;
    }
}

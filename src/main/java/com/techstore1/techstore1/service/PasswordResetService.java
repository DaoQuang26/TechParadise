package com.techstore1.techstore1.service;

import com.techstore1.techstore1.dto.ForgotPasswordResponse;
import com.techstore1.techstore1.entity.PasswordResetToken;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.repository.PasswordResetTokenRepository;
import com.techstore1.techstore1.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Locale;

@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailNotificationService emailNotificationService;
    private final long expiryMinutes;
    private final boolean exposeTokenForDev;

    public PasswordResetService(
            UserRepository userRepository,
            PasswordResetTokenRepository passwordResetTokenRepository,
            PasswordEncoder passwordEncoder,
            EmailNotificationService emailNotificationService,
            @Value("${app.auth.reset-token.expiry-minutes:30}") long expiryMinutes,
            @Value("${app.auth.forgot-password.expose-token:true}") boolean exposeTokenForDev
    ) {
        this.userRepository = userRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailNotificationService = emailNotificationService;
        this.expiryMinutes = expiryMinutes;
        this.exposeTokenForDev = exposeTokenForDev;
    }

    @Transactional
    public ForgotPasswordResponse forgotPassword(String rawIdentifier) {
        String identifier = normalizeIdentifier(rawIdentifier);

        // Return same public message for both existing/non-existing users to reduce account enumeration risk.
        String genericMessage = "Nếu tài khoản tồn tại, mã đặt lại mật khẩu đã được gửi về email.";
        if (!emailNotificationService.canSendEmail() && !exposeTokenForDev) {
            log.warn("Forgot-password email is disabled (mail not configured and expose-token=false).");
            return new ForgotPasswordResponse(
                    "Hệ thống chưa cấu hình gửi email đặt lại mật khẩu. Vui lòng liên hệ quản trị viên.",
                    null,
                    expiryMinutes
            );
        }
        User user = userRepository.findByUsernameIgnoreCase(identifier)
                .or(() -> userRepository.findByEmailIgnoreCase(identifier))
                .orElse(null);

        if (user == null) {
            return new ForgotPasswordResponse(genericMessage, null, expiryMinutes);
        }

        String rawToken = generateRawToken();
        PasswordResetToken token = new PasswordResetToken();
        token.setUser(user);
        token.setTokenHash(sha256Hex(rawToken));
        token.setExpiresAt(LocalDateTime.now().plusMinutes(expiryMinutes));
        passwordResetTokenRepository.save(token);

        // In production this token should be sent by email. Here we log it for local development.
        log.info("Password reset token for user '{}': {}", user.getUsername(), rawToken);
        emailNotificationService.sendPasswordResetToken(user, rawToken, expiryMinutes);

        if (exposeTokenForDev) {
            return new ForgotPasswordResponse(
                    "Đã tạo mã đặt lại mật khẩu (chế độ dev). Dùng mã này để đổi mật khẩu.",
                    rawToken,
                    expiryMinutes
            );
        }

        return new ForgotPasswordResponse(genericMessage, null, expiryMinutes);
    }

    @Transactional
    public String verifyResetToken(String rawToken) {
        requireValidResetToken(rawToken);
        return "Mã reset hợp lệ. Bạn có thể đặt mật khẩu mới.";
    }

    @Transactional
    public String resetPassword(String rawToken, String rawNewPassword) {
        String newPassword = rawNewPassword == null ? "" : rawNewPassword.trim();
        if (newPassword.length() < 7) {
            throw new IllegalArgumentException("Mật khẩu mới phải có ít nhất 7 ký tự");
        }

        PasswordResetToken resetToken = requireValidResetToken(rawToken);
        User user = resetToken.getUser();

        // Persist new password with BCrypt and invalidate all other unused tokens of this user.
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        LocalDateTime usedAt = LocalDateTime.now();
        for (PasswordResetToken tokenRow : passwordResetTokenRepository.findByUserIdAndUsedAtIsNull(user.getId())) {
            tokenRow.setUsedAt(usedAt);
        }
        passwordResetTokenRepository.save(resetToken);

        return "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại.";
    }

    private String normalizeIdentifier(String rawIdentifier) {
        String identifier = rawIdentifier == null ? "" : rawIdentifier.trim();
        if (identifier.isBlank()) {
            throw new IllegalArgumentException("Vui lòng nhập email hoặc tên đăng nhập");
        }
        return identifier;
    }

    private PasswordResetToken requireValidResetToken(String rawToken) {
        String token = rawToken == null ? "" : rawToken.trim();
        if (token.isBlank()) {
            throw new IllegalArgumentException("Mã đặt lại mật khẩu không được để trống");
        }

        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenHash(sha256Hex(token))
                .orElseThrow(() -> new IllegalArgumentException("Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn"));

        if (resetToken.getUsedAt() != null) {
            throw new IllegalArgumentException("Mã đặt lại mật khẩu đã được sử dụng");
        }

        if (resetToken.getExpiresAt() == null || resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Mã đặt lại mật khẩu đã hết hạn");
        }

        if (resetToken.getUser() == null) {
            throw new IllegalArgumentException("Tài khoản không hợp lệ cho thao tác đặt lại mật khẩu");
        }
        return resetToken;
    }

    private String generateRawToken() {
        // Use URL-safe random token so user can copy/paste easily in browser/mobile.
        byte[] random = new byte[32];
        SECURE_RANDOM.nextBytes(random);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(random);
    }

    private String sha256Hex(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8));

            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format(Locale.ROOT, "%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available on current JVM", ex);
        }
    }
}

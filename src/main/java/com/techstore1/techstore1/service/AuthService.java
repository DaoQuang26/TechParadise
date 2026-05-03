package com.techstore1.techstore1.service;

import com.techstore1.techstore1.dto.AuthResponse;
import com.techstore1.techstore1.dto.LoginRequest;
import com.techstore1.techstore1.dto.RegisterRequest;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.enums.Role;
import com.techstore1.techstore1.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;
    private final int maxFailedAttempts;
    private final long lockMinutes;

    private static final DateTimeFormatter LOCK_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public AuthService(
            UserRepository userRepository,
            JwtService jwtService,
            AuthenticationManager authenticationManager,
            PasswordEncoder passwordEncoder,
            @Value("${app.auth.login.max-failed-attempts:5}") int maxFailedAttempts,
            @Value("${app.auth.login.lock-minutes:15}") long lockMinutes
    ) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.passwordEncoder = passwordEncoder;
        this.maxFailedAttempts = Math.max(1, maxFailedAttempts);
        this.lockMinutes = Math.max(1L, lockMinutes);
    }

    public AuthResponse login(LoginRequest request) {
        final String identifier = normalizeIdentifier(request.getUsername());
        final String rawPassword = request.getPassword() == null ? "" : request.getPassword();
        User user = userRepository.findByUsernameIgnoreCase(identifier)
                .or(() -> userRepository.findByEmailIgnoreCase(identifier))
                .orElse(null);

        if (isInactive(user)) {
            throw new IllegalArgumentException("Tài khoản đã bị vô hiệu hoá. Vui lòng liên hệ quản trị viên.");
        }

        if (isLocked(user)) {
            throw new IllegalArgumentException("Tài khoản tạm khóa đến " + formatLockTime(user.getLockoutUntil()) + ".");
        }

        // Authenticate with DaoAuthenticationProvider (UserService + PasswordEncoder).
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(identifier, rawPassword)
            );
        } catch (AuthenticationException ex) {
            if (user != null) {
                if (isInactive(user)) {
                    throw new IllegalArgumentException("Tài khoản đã bị vô hiệu hoá. Vui lòng liên hệ quản trị viên.");
                }
                handleFailedLogin(user);
                if (isLocked(user)) {
                    throw new IllegalArgumentException("Tài khoản tạm khóa đến " + formatLockTime(user.getLockoutUntil()) + ".");
                }
            }
            throw new IllegalArgumentException("Sai tài khoản hoặc mật khẩu.");
        }

        // Load persisted user to include canonical username + role in response.
        user = userRepository.findByUsernameIgnoreCase(identifier)
                .or(() -> userRepository.findByEmailIgnoreCase(identifier))
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản."));

        if (isInactive(user)) {
            throw new IllegalArgumentException("Tài khoản đã bị vô hiệu hoá. Vui lòng liên hệ quản trị viên.");
        }

        boolean changed = false;
        // Upgrade legacy plain-text password to BCrypt after successful login.
        if (passwordEncoder.upgradeEncoding(user.getPassword())) {
            user.setPassword(passwordEncoder.encode(rawPassword));
            changed = true;
        }

        // tac dung code: reset bo dem sai va bo khoa tam khi dang nhap dung.
        if ((user.getFailedLoginAttempts() != null && user.getFailedLoginAttempts() > 0) || user.getLockoutUntil() != null) {
            user.setFailedLoginAttempts(0);
            user.setLockoutUntil(null);
            changed = true;
        }
        user.setLastLoginAt(LocalDateTime.now());
        changed = true;

        if (changed) {
            user = userRepository.save(user);
        }

        String token = jwtService.generateToken(
                new org.springframework.security.core.userdetails.User(
                        user.getUsername(),
                        user.getPassword(),
                        List.of(new SimpleGrantedAuthority(user.getRole().asAuthority()))
                )
        );

        return new AuthResponse(token, user.getUsername(), user.getRole().name());
    }

    public User register(RegisterRequest request) {
        String username = normalizeUsername(request.getUsername());
        String fullName = normalizeFullName(request.getFullName());
        String email = normalizeEmail(request.getEmail());
        String rawPassword = request.getPassword() == null ? "" : request.getPassword();
        String confirmPassword = request.getConfirmPassword() == null ? "" : request.getConfirmPassword();
        String phone = normalizePhone(request.getPhone());
        String address = normalizeNullable(request.getAddress());

        if (!rawPassword.equals(confirmPassword)) {
            throw new IllegalArgumentException("Xác nhận mật khẩu không khớp.");
        }

        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new IllegalArgumentException("Tên đăng nhập đã tồn tại.");
        }

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email đã tồn tại.");
        }

        User user = new User();
        user.setUsername(username);
        user.setFullName(fullName);
        user.setEmail(email);
        user.setPhone(phone);
        user.setAddress(address);
        user.setRole(Role.CUSTOMER);
        user.setActive(true);
        user.setPassword(passwordEncoder.encode(rawPassword));

        return userRepository.save(user);
    }

    private String normalizeIdentifier(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isBlank()) {
            throw new IllegalArgumentException("Vui lòng nhập tài khoản hoặc email.");
        }
        return value;
    }

    private String normalizeUsername(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isBlank()) {
            throw new IllegalArgumentException("Tên đăng nhập không được để trống.");
        }
        return value;
    }

    private String normalizeEmail(String raw) {
        String value = raw == null ? "" : raw.trim().toLowerCase();
        if (value.isBlank()) {
            throw new IllegalArgumentException("Email không được để trống.");
        }
        return value;
    }

    private String normalizeFullName(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isBlank()) {
            throw new IllegalArgumentException("Họ và tên không được để trống.");
        }
        return value;
    }

    private String normalizePhone(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isBlank()) {
            throw new IllegalArgumentException("Số điện thoại không được để trống.");
        }
        return value;
    }

    private String normalizeNullable(String raw) {
        String value = raw == null ? "" : raw.trim();
        return value.isBlank() ? null : value;
    }

    private boolean isLocked(User user) {
        return user != null && user.getLockoutUntil() != null && user.getLockoutUntil().isAfter(LocalDateTime.now());
    }

    private boolean isInactive(User user) {
        return user != null && Boolean.FALSE.equals(user.getActive());
    }

    private String formatLockTime(LocalDateTime lockUntil) {
        if (lockUntil == null) {
            return "một thời gian ngắn";
        }
        return LOCK_TIME_FORMAT.format(lockUntil);
    }

    private void handleFailedLogin(User user) {
        int failed = user.getFailedLoginAttempts() == null ? 0 : user.getFailedLoginAttempts();
        failed += 1;
        user.setFailedLoginAttempts(failed);

        if (failed >= maxFailedAttempts) {
            // tac dung code: dat moc khoa tam de chan tan cong brute-force.
            user.setLockoutUntil(LocalDateTime.now().plusMinutes(lockMinutes));
            user.setFailedLoginAttempts(0);
        }
        userRepository.save(user);
    }
}

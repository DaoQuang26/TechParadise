package com.techstore1.techstore1.service;

import com.techstore1.techstore1.dto.ProfileResponse;
import com.techstore1.techstore1.dto.UpdateProfileRequest;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business logic for customer profile (/api/customer/profile).
 */
@Service
public class ProfileService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public ProfileService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public ProfileResponse getProfile(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản"));
        return toResponse(user);
    }

    @Transactional
    public ProfileResponse updateProfile(String username, UpdateProfileRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản"));

        // Update basic contact fields.
        if (request.getFullName() != null) {
            String fullName = request.getFullName().trim();
            if (fullName.isBlank()) {
                throw new IllegalArgumentException("Họ và tên không được để trống");
            }
            user.setFullName(fullName);
        }
        if (request.getEmail() != null) {
            String email = request.getEmail().trim().toLowerCase();
            if (email.isBlank()) {
                throw new IllegalArgumentException("Email không được để trống");
            }
            userRepository.findByEmailIgnoreCase(email)
                    .filter(existing -> !existing.getId().equals(user.getId()))
                    .ifPresent(existing -> {
                        throw new IllegalArgumentException("Email đã tồn tại");
                    });
            user.setEmail(email);
        }
        if (request.getPhone() != null) {
            String phone = request.getPhone().trim();
            user.setPhone(phone.isBlank() ? null : phone);
        }
        if (request.getAddress() != null) {
            String address = request.getAddress().trim();
            user.setAddress(address.isBlank() ? null : address);
        }

        // Optional password change.
        String newPassword = request.getNewPassword() == null ? "" : request.getNewPassword().trim();
        if (!newPassword.isBlank()) {
            String current = request.getCurrentPassword() == null ? "" : request.getCurrentPassword();
            if (current.isBlank()) {
                throw new IllegalArgumentException("Vui lòng nhập mật khẩu hiện tại");
            }
            if (!passwordEncoder.matches(current, user.getPassword())) {
                throw new IllegalArgumentException("Mật khẩu hiện tại không đúng");
            }
            user.setPassword(passwordEncoder.encode(newPassword));
        }

        return toResponse(userRepository.save(user));
    }

    private ProfileResponse toResponse(User user) {
        return new ProfileResponse(
                user.getUsername(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getAddress(),
                user.getCreatedAt()
        );
    }
}

package com.techstore1.techstore1.dto;

import java.time.LocalDateTime;

/**
 * Public profile information for the logged-in user.
 * <p>
 * We intentionally do not include password.
 */
public record ProfileResponse(
        String username,
        String fullName,
        String email,
        String phone,
        String address,
        LocalDateTime createdAt
) {
}

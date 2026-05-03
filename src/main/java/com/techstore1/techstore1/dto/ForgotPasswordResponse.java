package com.techstore1.techstore1.dto;

/**
 * Response for forgot-password request.
 * <p>
 * resetToken is optional and only exposed in local/dev mode when no email service is integrated.
 */
public record ForgotPasswordResponse(
        String message,
        String resetToken,
        Long expiresInMinutes
) {
}

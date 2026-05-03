package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.AuthResponse;
import com.techstore1.techstore1.dto.ForgotPasswordRequest;
import com.techstore1.techstore1.dto.ForgotPasswordResponse;
import com.techstore1.techstore1.dto.LoginRequest;
import com.techstore1.techstore1.dto.MessageResponse;
import com.techstore1.techstore1.dto.RegisterRequest;
import com.techstore1.techstore1.dto.ResetPasswordRequest;
import com.techstore1.techstore1.dto.VerifyResetTokenRequest;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.service.AuthService;
import com.techstore1.techstore1.service.JwtService;
import com.techstore1.techstore1.service.PasswordResetService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;
    private final PasswordResetService passwordResetService;
    private final String authCookieName;
    private final boolean authCookieSecure;

    public AuthController(
            AuthService authService,
            JwtService jwtService,
            PasswordResetService passwordResetService,
            @Value("${app.auth.cookie-name:TS_ACCESS_TOKEN}") String authCookieName,
            @Value("${app.auth.cookie-secure:false}") boolean authCookieSecure
    ) {
        this.authService = authService;
        this.jwtService = jwtService;
        this.passwordResetService = passwordResetService;
        this.authCookieName = authCookieName;
        this.authCookieSecure = authCookieSecure;
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AuthResponse auth = authService.login(request);

        // Store JWT in HttpOnly cookie so protected HTML routes can be authorized server-side.
        ResponseCookie cookie = ResponseCookie.from(authCookieName, auth.getToken())
                .httpOnly(true)
                .secure(authCookieSecure)
                .sameSite("Lax")
                .path("/")
                .maxAge(jwtService.getExpirationMillis() / 1000)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        return auth;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public User register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletResponse response) {
        // Delete auth cookie on logout request.
        ResponseCookie clearCookie = ResponseCookie.from(authCookieName, "")
                .httpOnly(true)
                .secure(authCookieSecure)
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, clearCookie.toString());
    }

    @PostMapping("/forgot-password")
    public ForgotPasswordResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        // Create reset token for username/email and return generic-safe response.
        return passwordResetService.forgotPassword(request.getIdentifier());
    }

    @PostMapping("/reset-password")
    public MessageResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        // Consume reset token once and update account password with BCrypt.
        String message = passwordResetService.resetPassword(request.getToken(), request.getNewPassword());
        return new MessageResponse(message);
    }

    @PostMapping("/verify-reset-token")
    public MessageResponse verifyResetToken(@Valid @RequestBody VerifyResetTokenRequest request) {
        String message = passwordResetService.verifyResetToken(request.getToken());
        return new MessageResponse(message);
    }
}

package com.techstore1.techstore1.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ForgotPasswordRequest {

    // Username or email provided by user to request reset token.
    @NotBlank(message = "Vui lòng nhập email hoặc tên đăng nhập.")
    private String identifier;
}

package com.techstore1.techstore1.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginRequest {

    @NotBlank(message = "Vui lòng nhập tên đăng nhập hoặc email.")
    private String username;

    @NotBlank(message = "Mật khẩu không được để trống.")
    private String password;
}

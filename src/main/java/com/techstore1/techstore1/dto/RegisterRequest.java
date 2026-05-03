package com.techstore1.techstore1.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterRequest {

    @NotBlank(message = "Tên đăng nhập không được để trống.")
    @Size(min = 3, max = 40, message = "Tên đăng nhập phải từ 3 đến 40 ký tự.")
    private String username;

    @NotBlank(message = "Họ và tên không được để trống.")
    @Size(min = 2, max = 120, message = "Họ và tên phải từ 2 đến 120 ký tự.")
    private String fullName;

    @NotBlank(message = "Email không được để trống.")
    @Email(message = "Email không đúng định dạng.")
    private String email;

    @NotBlank(message = "Mật khẩu không được để trống.")
    @Size(min = 6, max = 100, message = "Mật khẩu phải từ 6 đến 100 ký tự.")
    private String password;

    @NotBlank(message = "Xác nhận mật khẩu không được để trống.")
    @Size(min = 6, max = 100, message = "Xác nhận mật khẩu phải từ 6 đến 100 ký tự.")
    private String confirmPassword;

    @NotBlank(message = "Số điện thoại không được để trống.")
    @Size(min = 8, max = 30, message = "Số điện thoại phải từ 8 đến 30 ký tự.")
    @Pattern(regexp = "^[0-9+()\\-\\s]{8,30}$", message = "Số điện thoại không hợp lệ.")
    private String phone;
    private String address;
}

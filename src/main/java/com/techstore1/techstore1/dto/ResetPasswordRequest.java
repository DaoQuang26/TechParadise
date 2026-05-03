package com.techstore1.techstore1.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ResetPasswordRequest {

    // Raw token delivered to user through email/dev response.
    @NotBlank(message = "Mã đặt lại mật khẩu không được để trống.")
    private String token;

    @NotBlank(message = "Mật khẩu mới không được để trống.")
    @Size(min = 7, max = 100, message = "Mật khẩu mới phải từ 7 đến 100 ký tự.")
    private String newPassword;
}

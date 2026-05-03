package com.techstore1.techstore1.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VerifyResetTokenRequest {

    @NotBlank(message = "Mã đặt lại mật khẩu không được để trống.")
    private String token;
}

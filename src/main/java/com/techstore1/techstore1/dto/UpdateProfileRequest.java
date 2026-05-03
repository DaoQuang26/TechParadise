package com.techstore1.techstore1.dto;

import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Email;
import lombok.Getter;
import lombok.Setter;

/**
 * Update profile payload from /account page.
 * <p>
 * Phone/address are optional. Password change is optional:
 * - if newPassword is provided, currentPassword is required.
 */
@Getter
@Setter
public class UpdateProfileRequest {

    @Size(min = 2, max = 120)
    private String fullName;

    @Email
    @Size(max = 120)
    private String email;

    private String phone;
    private String address;

    private String currentPassword;

    @Size(min = 6, max = 100)
    private String newPassword;
}

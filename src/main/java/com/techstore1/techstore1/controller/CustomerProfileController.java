package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.ProfileResponse;
import com.techstore1.techstore1.dto.UpdateProfileRequest;
import com.techstore1.techstore1.service.ProfileService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customer/profile")
public class CustomerProfileController {

    private final ProfileService profileService;

    public CustomerProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping
    public ProfileResponse me(Authentication authentication) {
        // authentication.getName() là username đã được set bởi JwtFilter (subject của token).
        return profileService.getProfile(authentication.getName());
    }

    @PutMapping
    public ProfileResponse update(@Valid @RequestBody UpdateProfileRequest request, Authentication authentication) {
        // Update số điện thoại/địa chỉ và (tuỳ chọn) đổi mật khẩu.
        return profileService.updateProfile(authentication.getName(), request);
    }
}

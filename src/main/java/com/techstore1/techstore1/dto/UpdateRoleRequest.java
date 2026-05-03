package com.techstore1.techstore1.dto;

import com.techstore1.techstore1.enums.Role;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateRoleRequest {
    @NotNull
    private Role role;
}

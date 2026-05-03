package com.techstore1.techstore1.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateUserActiveRequest {

    @NotNull
    private Boolean active;
}

package com.techstore1.techstore1.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OrderItemRequest {
    @NotNull
    private Long productId;

    // Optional: selected variant id (>0).
    private Long variantId;

    @NotNull
    @Min(1)
    private Integer quantity;
}

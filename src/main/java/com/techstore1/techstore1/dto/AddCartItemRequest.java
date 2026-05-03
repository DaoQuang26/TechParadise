package com.techstore1.techstore1.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AddCartItemRequest {

    @NotNull
    private Long productId;

    // Optional: product variant id (>0). If omitted, backend can auto-select default variant.
    private Long variantId;

    @NotNull
    @Min(1)
    private Integer quantity;
}

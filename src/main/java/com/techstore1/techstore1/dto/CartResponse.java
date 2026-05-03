package com.techstore1.techstore1.dto;

import java.util.List;

public record CartResponse(
        List<CartItemResponse> items,
        Integer totalQuantity,
        Double subtotal
) {
}

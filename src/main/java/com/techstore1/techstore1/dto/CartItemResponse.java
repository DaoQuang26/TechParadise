package com.techstore1.techstore1.dto;

public record CartItemResponse(
        Long productId,
        String productName,
        Long variantId,
        String variantName,
        String imageUrl,
        Double originalPrice,
        Double discountPercent,
        Double price,
        Integer stock,
        Integer quantity,
        Double lineTotal
) {
}

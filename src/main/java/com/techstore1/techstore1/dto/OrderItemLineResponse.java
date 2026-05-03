package com.techstore1.techstore1.dto;

/**
 * One line item in an order detail response.
 */
public record OrderItemLineResponse(
        Long productId,
        String productName,
        Long variantId,
        String variantName,
        String imageUrl,
        Double unitPrice,
        Integer quantity,
        Double lineTotal
) {
}

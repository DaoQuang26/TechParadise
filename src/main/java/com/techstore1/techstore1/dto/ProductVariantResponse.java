package com.techstore1.techstore1.dto;

import java.time.LocalDateTime;

// tac dung code: du lieu bien the tra ve cho giao dien storefront/admin.
public record ProductVariantResponse(
        Long id,
        Long productId,
        String name,
        String sku,
        Double price,
        Integer stock,
        String imageUrl,
        Integer sortOrder,
        LocalDateTime updatedAt
) {
}


package com.techstore1.techstore1.dto;

import java.time.LocalDateTime;

// tac dung code: ban ghi danh gia hien thi trong danh sach review cua trang chi tiet san pham.
public record ProductReviewResponse(
        Long id,
        Long productId,
        Long userId,
        String username,
        String fullName,
        Integer rating,
        String content,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        boolean mine
) {
}

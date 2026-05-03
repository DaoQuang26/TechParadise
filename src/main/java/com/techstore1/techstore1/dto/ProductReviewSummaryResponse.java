package com.techstore1.techstore1.dto;

// tac dung code: tong hop nhanh diem trung binh + so luong review + quyen danh gia cua user hien tai.
public record ProductReviewSummaryResponse(
        Long productId,
        long totalReviews,
        double averageRating,
        long oneStar,
        long twoStar,
        long threeStar,
        long fourStar,
        long fiveStar,
        boolean canReview,
        boolean hasReviewed
) {
}


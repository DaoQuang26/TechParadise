package com.techstore1.techstore1.dto;

import java.util.List;

// tac dung code: payload review AI tom tat uu/nhuoc diem cho tung san pham.
public record AiProductReviewResponse(
        Long productId,
        String productName,
        String useCase,
        String model,
        String generatedBy,
        Integer score,
        String scoreReason,
        String summary,
        List<String> strengths,
        List<String> weaknesses,
        String detailedEvaluation,
        List<String> predictedPerformance,
        String valueAndComparison,
        String conclusion,
        String recommendation,
        String caution
) {
}

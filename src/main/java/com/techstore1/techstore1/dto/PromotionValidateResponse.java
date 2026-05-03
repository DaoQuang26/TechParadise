package com.techstore1.techstore1.dto;

/**
 * Response for validating a promotion code on the checkout page.
 * <p>
 * We keep it minimal: the frontend only needs the percent and a user-friendly message.
 */
public record PromotionValidateResponse(
        String code,
        Integer discountPercent,
        String message
)
{
}


package com.techstore1.techstore1.service;

import org.springframework.stereotype.Service;

@Service
// tac dung code: dong bo cong thuc gia ban cuoi cung tu gia goc + % khuyen mai cho toan bo he thong.
public class ProductPricingService {

    public double normalizePrice(Double rawPrice) {
        if (rawPrice == null || !Double.isFinite(rawPrice) || rawPrice < 0D) {
            return 0D;
        }
        return rawPrice;
    }

    public double normalizeDiscountPercent(Double rawDiscountPercent) {
        if (rawDiscountPercent == null || !Double.isFinite(rawDiscountPercent)) {
            return 0D;
        }
        double bounded = Math.max(0D, Math.min(100D, rawDiscountPercent));
        return Math.round(bounded * 100.0) / 100.0;
    }

    public double calculateDiscountedPrice(Double rawPrice, Double rawDiscountPercent) {
        double originalPrice = normalizePrice(rawPrice);
        double discountPercent = normalizeDiscountPercent(rawDiscountPercent);
        if (discountPercent <= 0D) {
            return originalPrice;
        }

        // Round to VND unit to keep checkout/order totals stable across backend/frontend.
        return Math.max(0D, Math.round(originalPrice * (100D - discountPercent) / 100D));
    }
}

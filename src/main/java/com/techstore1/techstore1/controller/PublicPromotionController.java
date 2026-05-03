package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.PromotionValidateResponse;
import com.techstore1.techstore1.service.PromotionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public endpoints for the storefront (no login required).
 */
@RestController
@RequestMapping("/api/public/promotions")
public class PublicPromotionController {

    private final PromotionService promotionService;

    public PublicPromotionController(PromotionService promotionService) {
        this.promotionService = promotionService;
    }

    @GetMapping("/validate")
    public PromotionValidateResponse validate(@RequestParam String code) {
        // Validate promotion code for the checkout page.
        // If invalid, PromotionService will throw IllegalArgumentException (handled by GlobalExceptionHandler).
        return promotionService.validateCode(code);
    }
}


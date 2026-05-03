package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.AiProductReviewResponse;
import com.techstore1.techstore1.dto.PageResponse;
import com.techstore1.techstore1.dto.ProductReviewResponse;
import com.techstore1.techstore1.dto.ProductReviewSummaryResponse;
import com.techstore1.techstore1.dto.ProductVariantResponse;
import com.techstore1.techstore1.entity.Product;
import com.techstore1.techstore1.service.AiProductReviewService;
import com.techstore1.techstore1.service.AiRateLimitService;
import com.techstore1.techstore1.service.ProductService;
import com.techstore1.techstore1.service.ProductReviewService;
import com.techstore1.techstore1.service.ProductVariantService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/public/products")
public class ProductController {

    private final AiProductReviewService aiProductReviewService;
    private final AiRateLimitService aiRateLimitService;
    private final ProductService productService;
    private final ProductVariantService productVariantService;
    private final ProductReviewService productReviewService;

    public ProductController(
            AiProductReviewService aiProductReviewService,
            AiRateLimitService aiRateLimitService,
            ProductService productService,
            ProductVariantService productVariantService,
            ProductReviewService productReviewService
    ) {
        this.aiProductReviewService = aiProductReviewService;
        this.aiRateLimitService = aiRateLimitService;
        this.productService = productService;
        this.productVariantService = productVariantService;
        this.productReviewService = productReviewService;
    }

    @GetMapping
    public List<Product> getAllProducts(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long categoryId
    ) {
        return productService.getPublicProducts(keyword, categoryId);
    }

    @GetMapping("/paged")
    public PageResponse<Product> getAllProductsPaged(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size
    ) {
        // New paged endpoint for modern storefront UIs that support "load more".
        return PageResponse.from(productService.getPublicProductsPaged(keyword, categoryId, page, size));
    }

    @GetMapping("/{id}")
    public Product getProductById(@PathVariable Long id) {
        return productService.getProductById(id);
    }

    @GetMapping("/{id}/variants")
    public List<ProductVariantResponse> getProductVariants(@PathVariable Long id) {
        return productVariantService.getByProductId(id);
    }

    @GetMapping("/{id}/reviews")
    public List<ProductReviewResponse> getProductReviews(
            @PathVariable Long id,
            Authentication authentication
    ) {
        String username = authentication == null ? null : authentication.getName();
        return productReviewService.getPublicReviews(id, username);
    }

    @GetMapping("/{id}/review-summary")
    public ProductReviewSummaryResponse getReviewSummary(
            @PathVariable Long id,
            Authentication authentication
    ) {
        String username = authentication == null ? null : authentication.getName();
        return productReviewService.getReviewSummary(id, username);
    }

    @GetMapping("/{id}/ai-review")
    public AiProductReviewResponse getAiReview(
            @PathVariable Long id,
            @RequestParam(required = false) String useCase,
            Authentication authentication,
            HttpServletRequest request
    ) {
        aiRateLimitService.checkLimitOrThrow(buildAiActorKey(authentication, request));
        return aiProductReviewService.generateProductReview(id, useCase);
    }

    private String buildAiActorKey(Authentication authentication, HttpServletRequest request) {
        if (authentication != null && authentication.getName() != null && !authentication.getName().trim().isBlank()
                && !"anonymousUser".equalsIgnoreCase(authentication.getName())) {
            return "user:" + authentication.getName().trim().toLowerCase(Locale.ROOT);
        }

        String ip = request == null ? "" : request.getRemoteAddr();
        if (ip == null || ip.trim().isBlank()) {
            return "ip:unknown";
        }
        return "ip:" + ip.trim();
    }
}

package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.MessageResponse;
import com.techstore1.techstore1.dto.ProductReviewRequest;
import com.techstore1.techstore1.dto.ProductReviewResponse;
import com.techstore1.techstore1.service.ProductReviewService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customer/products/{productId}/reviews")
// tac dung code: API khach hang gui/cap nhat/xoa danh gia cho san pham da mua.
public class CustomerProductReviewController {

    private final ProductReviewService productReviewService;

    public CustomerProductReviewController(ProductReviewService productReviewService) {
        this.productReviewService = productReviewService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductReviewResponse upsertReview(
            @PathVariable Long productId,
            @Valid @RequestBody ProductReviewRequest request,
            Authentication authentication
    ) {
        return productReviewService.upsertMyReview(productId, requireUsername(authentication), request);
    }

    @DeleteMapping("/me")
    public MessageResponse deleteMyReview(
            @PathVariable Long productId,
            Authentication authentication
    ) {
        productReviewService.deleteMyReview(productId, requireUsername(authentication));
        return new MessageResponse("Đã xóa đánh giá");
    }

    private String requireUsername(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()
                || "anonymousUser".equalsIgnoreCase(authentication.getName())) {
            throw new IllegalArgumentException("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        }
        return authentication.getName();
    }
}

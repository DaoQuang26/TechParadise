package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.PageResponse;
import com.techstore1.techstore1.dto.ProductVariantRequest;
import com.techstore1.techstore1.dto.ProductVariantResponse;
import com.techstore1.techstore1.entity.Product;
import com.techstore1.techstore1.service.AdminAuditLogService;
import com.techstore1.techstore1.service.ProductService;
import com.techstore1.techstore1.service.ProductVariantService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/products")
// tac dung code: API quan tri CRUD san pham + phan trang danh sach san pham admin.
public class AdminProductController {

    private final ProductService productService;
    private final ProductVariantService productVariantService;
    private final AdminAuditLogService adminAuditLogService;

    public AdminProductController(
            ProductService productService,
            ProductVariantService productVariantService,
            AdminAuditLogService adminAuditLogService
    ) {
        this.productService = productService;
        this.productVariantService = productVariantService;
        this.adminAuditLogService = adminAuditLogService;
    }

    @GetMapping("/paged")
    public PageResponse<Product> getPagedProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "asc") String sortDir
    ) {
        // Dedicated admin endpoint for paged product table in dashboard.
        return PageResponse.from(productService.getAdminProductsPaged(keyword, categoryId, page, size, sortDir));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Product createProduct(
            @RequestBody Product product,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Product created = productService.createProduct(product);
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "PRODUCT_CREATE",
                "PRODUCT",
                created.getId(),
                "Tao san pham " + created.getName(),
                resolveClientIp(request)
        );
        return created;
    }

    @PutMapping("/{id}")
    public Product updateProduct(
            @PathVariable Long id,
            @RequestBody Product product,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Product updated = productService.updateProduct(id, product);
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "PRODUCT_UPDATE",
                "PRODUCT",
                id,
                "Cap nhat san pham " + updated.getName(),
                resolveClientIp(request)
        );
        return updated;
    }

    @GetMapping("/{id}/variants")
    public List<ProductVariantResponse> getProductVariants(@PathVariable Long id) {
        return productVariantService.getByProductId(id);
    }

    @PutMapping("/{id}/variants")
    public List<ProductVariantResponse> replaceVariants(
            @PathVariable Long id,
            @RequestBody(required = false) List<ProductVariantRequest> requests,
            Authentication authentication,
            HttpServletRequest request
    ) {
        List<ProductVariantResponse> saved = productVariantService.replaceProductVariants(id, requests);
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "PRODUCT_VARIANT_UPDATE",
                "PRODUCT",
                id,
                "Cap nhat bien the san pham",
                resolveClientIp(request)
        );
        return saved;
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProduct(
            @PathVariable Long id,
            Authentication authentication,
            HttpServletRequest request
    ) {
        productService.deleteProduct(id);
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "PRODUCT_DELETE",
                "PRODUCT",
                id,
                "Xoa san pham",
                resolveClientIp(request)
        );
    }

    private String resolveActorRole(Authentication authentication) {
        if (authentication == null || authentication.getAuthorities() == null) {
            return null;
        }
        return authentication.getAuthorities().stream()
                .findFirst()
                .map(granted -> granted.getAuthority())
                .orElse(null);
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}

package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.entity.Category;
import com.techstore1.techstore1.service.AdminAuditLogService;
import com.techstore1.techstore1.service.CategoryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class CategoryController {

    private final CategoryService categoryService;
    private final AdminAuditLogService adminAuditLogService;

    public CategoryController(CategoryService categoryService, AdminAuditLogService adminAuditLogService) {
        this.categoryService = categoryService;
        this.adminAuditLogService = adminAuditLogService;
    }

    @GetMapping("/api/public/categories")
    public List<Category> getAll() {
        return categoryService.findAll();
    }

    @PostMapping("/api/admin/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public Category create(
            @RequestBody Category category,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Category created = categoryService.create(category);
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "CATEGORY_CREATE",
                "CATEGORY",
                created.getId(),
                "Tao danh muc " + created.getName(),
                resolveClientIp(request)
        );
        return created;
    }

    @PutMapping("/api/admin/categories/{id}")
    public Category update(
            @PathVariable Long id,
            @RequestBody Category category,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Category updated = categoryService.update(id, category);
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "CATEGORY_UPDATE",
                "CATEGORY",
                id,
                "Cap nhat danh muc " + updated.getName(),
                resolveClientIp(request)
        );
        return updated;
    }

    @DeleteMapping("/api/admin/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable Long id,
            Authentication authentication,
            HttpServletRequest request
    ) {
        categoryService.delete(id);
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "CATEGORY_DELETE",
                "CATEGORY",
                id,
                "Xoa danh muc",
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

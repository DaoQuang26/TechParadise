package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.entity.Promotion;
import com.techstore1.techstore1.service.AdminAuditLogService;
import com.techstore1.techstore1.service.PromotionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/promotions")
public class PromotionController {

    private final PromotionService promotionService;
    private final AdminAuditLogService adminAuditLogService;

    public PromotionController(PromotionService promotionService, AdminAuditLogService adminAuditLogService) {
        this.promotionService = promotionService;
        this.adminAuditLogService = adminAuditLogService;
    }

    @GetMapping
    public List<Promotion> findAll() {
        return promotionService.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Promotion create(
            @RequestBody Promotion promotion,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Promotion created = promotionService.create(promotion);
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "PROMOTION_CREATE",
                "PROMOTION",
                created.getId(),
                "Tao khuyen mai " + created.getCode(),
                resolveClientIp(request)
        );
        return created;
    }

    @PutMapping("/{id}")
    public Promotion update(
            @PathVariable Long id,
            @RequestBody Promotion promotion,
            Authentication authentication,
            HttpServletRequest request
    ) {
        Promotion updated = promotionService.update(id, promotion);
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "PROMOTION_UPDATE",
                "PROMOTION",
                id,
                "Cap nhat khuyen mai " + updated.getCode(),
                resolveClientIp(request)
        );
        return updated;
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable Long id,
            Authentication authentication,
            HttpServletRequest request
    ) {
        promotionService.delete(id);
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "PROMOTION_DELETE",
                "PROMOTION",
                id,
                "Xoa khuyen mai",
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

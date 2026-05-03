package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.entity.HomeBanner;
import com.techstore1.techstore1.service.AdminAuditLogService;
import com.techstore1.techstore1.service.HomeBannerService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class HomeBannerController {

    private final HomeBannerService homeBannerService;
    private final AdminAuditLogService adminAuditLogService;

    public HomeBannerController(
            HomeBannerService homeBannerService,
            AdminAuditLogService adminAuditLogService
    ) {
        this.homeBannerService = homeBannerService;
        this.adminAuditLogService = adminAuditLogService;
    }

    @GetMapping("/api/public/banners/home")
    public List<HomeBanner> getPublicHomeBanners() {
        return homeBannerService.findPublicHomeBanners();
    }

    @GetMapping("/api/admin/banners/home")
    public List<HomeBanner> getAdminHomeBanners() {
        return homeBannerService.findAdminHomeBanners();
    }

    @PostMapping("/api/admin/banners/home")
    @ResponseStatus(HttpStatus.CREATED)
    public HomeBanner createHomeBanner(
            @RequestBody HomeBanner request,
            Authentication authentication,
            HttpServletRequest servletRequest
    ) {
        HomeBanner created = homeBannerService.create(request);
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "BANNER_CREATE",
                "HOME_BANNER",
                created.getId(),
                "Thêm banner trang chủ",
                resolveClientIp(servletRequest)
        );
        return created;
    }

    @PutMapping("/api/admin/banners/home/{id}")
    public HomeBanner updateHomeBanner(
            @PathVariable Long id,
            @RequestBody HomeBanner request,
            Authentication authentication,
            HttpServletRequest servletRequest
    ) {
        HomeBanner updated = homeBannerService.update(id, request);
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "BANNER_UPDATE",
                "HOME_BANNER",
                id,
                "Cập nhật banner trang chủ",
                resolveClientIp(servletRequest)
        );
        return updated;
    }

    @DeleteMapping("/api/admin/banners/home/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHomeBanner(
            @PathVariable Long id,
            Authentication authentication,
            HttpServletRequest servletRequest
    ) {
        homeBannerService.delete(id);
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "BANNER_DELETE",
                "HOME_BANNER",
                id,
                "Xóa banner trang chủ",
                resolveClientIp(servletRequest)
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

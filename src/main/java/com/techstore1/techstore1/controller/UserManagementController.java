package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.AdminCreateUserRequest;
import com.techstore1.techstore1.dto.AdminUpdateUserRequest;
import com.techstore1.techstore1.dto.PageResponse;
import com.techstore1.techstore1.dto.UpdateRoleRequest;
import com.techstore1.techstore1.dto.UpdateUserActiveRequest;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.service.AdminAuditLogService;
import com.techstore1.techstore1.service.UserManagementService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class UserManagementController {

    private final UserManagementService userManagementService;
    private final AdminAuditLogService adminAuditLogService;

    public UserManagementController(
            UserManagementService userManagementService,
            AdminAuditLogService adminAuditLogService
    ) {
        this.userManagementService = userManagementService;
        this.adminAuditLogService = adminAuditLogService;
    }

    @GetMapping("/api/admin/users")
    public List<User> allUsers() {
        return userManagementService.findAllUsers();
    }

    @GetMapping("/api/admin/users/paged")
    public PageResponse<User> allUsersPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "asc") String sortDir
    ) {
        // Provide paged response for admin table (supports large user datasets).
        return PageResponse.from(userManagementService.findUsersPaged(page, size, keyword, sortDir));
    }

    @GetMapping("/api/admin/users/{id}")
    public User userDetail(@PathVariable Long id) {
        return userManagementService.findUserById(id);
    }

    @PostMapping("/api/admin/users")
    @ResponseStatus(HttpStatus.CREATED)
    public User createUser(
            @Valid @RequestBody AdminCreateUserRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        boolean canCreateAdmin = hasAuthority(authentication, "ROLE_SUPER_ADMIN");
        User created = userManagementService.createUser(request, canCreateAdmin);

        String actor = authentication != null ? authentication.getName() : "admin";
        adminAuditLogService.logAction(
                actor,
                resolveActorRole(authentication),
                "USER_CREATE",
                "USER",
                created.getId(),
                "Tao tai khoan " + created.getUsername() + " voi role " + created.getRole(),
                resolveClientIp(httpRequest)
        );
        return created;
    }

    @PutMapping("/api/admin/users/{id}")
    public User updateUserInfo(
            @PathVariable Long id,
            @Valid @RequestBody AdminUpdateUserRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        User updated = userManagementService.updateUserInfo(id, request);
        String actor = authentication != null ? authentication.getName() : "admin";
        adminAuditLogService.logAction(
                actor,
                resolveActorRole(authentication),
                "USER_UPDATE",
                "USER",
                id,
                "Cap nhat thong tin tai khoan",
                resolveClientIp(httpRequest)
        );
        return updated;
    }

    @DeleteMapping("/api/admin/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCustomer(
            @PathVariable Long id,
            Authentication authentication,
            HttpServletRequest request
    ) {
        userManagementService.deleteCustomer(id);
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "USER_DELETE",
                "USER",
                id,
                "Xoa tai khoan khach hang",
                resolveClientIp(request)
        );
    }

    @PutMapping("/api/super-admin/users/{id}/role")
    public User updateRole(
            @PathVariable Long id,
            @Valid @RequestBody UpdateRoleRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        User updated = userManagementService.updateRole(id, request.getRole());
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "USER_ROLE_UPDATE",
                "USER",
                id,
                "Cap nhat role thanh " + request.getRole(),
                resolveClientIp(httpRequest)
        );
        return updated;
    }

    @PutMapping("/api/admin/users/{id}/active")
    public User updateActiveStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserActiveRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        boolean actorIsSuperAdmin = hasAuthority(authentication, "ROLE_SUPER_ADMIN");
        String actor = authentication != null ? authentication.getName() : "admin";
        boolean nextActive = Boolean.TRUE.equals(request.getActive());

        User updated = userManagementService.updateActiveStatus(id, nextActive, actorIsSuperAdmin, actor);
        adminAuditLogService.logAction(
                actor,
                resolveActorRole(authentication),
                "USER_ACTIVE_UPDATE",
                "USER",
                id,
                nextActive
                        ? "Bat trang thai hoat dong tai khoan"
                        : "Tat trang thai hoat dong tai khoan",
                resolveClientIp(httpRequest)
        );
        return updated;
    }

    @PostMapping("/api/admin/users/{id}/unlock")
    public User unlockUser(
            @PathVariable Long id,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        boolean actorIsSuperAdmin = hasAuthority(authentication, "ROLE_SUPER_ADMIN");
        String actor = authentication != null ? authentication.getName() : "admin";
        User updated = userManagementService.unlockUser(id, actorIsSuperAdmin);

        adminAuditLogService.logAction(
                actor,
                resolveActorRole(authentication),
                "USER_UNLOCK",
                "USER",
                id,
                "Mo khoa tai khoan sau nhieu lan dang nhap sai",
                resolveClientIp(httpRequest)
        );
        return updated;
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

    private boolean hasAuthority(Authentication authentication, String authority) {
        if (authentication == null || authentication.getAuthorities() == null || authority == null || authority.isBlank()) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .anyMatch(item -> authority.equalsIgnoreCase(item.getAuthority()));
    }
}

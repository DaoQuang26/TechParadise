package com.techstore1.techstore1.service;

import com.techstore1.techstore1.dto.AdminAuditLogResponse;
import com.techstore1.techstore1.dto.PageResponse;
import com.techstore1.techstore1.entity.AdminAuditLog;
import com.techstore1.techstore1.repository.AdminAuditLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
// tac dung code: nghiep vu ghi/tra cuu nhat ky quan tri cho truy vet va kiem toan thao tac.
public class AdminAuditLogService {

    private final AdminAuditLogRepository adminAuditLogRepository;

    public AdminAuditLogService(AdminAuditLogRepository adminAuditLogRepository) {
        this.adminAuditLogRepository = adminAuditLogRepository;
    }

    @Transactional
    public void logAction(
            String actorUsername,
            String actorRole,
            String action,
            String targetType,
            Long targetId,
            String message,
            String ipAddress
    ) {
        if (isBlank(action) || isBlank(targetType)) {
            return;
        }

        AdminAuditLog log = new AdminAuditLog();
        log.setActorUsername(isBlank(actorUsername) ? "unknown" : actorUsername.trim());
        log.setActorRole(trimOrNull(actorRole));
        log.setAction(action.trim().toUpperCase());
        log.setTargetType(targetType.trim().toUpperCase());
        log.setTargetId(targetId);
        log.setMessage(limitLength(trimOrNull(message), 1000));
        log.setIpAddress(limitLength(trimOrNull(ipAddress), 64));
        adminAuditLogRepository.save(log);
    }

    public PageResponse<AdminAuditLogResponse> searchPaged(
            int page,
            int size,
            String keyword,
            String action,
            String targetType
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<AdminAuditLogResponse> mapped = adminAuditLogRepository
                .searchAdminAuditLogs(trimOrNull(action), trimOrNull(targetType), trimOrNull(keyword), pageable)
                .map(this::toResponse);

        return PageResponse.from(mapped);
    }

    private AdminAuditLogResponse toResponse(AdminAuditLog log) {
        return new AdminAuditLogResponse(
                log.getId(),
                log.getActorUsername(),
                log.getActorRole(),
                log.getAction(),
                log.getTargetType(),
                log.getTargetId(),
                log.getMessage(),
                log.getIpAddress(),
                log.getCreatedAt()
        );
    }

    private String trimOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isBlank();
    }

    private String limitLength(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}


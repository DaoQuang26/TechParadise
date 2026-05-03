package com.techstore1.techstore1.dto;

import java.time.LocalDateTime;

// tac dung code: DTO tra ve cho man hinh admin xem nhat ky thao tac quan tri.
public record AdminAuditLogResponse(
        Long id,
        String actorUsername,
        String actorRole,
        String action,
        String targetType,
        Long targetId,
        String message,
        String ipAddress,
        LocalDateTime createdAt
) {
}


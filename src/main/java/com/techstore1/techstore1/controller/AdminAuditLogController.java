package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.AdminAuditLogResponse;
import com.techstore1.techstore1.dto.PageResponse;
import com.techstore1.techstore1.service.AdminAuditLogService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/audit-logs")
// tac dung code: API cho admin xem lich su thao tac quan tri co phan trang/bo loc.
public class AdminAuditLogController {

    private final AdminAuditLogService adminAuditLogService;

    public AdminAuditLogController(AdminAuditLogService adminAuditLogService) {
        this.adminAuditLogService = adminAuditLogService;
    }

    @GetMapping("/paged")
    public PageResponse<AdminAuditLogResponse> searchPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String targetType
    ) {
        return adminAuditLogService.searchPaged(page, size, keyword, action, targetType);
    }
}


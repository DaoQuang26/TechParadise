package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.PageResponse;
import com.techstore1.techstore1.dto.PaymentAuditSummaryResponse;
import com.techstore1.techstore1.enums.OnlinePaymentStatus;
import com.techstore1.techstore1.service.AdminPaymentAuditService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/payments")
// tac dung code: API cho admin xem nhat ky giao dich thanh toan online theo bo loc.
public class AdminPaymentController {

    private final AdminPaymentAuditService adminPaymentAuditService;

    public AdminPaymentController(AdminPaymentAuditService adminPaymentAuditService) {
        this.adminPaymentAuditService = adminPaymentAuditService;
    }

    @GetMapping("/paged")
    public PageResponse<PaymentAuditSummaryResponse> searchPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String provider,
            @RequestParam(required = false) OnlinePaymentStatus status
    ) {
        return adminPaymentAuditService.searchPayments(page, size, keyword, provider, status);
    }
}

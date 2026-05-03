package com.techstore1.techstore1.service;

import com.techstore1.techstore1.dto.PageResponse;
import com.techstore1.techstore1.dto.PaymentAuditSummaryResponse;
import com.techstore1.techstore1.entity.Order;
import com.techstore1.techstore1.enums.OnlinePaymentStatus;
import com.techstore1.techstore1.repository.OrderRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
// tac dung code: nghiep vu audit giao dich thanh toan online cho man hinh quan tri.
public class AdminPaymentAuditService {

    private final OrderRepository orderRepository;

    public AdminPaymentAuditService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public PageResponse<PaymentAuditSummaryResponse> searchPayments(
            int page,
            int size,
            String keyword,
            String provider,
            OnlinePaymentStatus onlineStatus
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));

        String normalizedKeyword = normalizeQueryParam(keyword);
        String normalizedProvider = normalizeQueryParam(provider);

        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<PaymentAuditSummaryResponse> mapped = orderRepository
                .searchAdminPayments(normalizedProvider, onlineStatus, normalizedKeyword, pageable)
                .map(this::toSummary);

        return PageResponse.from(mapped);
    }

    private PaymentAuditSummaryResponse toSummary(Order order) {
        return new PaymentAuditSummaryResponse(
                order.getId(),
                order.getUser() != null ? order.getUser().getUsername() : null,
                order.getTotalPrice(),
                order.getPaymentProvider(),
                order.getPaymentReference(),
                order.getOnlinePaymentStatus(),
                order.getStatus(),
                order.getCreatedAt(),
                order.getPaidAt()
        );
    }

    private String normalizeQueryParam(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }
}

package com.techstore1.techstore1.dto;

import com.techstore1.techstore1.enums.OnlinePaymentStatus;
import com.techstore1.techstore1.enums.OrderStatus;

import java.time.LocalDateTime;

// tac dung code: dong du lieu audit giao dich thanh toan online de admin render bang theo trang.
public record PaymentAuditSummaryResponse(
        Long orderId,
        String customerUsername,
        Double totalPrice,
        String paymentProvider,
        String paymentReference,
        OnlinePaymentStatus onlinePaymentStatus,
        OrderStatus orderStatus,
        LocalDateTime createdAt,
        LocalDateTime paidAt
) {
}

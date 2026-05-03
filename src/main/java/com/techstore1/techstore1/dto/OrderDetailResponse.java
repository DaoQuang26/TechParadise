package com.techstore1.techstore1.dto;

import com.techstore1.techstore1.enums.OnlinePaymentStatus;
import com.techstore1.techstore1.enums.OrderStatus;
import com.techstore1.techstore1.enums.PaymentMethod;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Order detail DTO for customer/admin UI.
 * <p>
 * Returning DTO avoids LazyInitializationException with open-in-view disabled.
 */
// tac dung code: bo sung thong tin thanh toan online de hien thi o trang chi tiet don va admin modal.
public record OrderDetailResponse(
        Long id,
        String customerUsername,
        OrderStatus status,
        String cancelRequestReason,
        LocalDateTime cancelRequestedAt,
        LocalDateTime createdAt,
        String recipientName,
        String recipientPhone,
        String shippingAddress,
        PaymentMethod paymentMethod,
        OnlinePaymentStatus onlinePaymentStatus,
        String paymentProvider,
        String paymentReference,
        LocalDateTime paidAt,
        LocalDateTime reservationExpiresAt,
        Double subtotalPrice,
        Double discountAmount,
        Integer discountPercent,
        String promotionCode,
        Double totalPrice,
        List<OrderItemLineResponse> items,
        List<OrderStatusHistoryResponse> statusHistory
) {
}

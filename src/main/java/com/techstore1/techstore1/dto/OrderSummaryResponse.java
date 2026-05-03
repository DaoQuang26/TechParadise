package com.techstore1.techstore1.dto;

import com.techstore1.techstore1.enums.OnlinePaymentStatus;
import com.techstore1.techstore1.enums.OrderStatus;
import com.techstore1.techstore1.enums.PaymentMethod;

import java.time.LocalDateTime;

/**
 * API DTO for showing orders in the UI.
 * <p>
 * We return DTOs instead of JPA entities because the project sets
 * {@code spring.jpa.open-in-view=false}. That means lazy relations (like
 * {@code Order.items}) cannot be initialized during JSON serialization and would
 * crash with {@code LazyInitializationException}.
 */
public record OrderSummaryResponse(
        Long id,
        String customerUsername,
        Double totalPrice,
        OrderStatus status,
        LocalDateTime createdAt,
        PaymentMethod paymentMethod,
        OnlinePaymentStatus onlinePaymentStatus,
        String paymentProvider,
        String paymentReference,
        LocalDateTime paidAt
) {
}

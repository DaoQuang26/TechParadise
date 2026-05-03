package com.techstore1.techstore1.dto;

import com.techstore1.techstore1.enums.OrderStatus;

import java.time.LocalDateTime;

/**
 * Timeline line for order status history, used by admin and customer detail pages.
 */
public record OrderStatusHistoryResponse(
        OrderStatus fromStatus,
        OrderStatus toStatus,
        String note,
        String changedBy,
        LocalDateTime createdAt
) {
}

package com.techstore1.techstore1.dto;

import com.techstore1.techstore1.enums.OnlinePaymentStatus;

/**
 * Public payload for mock payment checkout page.
 */
// tac dung code: dong goi thong tin don + chu ky webhook de UI mock gui callback hop le.
public record MockPaymentSessionResponse(
        Long orderId,
        String paymentReference,
        Double totalPrice,
        String customerUsername,
        OnlinePaymentStatus onlinePaymentStatus,
        String paidSignature,
        String failedSignature
) {
}

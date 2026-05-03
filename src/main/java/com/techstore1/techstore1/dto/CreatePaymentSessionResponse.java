package com.techstore1.techstore1.dto;

/**
 * Response for creating online payment session.
 */
// tac dung code: tra URL redirect sang cong thanh toan online va thong tin phien.
public record CreatePaymentSessionResponse(
        Long orderId,
        String paymentReference,
        String provider,
        String checkoutUrl
) {
}

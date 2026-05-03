package com.techstore1.techstore1.dto;

// tac dung code: thong bao ket qua xu ly webhook va URL redirect ve trang don.
public record MockPaymentWebhookResponse(
        String message,
        String redirectUrl
) {
}

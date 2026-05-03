package com.techstore1.techstore1.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
// tac dung code: du lieu callback tu cong thanh toan gia lap (mock webhook).
public class MockPaymentWebhookRequest {

    // tác dụng code: paymentReference de map callback vao dung don.
    @NotBlank
    private String paymentReference;

    // tác dụng code: trang thai callback tu cong thanh toan ("PAID" | "FAILED").
    @NotBlank
    private String status;

    // tác dụng code: chu ky HMAC giup webhook khong bi gia mao.
    @NotBlank
    private String signature;
}

package com.techstore1.techstore1.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
// tac dung code: payload tao phien thanh toan online cho don hang.
public class CreatePaymentSessionRequest {

    // tac dung code: id don hang can tao phien thanh toan online.
    @NotNull
    private Long orderId;

    // tac dung code: provider cho phep MOCK/MOCK_GATEWAY/VNPAY/MOMO; mac dinh MOCK de tranh loi parse enum.
    private String provider = "MOCK";
}

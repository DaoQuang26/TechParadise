package com.techstore1.techstore1.enums;

/**
 * Payment method used for an order.
 */
public enum PaymentMethod {
    // tac dung code: COD = thanh toan khi nhan hang.
    COD,

    // tac dung code: BANK_TRANSFER = chuyen khoan thu cong.
    BANK_TRANSFER,

    // tac dung code: ONLINE_GATEWAY = thanh toan qua cong online (mock webhook).
    ONLINE_GATEWAY
}

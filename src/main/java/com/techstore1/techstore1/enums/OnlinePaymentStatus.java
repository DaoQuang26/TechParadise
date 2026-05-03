package com.techstore1.techstore1.enums;

public enum OnlinePaymentStatus {
    // tac dung code: NOT_REQUIRED = don khong dung cong thanh toan online.
    NOT_REQUIRED,

    // tac dung code: PENDING = da tao phien thanh toan nhung chua nhan webhook.
    PENDING,

    // tac dung code: PAID = webhook bao thanh toan thanh cong.
    PAID,

    // tac dung code: FAILED = webhook bao thanh toan that bai.
    FAILED
}

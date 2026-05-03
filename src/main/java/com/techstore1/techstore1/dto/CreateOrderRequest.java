package com.techstore1.techstore1.dto;

import com.techstore1.techstore1.enums.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class CreateOrderRequest {

    @NotEmpty
    @Valid
    private List<OrderItemRequest> items;

    @Size(max = 120)
    private String recipientName;

    @Size(max = 30)
    @Pattern(regexp = "^[0-9+()\\-\\s]*$", message = "Số điện thoại người nhận không hợp lệ.")
    private String recipientPhone;

    private String shippingAddress;

    // Optional: mã khuyến mãi user nhập ở trang thanh toán.
    private String promotionCode;

    // Optional: phương thức thanh toán (mặc định COD nếu không gửi).
    private PaymentMethod paymentMethod;
}

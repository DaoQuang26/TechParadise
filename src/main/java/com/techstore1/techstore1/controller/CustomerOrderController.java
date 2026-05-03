package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.CancelOrderRequest;
import com.techstore1.techstore1.dto.CreateOrderRequest;
import com.techstore1.techstore1.dto.OrderDetailResponse;
import com.techstore1.techstore1.dto.OrderSummaryResponse;
import com.techstore1.techstore1.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/customer/orders")
public class CustomerOrderController {

    private final OrderService orderService;

    public CustomerOrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderSummaryResponse createOrder(@Valid @RequestBody CreateOrderRequest request, Authentication authentication) {
        return orderService.createOrderSummary(requireUsername(authentication), request);
    }

    @GetMapping
    public List<OrderSummaryResponse> myOrders(Authentication authentication) {
        return orderService.findSummariesByUser(requireUsername(authentication));
    }

    @GetMapping("/{id}")
    public OrderDetailResponse myOrderDetail(@PathVariable Long id, Authentication authentication) {
        return orderService.getOrderDetailForUser(requireUsername(authentication), id);
    }

    @PatchMapping("/{id}/cancel")
    public OrderDetailResponse cancel(
            @PathVariable Long id,
            @RequestBody(required = false) @Valid CancelOrderRequest request,
            Authentication authentication
    ) {
        String reason = request == null ? null : request.getReason();
        return orderService.requestCancelOrder(requireUsername(authentication), id, reason);
    }

    private String requireUsername(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()
                || "anonymousUser".equalsIgnoreCase(authentication.getName())) {
            throw new IllegalArgumentException("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        }
        return authentication.getName();
    }
}

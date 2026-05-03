package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.CreatePaymentSessionRequest;
import com.techstore1.techstore1.dto.CreatePaymentSessionResponse;
import com.techstore1.techstore1.service.PaymentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/customer/payments")
// tac dung code: API cho khach tao phien thanh toan online cho don cua chinh ho.
public class CustomerPaymentController {

    private final PaymentService paymentService;

    public CustomerPaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/session")
    public CreatePaymentSessionResponse createSession(
            @Valid @RequestBody CreatePaymentSessionRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        String clientIp = resolveClientIp(httpRequest);
        // tac dung code: tao URL cong thanh toan theo provider (MOCK/VNPAY/MOMO) cho dung user dang dang nhap.
        return paymentService.createSession(requireUsername(authentication), request.getOrderId(), request.getProvider(), clientIp);
    }

    @PostMapping("/mock-session")
    public CreatePaymentSessionResponse createMockSessionBackwardCompatible(
            @Valid @RequestBody CreatePaymentSessionRequest request,
            Authentication authentication
    ) {
        // tac dung code: giu endpoint cu de frontend cu khong bi loi sau khi nang cap provider.
        return paymentService.createSession(
                requireUsername(authentication),
                request.getOrderId(),
                "MOCK",
                "127.0.0.1"
        );
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "127.0.0.1";
        }

        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }

        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }

        String remoteAddr = request.getRemoteAddr();
        return remoteAddr == null || remoteAddr.isBlank() ? "127.0.0.1" : remoteAddr.trim();
    }

    private String requireUsername(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()
                || "anonymousUser".equalsIgnoreCase(authentication.getName())) {
            throw new IllegalArgumentException("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        }
        return authentication.getName();
    }
}

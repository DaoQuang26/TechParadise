package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.MockPaymentSessionResponse;
import com.techstore1.techstore1.dto.MockPaymentWebhookRequest;
import com.techstore1.techstore1.dto.MockPaymentWebhookResponse;
import com.techstore1.techstore1.service.PaymentService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/payments/mock")
// tac dung code: API public mo phong cong thanh toan (session + webhook callback).
public class PublicPaymentController {

    private final PaymentService paymentService;

    public PublicPaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping("/session")
    public MockPaymentSessionResponse getSession(@RequestParam String reference) {
        // tác dụng code: tra thong tin phien thanh toan de trang mock checkout render du lieu.
        return paymentService.getPublicMockSession(reference);
    }

    @PostMapping("/webhook")
    public MockPaymentWebhookResponse webhook(@Valid @RequestBody MockPaymentWebhookRequest request) {
        // tác dụng code: endpoint callback cong thanh toan (co verify chu ky) de cap nhat don hang.
        return paymentService.handleMockWebhook(request);
    }
}

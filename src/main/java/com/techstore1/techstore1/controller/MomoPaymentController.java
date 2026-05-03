package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.service.PaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Collections;
import java.util.Map;

@Controller
@RequestMapping("/payments/momo")
// tac dung code: nhan callback return/IPN tu MoMo va cap nhat trang thai don.
public class MomoPaymentController {

    private final PaymentService paymentService;

    public MomoPaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping("/return")
    public String momoReturn(@RequestParam Map<String, String> params) {
        try {
            String redirectUrl = paymentService.handleMomoReturnAndBuildRedirect(params);
            return "redirect:" + redirectUrl;
        } catch (Exception ex) {
            return "redirect:/payments/result?payment=error&provider=momo";
        }
    }

    @PostMapping("/ipn")
    public ResponseEntity<Void> momoIpn(@RequestBody(required = false) Map<String, Object> payload) {
        Map<String, Object> safePayload = payload == null ? Collections.emptyMap() : payload;
        paymentService.handleMomoIpn(safePayload);
        // tac dung code: theo khuyen nghi MoMo, partner IPN nen tra ve HTTP 204 khong can body.
        return ResponseEntity.noContent().build();
    }
}

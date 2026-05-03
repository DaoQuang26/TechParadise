package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.service.PaymentService;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.Map;

@Controller
@RequestMapping("/payments/vnpay")
// tac dung code: nhan callback return/IPN tu VNPay roi cap nhat trang thai don.
public class VnpayPaymentController {

    private final PaymentService paymentService;

    public VnpayPaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping("/return")
    public String vnpayReturn(@RequestParam Map<String, String> params) {
        try {
            String redirectUrl = paymentService.handleVnpayReturnAndBuildRedirect(params);
            return "redirect:" + redirectUrl;
        } catch (Exception ex) {
            return "redirect:/payments/result?payment=error&provider=vnpay";
        }
    }

    @GetMapping("/ipn")
    @ResponseBody
    public Map<String, String> vnpayIpn(@RequestParam Map<String, String> params) {
        return paymentService.handleVnpayIpn(params);
    }
}

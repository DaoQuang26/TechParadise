package com.techstore1.techstore1.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class ViewController {

    @GetMapping("/")
    public String home() {
        // tac dung code: storefront chinh de khach xem danh sach san pham.
        return "store/index";
    }

    @GetMapping("/login")
    public String login() {
        // tac dung code: trang dang nhap.
        return "auth/login";
    }

    @GetMapping("/register")
    public String register() {
        // tac dung code: trang dang ky tai khoan.
        return "auth/register";
    }

    @GetMapping("/admin/dashboard")
    public String adminDashboard() {
        // tac dung code: dashboard quan tri.
        return "admin/dashboard";
    }

    @GetMapping("/admin/orders/{id}")
    public String adminOrderDetail(@PathVariable Long id) {
        // tac dung code: trang chi tiet don hang cho admin.
        return "admin/order_detail";
    }

    @GetMapping("/admin/users/{id}")
    public String adminUserDetail(@PathVariable Long id) {
        // tac dung code: trang chi tiet/chinh sua tai khoan cho admin.
        return "admin/user_detail";
    }

    @GetMapping("/cart")
    public String cart() {
        // tac dung code: trang gio hang.
        return "store/cart";
    }

    @GetMapping("/checkout")
    public String checkout() {
        // tac dung code: trang thanh toan.
        return "store/checkout";
    }

    @GetMapping("/orders")
    public String orders() {
        // tac dung code: danh sach don cua khach.
        return "store/orders";
    }

    @GetMapping("/orders/{id}")
    public String orderDetail(@PathVariable Long id) {
        // tac dung code: trang chi tiet don hang.
        return "store/order_detail";
    }

    @GetMapping("/notifications")
    public String notifications() {
        // tac dung code: trang thong bao cua khach (lich su su kien gio hang/don hang/thanh toan).
        return "store/notifications";
    }

    @GetMapping("/product/{id}")
    public String productDetail(@PathVariable Long id) {
        // tac dung code: trang chi tiet san pham.
        return "store/product";
    }

    @GetMapping("/category/{id}")
    public String categoryProducts(@PathVariable Long id) {
        // tac dung code: trang hien thi toan bo san pham theo danh muc.
        return "store/category";
    }

    @GetMapping("/account")
    public String account() {
        // tac dung code: trang cap nhat thong tin ca nhan.
        return "store/account";
    }

    @GetMapping("/payments/mock/checkout")
    public String mockPaymentCheckout() {
        // tac dung code: trang cong thanh toan online gia lap de test webhook end-to-end.
        return "store/payment_mock";
    }

    @GetMapping("/payments/result")
    public String paymentResult() {
        // tac dung code: trang ket qua thanh toan (thanh cong/that bai) sau khi gateway redirect ve.
        return "store/payment_result";
    }
}

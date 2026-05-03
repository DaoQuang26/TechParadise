// payment_result.js
// /payments/result page:
// - show payment outcome from query params
// - provide clear navigation to order detail / orders list
// tác dụng code: hiển thị trang kết quả thanh toán riêng để UX rõ ràng hơn sau callback gateway.

function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        payment: String(params.get("payment") || "").trim().toLowerCase(),
        provider: String(params.get("provider") || "").trim().toUpperCase(),
        code: String(params.get("code") || "").trim(),
        orderId: String(params.get("orderId") || "").trim()
    };
}

function providerLabel(provider) {
    if (provider === "VNPAY") {
        return "VNPay";
    }
    if (provider === "MOMO") {
        return "MoMo";
    }
    if (provider === "MOCK" || provider === "MOCK_GATEWAY") {
        return "Mock Gateway";
    }
    return provider || "N/A";
}

function paymentLabel(payment) {
    switch (payment) {
        case "success":
            return "Thanh toán thành công";
        case "pending-confirmation":
            return "Đang chờ xác nhận";
        case "failed":
            return "Thanh toán thất bại";
        case "expired":
            return "Đơn đã hết hạn";
        case "invalid-signature":
            return "Chữ ký không hợp lệ";
        case "amount-mismatch":
            return "Sai số tiền giao dịch";
        default:
            return "Lỗi xác nhận thanh toán";
    }
}

function paymentTitle(payment) {
    if (payment === "success") {
        return "Thanh toán thành công!";
    }
    if (payment === "pending-confirmation") {
        return "Đang chờ xác nhận thanh toán.";
    }
    if (payment === "failed") {
        return "Thanh toán chưa thành công.";
    }
    if (payment === "expired") {
        return "Đơn hàng đã hết hạn thanh toán.";
    }
    return "Có lỗi khi xác nhận giao dịch.";
}

function paymentSubtitle(payment) {
    if (payment === "success") {
        return "Đơn hàng của bạn đã được xác nhận thanh toán. Bạn có thể theo dõi tiến trình giao hàng trong trang đơn.";
    }
    if (payment === "pending-confirmation") {
        return "Giao dịch đã được gửi tới cổng thanh toán. Hệ thống đang chờ IPN xác nhận chính thức.";
    }
    if (payment === "failed") {
        return "Thanh toán thất bại. Đơn online sẽ được tự động hủy và hoàn tồn kho để tránh giữ hàng.";
    }
    if (payment === "expired") {
        return "Đơn đã quá thời gian giữ hàng nên hệ thống tự hủy. Vui lòng tạo đơn mới nếu bạn vẫn muốn mua.";
    }
    if (payment === "invalid-signature") {
        return "Hệ thống từ chối giao dịch vì chữ ký callback không hợp lệ.";
    }
    if (payment === "amount-mismatch") {
        return "Số tiền phản hồi từ cổng thanh toán không khớp với đơn hàng.";
    }
    return "Giao dịch chưa được xác nhận đầy đủ. Vui lòng kiểm tra lại trong mục đơn hàng của bạn.";
}

function renderResult() {
    const query = getQueryParams();

    const titleEl = document.getElementById("payment-result-title");
    const subtitleEl = document.getElementById("payment-result-subtitle");
    const badgeEl = document.getElementById("payment-result-badge");
    const providerEl = document.getElementById("payment-result-provider");
    const codeEl = document.getElementById("payment-result-code");
    const orderEl = document.getElementById("payment-result-order");
    const orderLinkEl = document.getElementById("payment-go-order");

    if (titleEl) {
        titleEl.textContent = paymentTitle(query.payment);
    }
    if (subtitleEl) {
        subtitleEl.textContent = paymentSubtitle(query.payment);
    }
    if (badgeEl) {
        badgeEl.textContent = paymentLabel(query.payment);
        if (query.payment === "success") {
            badgeEl.className = "status-pill success";
        } else if (query.payment === "failed" || query.payment === "expired") {
            badgeEl.className = "status-pill danger";
        } else {
            badgeEl.className = "status-pill warn";
        }
    }
    if (providerEl) {
        providerEl.textContent = providerLabel(query.provider);
    }
    if (codeEl) {
        codeEl.textContent = query.code || "-";
    }
    if (orderEl) {
        orderEl.textContent = query.orderId ? `#${query.orderId}` : "-";
    }

    if (orderLinkEl) {
        orderLinkEl.href = query.orderId ? `/orders/${encodeURIComponent(query.orderId)}` : "/orders";
    }

    return query;
}

window.addEventListener("DOMContentLoaded", () => {
    const query = renderResult();
    if (query && query.payment === "success" && typeof TechStore.notifyPaymentSuccess === "function") {
        TechStore.notifyPaymentSuccess(query.orderId, query.provider);
    }
});

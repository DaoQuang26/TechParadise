// payment_mock.js
// /payments/mock/checkout page:
// - load mock payment session by payment reference
// - send PAID/FAILED webhook payload to backend
// tác dụng code: mô phỏng luồng provider thanh toán gửi webhook đến server.

let mockSession = null;

function setMessage(text, type) {
    const el = document.getElementById("mock-pay-message");
    if (!el) {
        return;
    }
    el.textContent = text || "";
    el.className = "message " + (type ? `message-${type}` : "");
}

function statusLabel(status) {
    switch (status) {
        case "NOT_REQUIRED":
            return "Không áp dụng";
        case "PENDING":
            return "Chờ thanh toán";
        case "PAID":
            return "Đã thanh toán";
        case "FAILED":
            return "Thanh toán thất bại";
        default:
            return status || "-";
    }
}

function getReferenceFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("reference") || "").trim();
}

async function loadSession(reference) {
    const response = await fetch(`/api/public/payments/mock/session?reference=${encodeURIComponent(reference)}`);
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Không tải được phiên thanh toán");
    }
    return response.json();
}

function renderSession(session) {
    const refEl = document.getElementById("mock-pay-reference");
    const idEl = document.getElementById("mock-pay-order-id");
    const customerEl = document.getElementById("mock-pay-customer");
    const totalEl = document.getElementById("mock-pay-total");
    const statusEl = document.getElementById("mock-pay-status");
    const orderLinkEl = document.getElementById("mock-pay-order-link");

    if (refEl) refEl.textContent = session.paymentReference || "-";
    if (idEl) idEl.textContent = session.orderId ? `#${session.orderId}` : "-";
    if (customerEl) customerEl.textContent = session.customerUsername || "-";
    if (totalEl) totalEl.textContent = TechStore.formatVnd(session.totalPrice || 0);
    if (statusEl) statusEl.textContent = statusLabel(session.onlinePaymentStatus);
    if (orderLinkEl && session.orderId) {
        orderLinkEl.href = `/orders/${encodeURIComponent(session.orderId)}`;
    }
}

async function sendWebhook(result) {
    if (!mockSession) {
        return;
    }

    const successBtn = document.getElementById("mock-pay-success");
    const failedBtn = document.getElementById("mock-pay-failed");
    if (successBtn) successBtn.disabled = true;
    if (failedBtn) failedBtn.disabled = true;

    const signature = result === "PAID" ? mockSession.paidSignature : mockSession.failedSignature;

    try {
        // tác dụng code: gửi callback webhook có chữ ký HMAC để backend verify và cập nhật đơn.
        const response = await fetch("/api/public/payments/mock/webhook", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                paymentReference: mockSession.paymentReference,
                status: result,
                signature
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || "Webhook thanh toán thất bại");
        }

        setMessage(data.message || "Đã gửi webhook thành công.", "success");
        setTimeout(() => {
            window.location.href = data.redirectUrl || `/orders/${encodeURIComponent(mockSession.orderId)}`;
        }, 500);
    } catch (err) {
        setMessage(err.message, "error");
        if (successBtn) successBtn.disabled = false;
        if (failedBtn) failedBtn.disabled = false;
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    const reference = getReferenceFromQuery();
    if (!reference) {
        setMessage("Thiếu payment reference trong URL.", "error");
        return;
    }

    try {
        mockSession = await loadSession(reference);
        renderSession(mockSession);
    } catch (err) {
        setMessage(err.message, "error");
        return;
    }

    const successBtn = document.getElementById("mock-pay-success");
    const failedBtn = document.getElementById("mock-pay-failed");
    if (successBtn) {
        successBtn.addEventListener("click", () => sendWebhook("PAID"));
    }
    if (failedBtn) {
        failedBtn.addEventListener("click", () => sendWebhook("FAILED"));
    }
});

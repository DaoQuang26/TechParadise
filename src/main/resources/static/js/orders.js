// orders.js
// Trang /orders của khách hàng.
// - Tải danh sách đơn
// - Hiển thị trạng thái
// - Điều hướng sang chi tiết đơn

function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function statusLabel(status) {
    switch (status) {
        case "PENDING":
            return "Chờ xử lý";
        case "CONFIRMED":
            return "Đã xác nhận";
        case "SHIPPING":
            return "Đang giao";
        case "DELIVERED":
            return "Đã giao";
        case "CANCEL_REQUESTED":
            return "Yêu cầu hủy";
        case "CANCELLED":
            return "Đã hủy";
        default:
            return status || "";
    }
}

function statusTone(status) {
    switch (status) {
        case "DELIVERED":
            return "success";
        case "SHIPPING":
            return "info";
        case "CONFIRMED":
            return "warn";
        case "CANCEL_REQUESTED":
            return "warn";
        case "CANCELLED":
            return "danger";
        default:
            return "neutral";
    }
}

function setMessage(text, type) {
    const el = document.getElementById("orders-msg");
    if (!el) {
        return;
    }

    if (!text) {
        el.style.display = "none";
        el.textContent = "";
        el.className = "message";
        return;
    }

    el.style.display = "block";
    el.textContent = text;
    el.className = "message " + (type ? `message-${type}` : "");
}

function formatDateTime(value) {
    if (!value) {
        return "";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value).replace("T", " ").slice(0, 16);
    }

    const day = String(parsed.getDate()).padStart(2, "0");
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const year = parsed.getFullYear();
    const hour = String(parsed.getHours()).padStart(2, "0");
    const minute = String(parsed.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hour}:${minute}`;
}

function renderOrders(orders) {
    const emptyEl = document.getElementById("orders-empty");
    const contentEl = document.getElementById("orders-content");
    const rowsEl = document.getElementById("orders-rows");

    if (!orders || orders.length === 0) {
        if (emptyEl) emptyEl.style.display = "block";
        if (contentEl) contentEl.style.display = "none";
        if (rowsEl) rowsEl.innerHTML = "";
        return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    if (contentEl) contentEl.style.display = "block";

    rowsEl.innerHTML = "";
    orders.forEach((order, index) => {
        const tr = document.createElement("tr");
        tr.style.setProperty("--delay", `${Math.min(index, 12) * 35}ms`);

        const createdAt = formatDateTime(order.createdAt);
        tr.innerHTML = `
            <td><strong>#${order.id}</strong></td>
            <td class="col-right"><strong>${TechStore.formatVnd(order.totalPrice)}</strong></td>
            <td class="col-center">
                <span class="status-pill ${statusTone(order.status)}">${escapeHtml(statusLabel(order.status))}</span>
            </td>
            <td class="muted">${escapeHtml(createdAt)}</td>
            <td class="col-center">
                <div class="row-actions" style="justify-content:center; gap:8px;">
                    <a class="btn btn-outline btn-sm" href="/orders/${encodeURIComponent(order.id)}">Xem</a>
                </div>
            </td>
        `;
        rowsEl.appendChild(tr);
    });
}

async function refresh() {
    setMessage("", "");

    if (!TechStore.ensureLoggedIn()) {
        return;
    }

    try {
        const response = await fetch("/api/customer/orders", {
            headers: {
                ...TechStore.authHeader()
            }
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || "Không tải được đơn hàng");
        }

        const orders = await response.json();
        renderOrders(orders);
    } catch (err) {
        setMessage(err.message, "error");
    }
}

window.TechStoreOrders = { refresh };

window.addEventListener("DOMContentLoaded", () => {
    TechStore.updateHeader();

    if (!TechStore.ensureLoggedIn()) {
        return;
    }

    refresh();
});

// admin_order_detail.js
// Trang /admin/orders/{id}
// - Hiển thị chi tiết đơn hàng cho admin trên trang riêng.

function token() {
    return localStorage.getItem("techstore_token");
}

function role() {
    return localStorage.getItem("techstore_role");
}

function username() {
    return localStorage.getItem("techstore_user");
}

function authHeaders() {
    const t = token();
    return t ? { Authorization: `Bearer ${t}` } : {};
}

const ORDER_STATUS_FLOW = ["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCEL_REQUESTED", "CANCELLED"];

function ensureAdmin() {
    const r = role();
    if (!(r === "ADMIN" || r === "SUPER_ADMIN")) {
        window.location.href = "/login";
        return false;
    }
    return true;
}

function logout() {
    fetch("/api/auth/logout", {
        method: "POST",
        headers: {
            ...authHeaders()
        },
        credentials: "same-origin"
    }).catch(() => {
        // Ignore network errors on logout.
    });

    localStorage.removeItem("techstore_token");
    localStorage.removeItem("techstore_role");
    localStorage.removeItem("techstore_user");
    window.location.href = "/login";
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const raw = await response.text();

    let data = null;
    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch (err) {
            data = raw;
        }
    }

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("techstore_token");
            localStorage.removeItem("techstore_role");
            localStorage.removeItem("techstore_user");
            window.location.href = "/login";
            throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        }

        const message = data && typeof data === "object" && data.message
            ? data.message
            : "Có lỗi xảy ra";
        throw new Error(message);
    }

    return data;
}

function formatVnd(value) {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND"
    }).format(value || 0);
}

function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function orderStatusLabel(status) {
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

function statusPillClass(status) {
    switch (status) {
        case "DELIVERED":
            return "success";
        case "SHIPPING":
            return "info";
        case "CONFIRMED":
        case "CANCEL_REQUESTED":
            return "warn";
        case "CANCELLED":
            return "danger";
        default:
            return "neutral";
    }
}

function paymentLabel(method) {
    switch (method) {
        case "ONLINE_GATEWAY":
            return "Thanh toán online";
        case "BANK_TRANSFER":
            return "Chuyển khoản";
        case "COD":
        default:
            return "COD";
    }
}

function paymentProviderLabel(provider) {
    if (!provider) {
        return "N/A";
    }
    if (provider === "MOCK_GATEWAY" || provider === "MOCK") {
        return "Không còn hỗ trợ";
    }
    if (provider === "VNPAY") {
        return "VNPay";
    }
    if (provider === "MOMO") {
        return "MoMo";
    }
    return provider;
}

function onlinePaymentStatusLabel(status) {
    switch (status) {
        case "NOT_REQUIRED":
            return "Chờ thanh toán";
        case "PENDING":
            return "Chờ thanh toán";
        case "PAID":
            return "Đã thanh toán";
        case "FAILED":
            return "Thất bại";
        default:
            return status || "";
    }
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

function normalizeOrderHistoryNote(note) {
    const raw = typeof note === "string" ? note.trim() : "";
    if (!raw) {
        return "";
    }

    const normalizedMap = {
        "Don hang duoc tao": "\u0110\u01a1n h\u00e0ng \u0111\u01b0\u1ee3c t\u1ea1o",
        "Admin cap nhat trang thai don": "Admin c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i \u0111\u01a1n",
        "Admin da duyet huy don": "Admin \u0111\u00e3 duy\u1ec7t h\u1ee7y \u0111\u01a1n",
        "He thong tu dong huy don vi het han thanh toan online": "H\u1ec7 th\u1ed1ng t\u1ef1 \u0111\u1ed9ng h\u1ee7y \u0111\u01a1n v\u00ec h\u1ebft h\u1ea1n thanh to\u00e1n online",
        "He thong dong bo don online that bai ve trang thai da huy": "H\u1ec7 th\u1ed1ng \u0111\u1ed3ng b\u1ed9 \u0111\u01a1n online th\u1ea5t b\u1ea1i v\u1ec1 tr\u1ea1ng th\u00e1i \u0111\u00e3 h\u1ee7y",
        "Khach gui yeu cau huy don": "Kh\u00e1ch g\u1eedi y\u00eau c\u1ea7u h\u1ee7y \u0111\u01a1n",
        "Khach gui yeu cau huy": "Kh\u00e1ch g\u1eedi y\u00eau c\u1ea7u h\u1ee7y",
        "VNPay return sai so tien": "VNPay tr\u1ea3 v\u1ec1 sai s\u1ed1 ti\u1ec1n.",
        "VNPay return sai so tien.": "VNPay tr\u1ea3 v\u1ec1 sai s\u1ed1 ti\u1ec1n.",
        "VNPay return thanh cong": "VNPay tr\u1ea3 v\u1ec1 th\u00e0nh c\u00f4ng.",
        "VNPay return thanh cong.": "VNPay tr\u1ea3 v\u1ec1 th\u00e0nh c\u00f4ng.",
        "VNPay return that bai": "VNPay tr\u1ea3 v\u1ec1 th\u1ea5t b\u1ea1i.",
        "VNPay return that bai.": "VNPay tr\u1ea3 v\u1ec1 th\u1ea5t b\u1ea1i.",
        "VNPay IPN thanh cong": "VNPay IPN x\u00e1c nh\u1eadn th\u00e0nh c\u00f4ng.",
        "VNPay IPN thanh cong.": "VNPay IPN x\u00e1c nh\u1eadn th\u00e0nh c\u00f4ng.",
        "VNPay IPN that bai": "VNPay IPN x\u00e1c nh\u1eadn th\u1ea5t b\u1ea1i.",
        "VNPay IPN that bai.": "VNPay IPN x\u00e1c nh\u1eadn th\u1ea5t b\u1ea1i."
    };

    if (Object.prototype.hasOwnProperty.call(normalizedMap, raw)) {
        return normalizedMap[raw];
    }

    const cancelPrefix = "Khach gui yeu cau huy:";
    if (raw.startsWith(cancelPrefix)) {
        const reason = raw.slice(cancelPrefix.length).trim();
        return reason
            ? `Kh\u00e1ch g\u1eedi y\u00eau c\u1ea7u h\u1ee7y: ${reason}`
            : normalizedMap["Khach gui yeu cau huy"];
    }

    return raw;
}

function buildStatusOptions(selected) {
    return ORDER_STATUS_FLOW
        .map((status) => `<option value="${status}" ${status === selected ? "selected" : ""}>${orderStatusLabel(status)}</option>`)
        .join("");
}

function getInputValue(id) {
    const element = document.getElementById(id);
    return String(element ? element.value : "").trim();
}

function setOrderStatusMessage(text, type) {
    const el = document.getElementById("admin-order-status-msg");
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

function syncOrderStatusFormState() {
    const selectEl = document.getElementById("admin-order-status-select");
    const saveBtn = document.getElementById("admin-order-status-save");
    if (!selectEl || !saveBtn) {
        return;
    }

    const currentStatus = getInputValue("admin-order-status-current");
    const selectedStatus = String(selectEl.value || "").trim();
    if (selectedStatus) {
        selectEl.setAttribute("data-order-status", selectedStatus);
    }
    saveBtn.disabled = !selectedStatus || selectedStatus === currentStatus;
}

async function saveOrderStatus(event) {
    event.preventDefault();
    setOrderStatusMessage("", "");

    const orderId = Number(getInputValue("admin-order-id") || 0);
    if (!orderId) {
        setOrderStatusMessage("Kh\u00f4ng t\u00ecm th\u1ea5y \u0111\u01a1n h\u00e0ng.", "error");
        return;
    }

    const currentStatus = getInputValue("admin-order-status-current");
    const selectEl = document.getElementById("admin-order-status-select");
    const saveBtn = document.getElementById("admin-order-status-save");
    const nextStatus = String(selectEl ? selectEl.value : "").trim();

    if (!nextStatus) {
        setOrderStatusMessage("Vui l\u00f2ng ch\u1ecdn tr\u1ea1ng th\u00e1i c\u1ea7n c\u1eadp nh\u1eadt.", "error");
        return;
    }
    if (nextStatus === currentStatus) {
        setOrderStatusMessage("Tr\u1ea1ng th\u00e1i ch\u01b0a thay \u0111\u1ed5i.", "error");
        syncOrderStatusFormState();
        return;
    }

    if (selectEl) {
        selectEl.disabled = true;
        selectEl.setAttribute("data-order-status", nextStatus);
    }
    if (saveBtn) {
        saveBtn.disabled = true;
    }

    try {
        await fetchJson(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders()
            },
            body: JSON.stringify({ status: nextStatus })
        });

        const latest = await fetchJson(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
            headers: {
                ...authHeaders()
            }
        });
        renderOrderDetail(latest);
        setOrderStatusMessage("\u0110\u00e3 c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i \u0111\u01a1n h\u00e0ng.", "success");
    } catch (err) {
        if (selectEl) {
            selectEl.disabled = false;
            selectEl.value = currentStatus;
            selectEl.setAttribute("data-order-status", currentStatus);
        }
        if (saveBtn) {
            saveBtn.disabled = false;
        }
        setOrderStatusMessage(err.message, "error");
    }
}

function buildOrderHistoryTimeline(history) {
    if (!Array.isArray(history) || history.length === 0) {
        return `
            <div class="timeline">
                <div class="t-step active">
                    <div class="t-dot"></div>
                    <div>
                        <div class="t-title">Chưa có lịch sử cập nhật</div>
                        <div class="muted">Dữ liệu timeline chưa được ghi nhận cho đơn này.</div>
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="timeline">
            ${history.map((entry, index) => {
                const isLatest = index === history.length - 1;
                const cls = isLatest ? "active" : "done";

                const fromLabel = entry.fromStatus ? orderStatusLabel(entry.fromStatus) : "Khởi tạo";
                const toLabel = orderStatusLabel(entry.toStatus);
                const title = `${fromLabel} -> ${toLabel}`;

                const normalizedNote = normalizeOrderHistoryNote(entry.note);
                const note = normalizedNote ? `<div class="muted">${escapeHtml(normalizedNote)}</div>` : "";
                const actor = entry.changedBy ? `Bởi: ${escapeHtml(entry.changedBy)}` : "";
                const at = entry.createdAt ? `Lúc: ${escapeHtml(formatDateTime(entry.createdAt))}` : "";
                const meta = [actor, at].filter(Boolean).join(" · ");
                const metaHtml = meta ? `<div class="muted">${meta}</div>` : "";

                return `
                    <div class="t-step ${cls}">
                        <div class="t-dot"></div>
                        <div>
                            <div class="t-title">${escapeHtml(title)}</div>
                            ${note}
                            ${metaHtml}
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;

}

function getOrderIdFromPath() {
    const parts = (window.location.pathname || "").split("/").filter(Boolean);
    return Number(parts[parts.length - 1] || 0);
}

function renderSkeleton() {
    const holder = document.getElementById("admin-order-detail-holder");
    if (!holder) {
        return;
    }

    holder.innerHTML = `
        <section class="card admin-detail-card">
            <div class="card-body">
                <div class="skeleton skeleton-line" style="height: 20px; width: 58%;"></div>
                <div class="skeleton skeleton-line" style="height: 16px; width: 72%; margin-top: 10px;"></div>
                <div class="skeleton skeleton-line" style="height: 16px; width: 68%; margin-top: 10px;"></div>
                <div class="skeleton skeleton-line" style="height: 16px; width: 74%; margin-top: 10px;"></div>
            </div>
        </section>
    `;

}

function renderOrderDetail(detail) {
    const holder = document.getElementById("admin-order-detail-holder");
    if (!holder) {
        return;
    }

    const titleEl = document.getElementById("admin-order-title");
    if (titleEl) {
        titleEl.textContent = `Chi tiết đơn hàng #${detail.id}`;
    }

    const subtitleEl = document.getElementById("admin-order-subtitle");
    if (subtitleEl) {
        subtitleEl.textContent = `Khách: ${detail.customerUsername || "N/A"} • Trạng thái: ${orderStatusLabel(detail.status)}`;
    }

    const createdAt = detail.createdAt ? escapeHtml(formatDateTime(detail.createdAt)) : "";
    const shippingAddress = escapeHtml(detail.shippingAddress || "");
    const payment = escapeHtml(paymentLabel(detail.paymentMethod));
    const paymentProvider = escapeHtml(paymentProviderLabel(detail.paymentProvider));
    const paymentStatus = escapeHtml(onlinePaymentStatusLabel(detail.onlinePaymentStatus));
    const statusText = escapeHtml(orderStatusLabel(detail.status));
    const statusClass = statusPillClass(detail.status);
    const cancelReason = escapeHtml(detail.cancelRequestReason || "");
    const cancelRequestedAt = detail.cancelRequestedAt ? escapeHtml(formatDateTime(detail.cancelRequestedAt)) : "";
    const discount = Number(detail.discountAmount || 0);
    const subtotal = Number(detail.subtotalPrice || detail.totalPrice || 0);
    const historyHtml = buildOrderHistoryTimeline(detail.statusHistory || []);

    const rows = (detail.items || []).map((item) => `
        <tr>
            <td>
                <div class="line-item">
                    <img class="line-thumb" src="${escapeHtml(item.imageUrl || "https://placehold.co/120x90/f3f4f6/111827?text=TP")}" alt="${escapeHtml(item.productName || "Sản phẩm")}">
                    <div>
                        <div class="cell-title">${escapeHtml(item.productName || "Sản phẩm")}</div>
                        <div class="muted">ID: ${item.productId ?? ""}</div>
                    </div>
                </div>
            </td>
            <td class="col-right"><strong>${formatVnd(item.unitPrice)}</strong></td>
            <td class="col-center">${item.quantity ?? 0}</td>
            <td class="col-right"><strong>${formatVnd(item.lineTotal)}</strong></td>
        </tr>
    `).join("");

    holder.innerHTML = `
        <section class="admin-detail-hero">
            <div class="admin-detail-hero-main">
                <h4 class="admin-detail-order-id">Đơn hàng #${detail.id}</h4>
                <p class="admin-detail-sub">
                    Khách: <strong>${escapeHtml(detail.customerUsername || "N/A")}</strong>
                    <span class="admin-detail-dot">•</span>
                    Tạo lúc: <strong>${createdAt || "N/A"}</strong>
                </p>
            </div>
            <div class="admin-detail-chip-group">
                <span class="admin-detail-chip admin-detail-chip-payment">${payment}</span>
                <span class="status-pill ${statusClass} admin-detail-status">${statusText}</span>
            </div>
        </section>

        <div class="grid-2 admin-detail-grid" style="margin-bottom: 14px;">
            <section class="card admin-detail-card admin-detail-info">
                <div class="card-head admin-detail-head"><h2 style="margin:0;">Thông tin giao hàng</h2></div>
                <div class="card-body">
                    <div class="kv admin-kv"><span class="muted">Khách hàng</span><strong>${escapeHtml(detail.customerUsername || "N/A")}</strong></div>
                    <div class="kv admin-kv"><span class="muted">Thanh toán</span><strong>${payment}</strong></div>
                    <div class="kv admin-kv"><span class="muted">Người nhận</span><strong>${escapeHtml(detail.recipientName || detail.customerUsername || "N/A")}</strong></div>
                    <div class="kv admin-kv"><span class="muted">Số điện thoại</span><strong>${escapeHtml(detail.recipientPhone || "N/A")}</strong></div>
                    <div class="kv admin-kv"><span class="muted">Provider</span><strong>${paymentProvider}</strong></div>
                    <div class="kv admin-kv" style="${(detail.paymentMethod === "ONLINE_GATEWAY" || detail.paymentMethod === "BANK_TRANSFER") ? "" : "display:none;"}">
                        <span class="muted">Trạng thái online</span>
                        <strong>${paymentStatus}</strong>
                    </div>
                    <div class="kv admin-kv" style="${(detail.paymentMethod === "ONLINE_GATEWAY" || detail.paymentMethod === "BANK_TRANSFER") && detail.paymentReference ? "" : "display:none;"}">
                        <span class="muted">Mã tham chiếu</span>
                        <strong>${escapeHtml(detail.paymentReference || "")}</strong>
                    </div>
                    <div class="kv admin-kv" style="${detail.paidAt ? "" : "display:none;"}">
                        <span class="muted">Đã thanh toán lúc</span>
                        <strong>${escapeHtml(formatDateTime(detail.paidAt || ""))}</strong>
                    </div>
                    <div class="kv admin-kv">
                        <span class="muted">Trạng thái đơn</span>
                        <span class="status-pill ${statusClass}">${statusText}</span>
                    </div>
                    <div class="kv admin-kv admin-cancel-kv" style="${cancelReason || cancelRequestedAt ? "" : "display:none;"}">
                        <span class="muted">Yêu cầu hủy</span>
                        <strong style="text-align:right;">
                            ${cancelReason || "Khách chưa ghi lý do"}
                            ${cancelRequestedAt ? `<br><span class="muted">${cancelRequestedAt}</span>` : ""}
                        </strong>
                    </div>
                    <div class="kv admin-kv" style="align-items:flex-start;">
                        <span class="muted">Địa chỉ giao hàng</span>
                        <strong style="text-align:right;">${shippingAddress}</strong>
                    </div>
                </div>
            </section>

            <aside class="card summary admin-detail-card admin-detail-summary">
                <div class="card-head admin-detail-head"><h2 style="margin:0;">Giá trị đơn</h2></div>
                <div class="card-body">
                    <div class="kv admin-kv"><span class="muted">Tạm tính</span><strong>${formatVnd(subtotal)}</strong></div>
                    <div class="kv admin-kv" style="${discount > 0 ? "" : "display:none;"}">
                        <span class="muted">Giảm giá ${detail.promotionCode ? `(${escapeHtml(detail.promotionCode)} - ${detail.discountPercent || 0}%)` : ""}</span>
                        <strong>- ${formatVnd(discount)}</strong>
                    </div>
                    <div class="kv total admin-detail-total"><span>Tổng cộng</span><strong>${formatVnd(detail.totalPrice)}</strong></div>
                </div>
            </aside>
        </div>

        <section class="card admin-detail-card" style="margin-bottom:14px;">
            <div class="card-head admin-detail-head"><h2 style="margin:0;">C&#7853;p nh&#7853;t tr&#7841;ng th&#225;i &#273;&#417;n</h2></div>
            <div class="card-body">
                <form id="admin-order-status-form">
                    <input id="admin-order-id" type="hidden" value="${Number(detail.id || 0)}">
                    <input id="admin-order-status-current" type="hidden" value="${escapeHtml(detail.status || "")}">

                    <div class="admin-form-grid">
                        <label>Tr&#7841;ng th&#225;i hi&#7879;n t&#7841;i
                            <input class="input" value="${statusText}" disabled>
                        </label>
                        <label>Tr&#7841;ng th&#225;i m&#7899;i
                            <select id="admin-order-status-select" class="select orders-status-select" data-order-status="${escapeHtml(detail.status || "")}">
                                ${buildStatusOptions(detail.status)}
                            </select>
                        </label>
                    </div>

                    <div id="admin-order-status-msg" class="message" style="display:none; margin-top:12px;"></div>

                    <div class="admin-form-actions" style="margin-top:14px;">
                        <button id="admin-order-status-save" class="btn btn-solid" type="submit">
                            <span class="icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24"><path d="M5 12.5 10 17l9-10"></path></svg>
                            </span>
                            L&#432;u tr&#7841;ng th&#225;i
                        </button>
                    </div>
                </form>
            </div>
        </section>

        <section class="card admin-detail-card admin-detail-products">
            <div class="card-head admin-detail-head"><h2 style="margin:0;">Sản phẩm trong đơn</h2></div>
            <div class="card-body">
                <div class="table-wrap">
                    <table class="table admin-detail-table" aria-label="Chi tiết sản phẩm của đơn">
                        <thead>
                        <tr>
                            <th>Sản phẩm</th>
                            <th class="col-right">Đơn giá</th>
                            <th class="col-center">Số lượng</th>
                            <th class="col-right">Thành tiền</th>
                        </tr>
                        </thead>
                        <tbody>${rows || `<tr><td colspan="4" class="muted" style="text-align:center;">Không có sản phẩm</td></tr>`}</tbody>
                    </table>
                </div>
            </div>
        </section>

        <section class="card admin-detail-card" style="margin-top:14px; margin-bottom:14px;">
            <div class="card-head admin-detail-head"><h2 style="margin:0;">Lịch sử trạng thái</h2></div>
            <div class="card-body">
                ${historyHtml}
            </div>
        </section>
    `;

    const statusForm = document.getElementById("admin-order-status-form");
    if (statusForm) {
        statusForm.addEventListener("submit", saveOrderStatus);
    }

    const statusSelect = document.getElementById("admin-order-status-select");
    if (statusSelect) {
        statusSelect.addEventListener("change", syncOrderStatusFormState);
    }
    syncOrderStatusFormState();
}

window.addEventListener("DOMContentLoaded", async () => {
    if (!ensureAdmin()) {
        return;
    }

    const userEl = document.getElementById("admin-user");
    if (userEl) {
        userEl.textContent = username() || "admin";
    }

    const roleEl = document.getElementById("admin-role");
    if (roleEl) {
        roleEl.textContent = `Role: ${role() || "N/A"}`;
    }

    const orderId = getOrderIdFromPath();
    if (!orderId) {
        window.location.href = "/admin/dashboard#orders";
        return;
    }

    const dashboardLinkEl = document.getElementById("admin-open-dashboard-order");
    if (dashboardLinkEl) {
        dashboardLinkEl.href = "/admin/dashboard#orders";
    }

    renderSkeleton();

    try {
        const detail = await fetchJson(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
            headers: {
                ...authHeaders()
            }
        });
        renderOrderDetail(detail);
    } catch (err) {
        const holder = document.getElementById("admin-order-detail-holder");
        if (!holder) {
            return;
        }
        holder.innerHTML = `
            <section class="empty-state" style="display:block;">
                <div class="empty-card">
                    <h2>Không tải được đơn hàng</h2>
                    <p class="muted">${escapeHtml(err.message)}</p>
                    <a class="btn btn-solid" href="/admin/dashboard#orders">Về danh sách đơn</a>
                </div>
            </section>
        `;
    }
});

window.logout = logout;

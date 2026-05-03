// order_detail.js
// Trang /orders/{id}
// - Xem thông tin chi tiết đơn hàng
// - Khách gửi yêu cầu hủy đơn
// tac dung code: file nay render giao dien chi tiet don + timeline + thong tin thanh toan online.

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
            return "Đang chờ admin duyệt hủy";
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
            return "Thanh toán khi nhận hàng (COD)";
    }
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
            return "Thanh toán thất bại";
        default:
            return status || "";
    }
}

function getOrderIdFromPath() {
    const parts = (window.location.pathname || "").split("/").filter(Boolean);
    return Number(parts[parts.length - 1] || 0);
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

function renderSkeleton() {
    const holder = document.getElementById("order-detail-holder");
    if (!holder) {
        return;
    }

    holder.innerHTML = `
        <div class="grid-2">
            <section class="card">
                <div class="card-head"><h2>Thông tin</h2></div>
                <div class="card-body">
                    <div class="skeleton skeleton-line" style="height: 18px; width: 62%;"></div>
                    <div class="skeleton skeleton-line" style="height: 18px; width: 78%; margin-top: 10px;"></div>
                    <div class="skeleton skeleton-line" style="height: 18px; width: 54%; margin-top: 10px;"></div>
                    <div class="skeleton skeleton-line" style="height: 18px; width: 86%; margin-top: 14px;"></div>
                    <div class="skeleton skeleton-line" style="height: 18px; width: 70%; margin-top: 10px;"></div>
                </div>
            </section>

            <aside class="card summary">
                <div class="card-head"><h2>Tóm tắt</h2></div>
                <div class="card-body">
                    <div class="skeleton skeleton-line" style="height: 18px; width: 70%;"></div>
                    <div class="skeleton skeleton-line" style="height: 18px; width: 58%; margin-top: 10px;"></div>
                    <div class="skeleton skeleton-line" style="height: 18px; width: 76%; margin-top: 10px;"></div>
                    <div class="skeleton skeleton-line" style="height: 28px; width: 52%; margin-top: 14px;"></div>
                </div>
            </aside>
        </div>

        <section class="card" style="margin-top: 14px;">
            <div class="card-head"><h2>Sản phẩm</h2></div>
            <div class="card-body">
                <div class="skeleton skeleton-line" style="height: 18px; width: 92%;"></div>
                <div class="skeleton skeleton-line" style="height: 18px; width: 88%; margin-top: 10px;"></div>
                <div class="skeleton skeleton-line" style="height: 18px; width: 84%; margin-top: 10px;"></div>
            </div>
        </section>
    `;
}

function buildTimeline(status) {
    if (status === "CANCEL_REQUESTED") {
        return `
            <div class="timeline">
                <div class="t-step done">
                    <div class="t-dot"></div>
                    <div>
                        <div class="t-title">Đơn đã tạo</div>
                        <div class="muted">Đơn hàng đã được ghi nhận.</div>
                    </div>
                </div>
                <div class="t-step active">
                    <div class="t-dot"></div>
                    <div>
                        <div class="t-title">Đang chờ duyệt yêu cầu hủy</div>
                        <div class="muted">Admin sẽ xem yêu cầu và xác nhận hủy đơn.</div>
                    </div>
                </div>
            </div>
        `;
    }

    if (status === "CANCELLED") {
        return `
            <div class="timeline">
                <div class="t-step done">
                    <div class="t-dot"></div>
                    <div>
                        <div class="t-title">Đơn đã bị hủy</div>
                        <div class="muted">Bạn có thể đặt lại sản phẩm bất cứ lúc nào.</div>
                    </div>
                </div>
            </div>
        `;
    }

    const steps = [
        { key: "PENDING", title: "Chờ xử lý" },
        { key: "CONFIRMED", title: "Đã xác nhận" },
        { key: "SHIPPING", title: "Đang giao" },
        { key: "DELIVERED", title: "Đã giao" }
    ];

    const activeIndex = steps.findIndex((step) => step.key === status);
    return `
        <div class="timeline">
            ${steps.map((step, index) => {
                const done = activeIndex >= 0 && index <= activeIndex;
                const active = index === activeIndex;
                const cls = active ? "active" : (done ? "done" : "");
                return `
                    <div class="t-step ${cls}">
                        <div class="t-dot"></div>
                        <div>
                            <div class="t-title">${escapeHtml(step.title)}</div>
                            <div class="muted">${active ? "Trạng thái hiện tại" : ""}</div>
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function buildTimelineFromHistory(history) {
    if (!Array.isArray(history) || history.length === 0) {
        return "";
    }

    return `
        <div class="timeline">
            ${history.map((entry, index) => {
                const isLatest = index === history.length - 1;
                const cls = isLatest ? "active" : "done";
                const fromLabel = entry.fromStatus ? statusLabel(entry.fromStatus) : "Khởi tạo";
                const toLabel = statusLabel(entry.toStatus);
                const transition = `${fromLabel} -> ${toLabel}`;
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
                            <div class="t-title">${escapeHtml(transition)}</div>
                            ${note}
                            ${metaHtml}
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function renderOrder(order) {
    const holder = document.getElementById("order-detail-holder");
    if (!holder) {
        return;
    }

    const titleEl = document.getElementById("order-title");
    if (titleEl) {
        titleEl.textContent = `Chi tiết đơn #${order.id}`;
    }

    const subtitleEl = document.getElementById("order-subtitle");
    if (subtitleEl) {
        subtitleEl.textContent = `Trạng thái: ${statusLabel(order.status)}`;
    }

    const createdAt = formatDateTime(order.createdAt);
    const cancelRequestedAt = formatDateTime(order.cancelRequestedAt);
    const cancelReason = order.cancelRequestReason || "";
    const timelineHtml = Array.isArray(order.statusHistory) && order.statusHistory.length > 0
        ? buildTimelineFromHistory(order.statusHistory)
        : buildTimeline(order.status);

    const promo = order.promotionCode ? String(order.promotionCode) : "";
    const percent = order.discountPercent ? Number(order.discountPercent) : 0;
    const discount = Number(order.discountAmount || 0);
    const subtotal = Number(order.subtotalPrice || order.totalPrice || 0);

    const itemsHtml = (order.items || []).map((item) => {
        const thumb = item.imageUrl || "https://placehold.co/120x90/f3f4f6/111827?text=TP";
        return `
            <tr>
                <td>
                    <div class="line-item">
                        <img class="line-thumb" src="${escapeHtml(thumb)}" alt="${escapeHtml(item.productName || "Sản phẩm")}">
                        <div>
                            <div class="cell-title">${escapeHtml(item.productName || "Sản phẩm")}</div>
                            <div class="muted">ID: ${item.productId ?? ""}</div>
                        </div>
                    </div>
                </td>
                <td class="col-right"><strong>${TechStore.formatVnd(item.unitPrice)}</strong></td>
                <td class="col-center">${item.quantity ?? 0}</td>
                <td class="col-right"><strong>${TechStore.formatVnd(item.lineTotal)}</strong></td>
            </tr>
        `;
    }).join("");

    holder.innerHTML = `
        <div class="grid-2">
            <section class="card">
                <div class="card-head"><h2>Thông tin</h2></div>
                <div class="card-body">
                    <div class="kv"><span class="muted">Mã đơn</span><strong>#${order.id}</strong></div>
                    <div class="kv"><span class="muted">Thời gian</span><strong>${escapeHtml(createdAt)}</strong></div>
                    <div class="kv">
                        <span class="muted">Trạng thái</span>
                        <span class="status-pill ${statusTone(order.status)}">${escapeHtml(statusLabel(order.status))}</span>
                    </div>
                    <div class="kv" style="${cancelReason || cancelRequestedAt ? "" : "display:none;"}">
                        <span class="muted">Yêu cầu hủy</span>
                        <strong style="text-align:right;">
                            ${escapeHtml(cancelReason || "Khách chưa ghi lý do")}
                            ${cancelRequestedAt ? `<br><span class="muted">${escapeHtml(cancelRequestedAt)}</span>` : ""}
                        </strong>
                    </div>
                    <div class="kv"><span class="muted">Thanh toán</span><strong>${escapeHtml(paymentLabel(order.paymentMethod))}</strong></div>
                    <div class="kv" style="${(order.paymentMethod === "ONLINE_GATEWAY" || order.paymentMethod === "BANK_TRANSFER") ? "" : "display:none;"}">
                        <span class="muted">Trạng thái online</span>
                        <strong>${escapeHtml(onlinePaymentStatusLabel(order.onlinePaymentStatus))}</strong>
                    </div>
                    <div class="kv" style="${(order.paymentMethod === "ONLINE_GATEWAY" || order.paymentMethod === "BANK_TRANSFER") && order.paymentReference ? "" : "display:none;"}">
                        <span class="muted">Mã tham chiếu</span>
                        <strong>${escapeHtml(order.paymentReference || "")}</strong>
                    </div>
                    <div class="kv">
                        <span class="muted">Người nhận</span>
                        <strong>${escapeHtml(order.recipientName || order.customerUsername || "")}</strong>
                    </div>
                    <div class="kv">
                        <span class="muted">Số điện thoại</span>
                        <strong>${escapeHtml(order.recipientPhone || "")}</strong>
                    </div>
                    <div class="kv" style="align-items:flex-start;">
                        <span class="muted">Giao hàng</span>
                        <strong style="text-align:right;">${escapeHtml(order.shippingAddress || "")}</strong>
                    </div>

                    <div style="margin-top:14px;">
                        <h3 style="margin:0 0 10px;">Tiến trình</h3>
                        ${timelineHtml}
                    </div>
                </div>
            </section>

            <aside class="card summary">
                <div class="card-head"><h2>Tóm tắt</h2></div>
                <div class="card-body">
                    <div class="kv"><span class="muted">Tạm tính</span><strong>${TechStore.formatVnd(subtotal)}</strong></div>
                    <div class="kv" style="${discount > 0 ? "" : "display:none;"}">
                        <span class="muted">Giảm giá ${promo ? `(${escapeHtml(promo)} - ${percent}%)` : ""}</span>
                        <strong>- ${TechStore.formatVnd(discount)}</strong>
                    </div>
                    <div class="kv total"><span>Tổng cộng</span><strong>${TechStore.formatVnd(order.totalPrice)}</strong></div>
                </div>
            </aside>
        </div>

        <section class="card" style="margin-top: 14px;">
            <div class="card-head"><h2>Sản phẩm</h2></div>
            <div class="card-body">
                <div class="table-wrap">
                    <table class="table" aria-label="Sản phẩm trong đơn">
                        <thead>
                        <tr>
                            <th>Sản phẩm</th>
                            <th class="col-right">Đơn giá</th>
                            <th class="col-center">Số lượng</th>
                            <th class="col-right">Thành tiền</th>
                        </tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                </div>
            </div>
        </section>
    `;

    const cancelBtn = document.getElementById("cancel-order-btn");

    if (!cancelBtn) {
        return;
    }

    if (order.status === "PENDING" || order.status === "CONFIRMED") {
        cancelBtn.style.display = "inline-flex";
        cancelBtn.disabled = false;
        cancelBtn.textContent = "Gửi yêu cầu hủy";
        return;
    }

    if (order.status === "CANCEL_REQUESTED") {
        cancelBtn.style.display = "inline-flex";
        cancelBtn.disabled = true;
        cancelBtn.textContent = "Đã gửi yêu cầu hủy";
        return;
    }

    cancelBtn.style.display = "none";
}

async function fetchOrder(orderId) {
    const response = await fetch(`/api/customer/orders/${encodeURIComponent(orderId)}`, {
        headers: {
            ...TechStore.authHeader()
        }
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Không tải được đơn hàng");
    }

    return response.json();
}

async function requestCancel(orderId, reason) {
    const response = await fetch(`/api/customer/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            ...TechStore.authHeader()
        },
        body: JSON.stringify({ reason: reason || "" })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Không thể gửi yêu cầu hủy");
    }

    return response.json();
}

window.addEventListener("DOMContentLoaded", async () => {
    TechStore.updateHeader();
    if (!TechStore.ensureLoggedIn()) {
        return;
    }

    const orderId = getOrderIdFromPath();
    if (!orderId) {
        window.location.href = "/orders";
        return;
    }

    renderSkeleton();

    const cancelBtn = document.getElementById("cancel-order-btn");
    if (cancelBtn) {
        cancelBtn.addEventListener("click", async () => {
            if (!confirm("Gửi yêu cầu hủy đơn hàng này?")) {
                return;
            }

            const reasonInput = prompt("Nhập lý do hủy (không bắt buộc):", "");
            if (reasonInput === null) {
                return;
            }

            cancelBtn.disabled = true;
            cancelBtn.textContent = "Đang gửi yêu cầu...";

            try {
                const updated = await requestCancel(orderId, reasonInput);
                renderOrder(updated);
            } catch (err) {
                alert(err.message);
                cancelBtn.disabled = false;
                cancelBtn.textContent = "Gửi yêu cầu hủy";
            }
        });
    }

    try {
        const order = await fetchOrder(orderId);
        renderOrder(order);
    } catch (err) {
        const holder = document.getElementById("order-detail-holder");
        if (holder) {
            holder.innerHTML = `
                <section class="empty-state" style="display:block;">
                    <div class="empty-card">
                        <h2>Không tải được đơn hàng</h2>
                        <p class="muted">${escapeHtml(err.message)}</p>
                        <a class="btn btn-solid" href="/orders">Về danh sách đơn</a>
                    </div>
                </section>
            `;
        }
    }
});


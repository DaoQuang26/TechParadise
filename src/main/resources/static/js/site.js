// site.js
// Shared storefront helpers:
// - Session handling (JWT/role/username in localStorage)
// - Cart operations backed by database via /api/customer/cart
// - Header state sync (cart badge + auth actions)

let cartCache = [];
let cartOwner = null;
let cartLoaded = false;
let cartRequest = null;
let notificationDocumentEventsBound = false;
let orderStatusWatcherTimer = null;
let orderStatusWatcherPending = false;
let headerSearchProductsCache = null;
let headerSearchProductsRequest = null;
let headerSearchSuggestItems = [];
let headerSearchSuggestActiveIndex = -1;
let headerSearchSuggestDebounceTimer = null;
let headerSearchSuggestRequestSeq = 0;
let headerSearchDocumentEventsBound = false;
let supportChatDocumentEventsBound = false;
let supportChatPollingTimer = null;
let supportChatPollingPending = false;
let supportChatConversation = null;
let supportChatSending = false;

const NOTIFICATION_LIMIT = 40;
const ORDER_STATUS_POLL_MS = 30000;
const HEADER_SEARCH_SUGGEST_LIMIT = 6;
const SUPPORT_CHAT_POLL_MS = 7000;

function formatVnd(value) {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND"
    }).format(value || 0);
}

function normalizeDiscountPercent(value) {
    const percent = Number(value);
    if (!Number.isFinite(percent)) {
        return 0;
    }
    return Math.max(0, Math.min(100, percent));
}

function calculateDiscountedPrice(originalPrice, discountPercent) {
    const base = Math.max(0, Number(originalPrice || 0));
    const percent = normalizeDiscountPercent(discountPercent);
    if (percent <= 0) {
        return base;
    }
    return Math.max(0, Math.round(base * (100 - percent) / 100));
}

function resolveProductPricing(source) {
    const data = source || {};
    const originalPrice = Math.max(0, Number(data.originalPrice ?? data.price ?? 0));
    const discountPercent = normalizeDiscountPercent(data.discountPercent);

    const rawFinal = Number(data.finalPrice);
    const fallbackFinal = calculateDiscountedPrice(originalPrice, discountPercent);
    const resolvedFinal = Number.isFinite(rawFinal)
        ? Math.max(0, rawFinal)
        : fallbackFinal;

    const hasDiscount = discountPercent > 0 && resolvedFinal < originalPrice;
    return {
        originalPrice,
        discountPercent,
        finalPrice: hasDiscount ? resolvedFinal : originalPrice,
        hasDiscount
    };
}

function resolveProductRating(source) {
    const data = source || {};
    const rawAverage = Number(data.averageRating);
    const rawTotalReviews = Number(data.totalReviews);

    const averageRating = Number.isFinite(rawAverage)
        ? Math.max(0, Math.min(5, rawAverage))
        : 0;
    const totalReviews = Number.isFinite(rawTotalReviews)
        ? Math.max(0, Math.round(rawTotalReviews))
        : 0;
    const filledStars = Math.max(0, Math.min(5, Math.round(averageRating)));
    const stars = `${"★".repeat(filledStars)}${"☆".repeat(5 - filledStars)}`;

    return {
        averageRating,
        totalReviews,
        stars
    };
}

function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function normalizeSearchText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
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
            return status || "Không xác định";
    }
}

function onlinePaymentStatusLabel(status) {
    switch (status) {
        case "NOT_REQUIRED":
            return "Chưa thanh toán";
        case "PENDING":
            return "Chờ thanh toán";
        case "PAID":
            return "Đã thanh toán";
        case "FAILED":
            return "Thanh toán thất bại";
        default:
            return status || "Không xác định";
    }
}

function paymentProviderLabel(provider) {
    const normalized = String(provider || "").trim().toUpperCase();
    if (normalized === "VNPAY") {
        return "VNPay";
    }
    if (normalized === "MOMO") {
        return "MoMo";
    }
    if (normalized === "MOCK" || normalized === "MOCK_GATEWAY") {
        return "Mock Gateway";
    }
    return normalized || "N/A";
}

function notificationStorageKey(username) {
    return `techstore_notifications_${String(username || "").trim().toLowerCase()}`;
}

function orderSnapshotStorageKey(username) {
    return `techstore_order_snapshot_${String(username || "").trim().toLowerCase()}`;
}

function loadJsonFromLocalStorage(key, fallback) {
    if (!key) {
        return fallback;
    }
    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return fallback;
        }
        const parsed = JSON.parse(raw);
        return parsed == null ? fallback : parsed;
    } catch (_) {
        return fallback;
    }
}

function saveJsonToLocalStorage(key, value) {
    if (!key) {
        return;
    }
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
        // Ignore storage quota errors to avoid blocking checkout/cart flows.
    }
}

function loadNotifications(username = getUsername()) {
    if (!username) {
        return [];
    }
    const list = loadJsonFromLocalStorage(notificationStorageKey(username), []);
    if (!Array.isArray(list)) {
        return [];
    }
    return list
        .map((item) => ({
            id: String(item && item.id ? item.id : ""),
            eventKey: String(item && item.eventKey ? item.eventKey : ""),
            type: String(item && item.type ? item.type : "general"),
            title: String(item && item.title ? item.title : "Thông báo"),
            message: String(item && item.message ? item.message : ""),
            orderId: Number(item && item.orderId ? item.orderId : 0),
            read: !!(item && item.read),
            createdAt: String(item && item.createdAt ? item.createdAt : "")
        }))
        .filter((item) => item.id && item.title)
        .slice(0, NOTIFICATION_LIMIT);
}

function saveNotifications(list, username = getUsername()) {
    if (!username) {
        return;
    }
    const safeList = Array.isArray(list) ? list.slice(0, NOTIFICATION_LIMIT) : [];
    saveJsonToLocalStorage(notificationStorageKey(username), safeList);
}

function loadOrderSnapshot(username = getUsername()) {
    if (!username) {
        return {};
    }
    const snapshot = loadJsonFromLocalStorage(orderSnapshotStorageKey(username), {});
    return snapshot && typeof snapshot === "object" ? snapshot : {};
}

function saveOrderSnapshot(snapshot, username = getUsername()) {
    if (!username) {
        return;
    }
    const safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
    saveJsonToLocalStorage(orderSnapshotStorageKey(username), safeSnapshot);
}

function showToast(message) {
    const text = String(message || "").trim();
    if (!text) {
        return;
    }

    let holder = document.getElementById("toast");
    if (!holder) {
        holder = document.createElement("div");
        holder.id = "toast";
        holder.className = "toast";
        document.body.appendChild(holder);
    }

    holder.textContent = text;
    holder.classList.add("show");
    if (showToast.timer) {
        window.clearTimeout(showToast.timer);
    }
    showToast.timer = window.setTimeout(() => {
        holder.classList.remove("show");
    }, 1700);
}

function formatNotificationTime(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) {
        return "Vừa xong";
    }
    if (diffMin < 60) {
        return `${diffMin} phút trước`;
    }
    if (diffMin < 1440) {
        const diffHour = Math.floor(diffMin / 60);
        return `${diffHour} giờ trước`;
    }

    return new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit"
    }).format(date);
}

function closeNotificationPanel() {
    const panel = document.getElementById("notification-panel");
    const btn = document.getElementById("notification-btn");
    if (panel) {
        panel.hidden = true;
    }
    if (btn) {
        btn.setAttribute("aria-expanded", "false");
    }
}

function openNotificationPanel() {
    const panel = document.getElementById("notification-panel");
    const btn = document.getElementById("notification-btn");
    if (!panel || !btn) {
        return;
    }
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
}

function renderNotificationCenter() {
    const username = getUsername();
    const wrap = document.getElementById("customer-notification-wrap");
    const btn = document.getElementById("notification-btn");
    const badge = document.getElementById("notification-badge");
    const listEl = document.getElementById("notification-list");

    if (!wrap || !btn || !badge || !listEl) {
        return;
    }

    if (!username) {
        wrap.style.display = "inline-flex";
        badge.textContent = "0";
        badge.style.display = "none";
        listEl.innerHTML = `
            <div class="notification-empty muted">Đăng nhập để xem thông báo đơn hàng.</div>
            <a class="notification-empty-link" href="/login">Đăng nhập ngay</a>
        `;
        return;
    }

    wrap.style.display = "inline-flex";
    const list = loadNotifications(username);
    const unreadCount = list.reduce((sum, item) => sum + (item.read ? 0 : 1), 0);
    badge.textContent = String(unreadCount);
    badge.style.display = unreadCount > 0 ? "inline-flex" : "none";

    if (!list.length) {
        listEl.innerHTML = `<div class="notification-empty muted">Chưa có thông báo mới.</div>`;
        return;
    }

    listEl.innerHTML = list.map((item) => {
        const orderId = Number(item.orderId || 0);
        const hasOrderLink = orderId > 0;
        return `
            <button
                class="notification-item ${item.read ? "" : "is-unread"}"
                type="button"
                data-notification-id="${escapeHtml(item.id)}"
                ${hasOrderLink ? `data-order-id="${orderId}"` : ""}
            >
                <div class="notification-item-head">
                    <strong>${escapeHtml(item.title)}</strong>
                    <time>${escapeHtml(formatNotificationTime(item.createdAt))}</time>
                </div>
                <div class="notification-item-body">${escapeHtml(item.message)}</div>
                ${hasOrderLink ? `<div class="notification-item-meta">Xem đơn #${orderId}</div>` : ""}
            </button>
        `;
    }).join("");
}

function markNotificationRead(notificationId) {
    const username = getUsername();
    if (!username || !notificationId) {
        return;
    }
    const list = loadNotifications(username);
    let changed = false;
    const next = list.map((item) => {
        if (item.id !== notificationId || item.read) {
            return item;
        }
        changed = true;
        return { ...item, read: true };
    });
    if (!changed) {
        return;
    }
    saveNotifications(next, username);
    renderNotificationCenter();
}

function markAllNotificationsRead() {
    const username = getUsername();
    if (!username) {
        return;
    }
    const list = loadNotifications(username);
    if (!list.length) {
        return;
    }
    saveNotifications(list.map((item) => ({ ...item, read: true })), username);
    renderNotificationCenter();
}

function clearAllNotifications() {
    const username = getUsername();
    if (!username) {
        return;
    }
    saveNotifications([], username);
    renderNotificationCenter();
}

function pushNotification(payload = {}) {
    const username = getUsername();
    if (!username) {
        return false;
    }

    const title = String(payload.title || "").trim();
    const message = String(payload.message || "").trim();
    if (!title && !message) {
        return false;
    }

    const orderIdRaw = Number(payload.orderId || 0);
    const orderId = Number.isFinite(orderIdRaw) && orderIdRaw > 0 ? Math.floor(orderIdRaw) : 0;
    const eventKey = String(payload.eventKey || "").trim();
    const createdAt = payload.createdAt ? new Date(payload.createdAt) : new Date();
    const createdAtIso = Number.isNaN(createdAt.getTime()) ? new Date().toISOString() : createdAt.toISOString();

    const list = loadNotifications(username);
    if (eventKey && list.some((item) => item.eventKey && item.eventKey === eventKey)) {
        return false;
    }

    list.unshift({
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        eventKey,
        type: String(payload.type || "general"),
        title: title || "Thông báo",
        message: message || title || "Bạn có thông báo mới.",
        orderId,
        read: false,
        createdAt: createdAtIso
    });

    saveNotifications(list, username);
    renderNotificationCenter();
    if (!payload.silentToast) {
        showToast(title || message || "Bạn có thông báo mới");
    }
    return true;
}

function notifyOrderPlaced(orderId, isOnlineGateway) {
    const safeOrderId = Number(orderId || 0);
    if (!safeOrderId) {
        return;
    }
    pushNotification({
        type: "order",
        eventKey: `order-created:${safeOrderId}`,
        title: "Đặt hàng thành công",
        message: isOnlineGateway
            ? `Đơn #${safeOrderId} đã được tạo. Vui lòng hoàn tất thanh toán online.`
            : `Đơn #${safeOrderId} đã được tạo thành công.`,
        orderId: safeOrderId
    });
}

function notifyPaymentSuccess(orderId, provider) {
    const safeOrderId = Number(orderId || 0);
    const safeProvider = paymentProviderLabel(provider);
    pushNotification({
        type: "payment",
        eventKey: `payment-success:${safeOrderId || "unknown"}:${String(provider || "").toUpperCase()}`,
        title: "Thanh toán thành công",
        message: safeOrderId
            ? `Đơn #${safeOrderId} đã được thanh toán qua ${safeProvider}.`
            : `Thanh toán qua ${safeProvider} đã thành công.`,
        orderId: safeOrderId
    });
}

function ensureNotificationWidget() {
    const actions = document.querySelector(".header-actions");
    if (!actions) {
        return null;
    }

    let wrap = document.getElementById("customer-notification-wrap");
    if (!wrap) {
        wrap = document.createElement("div");
        wrap.id = "customer-notification-wrap";
        wrap.className = "notification-wrap";
        wrap.innerHTML = `
            <button
                id="notification-btn"
                class="action notification-btn"
                type="button"
                aria-label="Thông báo"
                aria-haspopup="dialog"
                aria-expanded="false"
                aria-controls="notification-panel"
            >
                <span class="icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                        <path d="M6 9a6 6 0 1 1 12 0v5l2 2H4l2-2V9Z"></path>
                        <path d="M10 18a2 2 0 0 0 4 0"></path>
                    </svg>
                </span>
                <span class="action-label">Thông báo</span>
                <span id="notification-badge" class="badge" style="display:none;">0</span>
            </button>
            <div id="notification-panel" class="notification-panel" hidden>
                <div class="notification-panel-head">
                    <strong>Thông báo</strong>
                    <div class="notification-panel-tools">
                        <a class="notification-tool-link" href="/notifications">Xem trang</a>
                        <button type="button" class="notification-tool-btn" data-notification-action="mark-all-read">Đọc hết</button>
                        <button type="button" class="notification-tool-btn" data-notification-action="clear-all">Xóa</button>
                    </div>
                </div>
                <div id="notification-list" class="notification-list"></div>
            </div>
        `;

        const ordersLink = document.getElementById("orders-link");
        if (ordersLink && ordersLink.parentElement === actions) {
            if (ordersLink.nextSibling) {
                actions.insertBefore(wrap, ordersLink.nextSibling);
            } else {
                actions.appendChild(wrap);
            }
        } else {
            actions.insertBefore(wrap, actions.firstChild);
        }
    }

    if (wrap.dataset.bound !== "1") {
        wrap.dataset.bound = "1";
        const btn = wrap.querySelector("#notification-btn");
        const panel = wrap.querySelector("#notification-panel");
        const canHoverOpenPanel = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

        if (wrap && panel) {
            wrap.addEventListener("mouseenter", () => {
                if (!canHoverOpenPanel()) {
                    return;
                }
                openNotificationPanel();
                renderNotificationCenter();
            });

            wrap.addEventListener("mouseleave", () => {
                if (!canHoverOpenPanel()) {
                    return;
                }
                closeNotificationPanel();
            });
        }

        if (btn) {
            btn.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                window.location.href = "/notifications";
            });
        }

        if (panel) {
            panel.addEventListener("click", (event) => {
                const actionBtn = event.target.closest("[data-notification-action]");
                if (actionBtn) {
                    const action = actionBtn.getAttribute("data-notification-action");
                    if (action === "mark-all-read") {
                        markAllNotificationsRead();
                    } else if (action === "clear-all") {
                        clearAllNotifications();
                    }
                    return;
                }

                const item = event.target.closest(".notification-item");
                if (!item) {
                    return;
                }
                const notificationId = item.getAttribute("data-notification-id");
                if (notificationId) {
                    markNotificationRead(notificationId);
                }

                const orderId = Number(item.getAttribute("data-order-id") || 0);
                closeNotificationPanel();
                if (orderId > 0) {
                    window.location.href = `/orders/${encodeURIComponent(orderId)}`;
                }
            });
        }
    }

    if (!notificationDocumentEventsBound) {
        notificationDocumentEventsBound = true;
        document.addEventListener("click", (event) => {
            const wrapEl = document.getElementById("customer-notification-wrap");
            const panel = document.getElementById("notification-panel");
            if (!wrapEl || !panel || panel.hidden) {
                return;
            }
            if (wrapEl.contains(event.target)) {
                return;
            }
            closeNotificationPanel();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeNotificationPanel();
            }
        });
    }

    return wrap;
}

function canRenderSupportChat() {
    const path = String(window.location.pathname || "");
    if (path.startsWith("/admin")) {
        return false;
    }

    if (!getToken() || !getUsername()) {
        return true;
    }

    const currentRole = String(getRole() || "").trim().toUpperCase();
    return !currentRole || currentRole === "CUSTOMER";
}

function isCustomerSignedIn() {
    return Boolean(getToken() && getUsername() && String(getRole() || "").trim().toUpperCase() === "CUSTOMER");
}

function supportChatElements() {
    return {
        widget: document.getElementById("support-chat-widget"),
        toggle: document.getElementById("support-chat-toggle"),
        badge: document.getElementById("support-chat-badge"),
        panel: document.getElementById("support-chat-panel"),
        thread: document.getElementById("support-chat-thread"),
        form: document.getElementById("support-chat-form"),
        input: document.getElementById("support-chat-input"),
        send: document.getElementById("support-chat-send")
    };
}

function setSupportChatBadge(count) {
    const { badge } = supportChatElements();
    if (!badge) {
        return;
    }

    const unread = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
    badge.textContent = String(unread);
    badge.style.display = unread > 0 ? "inline-flex" : "none";
}

function setSupportChatFormState(enabled) {
    const { input, send } = supportChatElements();
    const allow = Boolean(enabled);
    if (input) {
        input.disabled = !allow;
    }
    if (send) {
        send.disabled = !allow || supportChatSending;
    }
}

function formatSupportChatTime(value) {
    if (!value) {
        return "";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value).replace("T", " ").slice(0, 16);
    }

    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    }).format(parsed);
}

function renderSupportChatGuestState() {
    const { thread } = supportChatElements();
    if (!thread) {
        return;
    }

    thread.innerHTML = `
        <div class="support-chat-empty">
            <strong>Đăng nhập để nhắn tin với admin</strong>
            <p class="muted">Bạn cần đăng nhập tài khoản khách hàng để sử dụng chat hỗ trợ.</p>
            <a class="support-chat-login" href="/login">Đăng nhập ngay</a>
        </div>
    `;
    setSupportChatFormState(false);
}

function renderSupportChatConversation() {
    const { thread } = supportChatElements();
    if (!thread) {
        return;
    }

    if (!isCustomerSignedIn()) {
        renderSupportChatGuestState();
        return;
    }

    const conversation = supportChatConversation;
    const messages = Array.isArray(conversation && conversation.messages) ? conversation.messages : [];
    if (!messages.length) {
        thread.innerHTML = `
            <div class="support-chat-empty">
                <strong>Chưa có tin nhắn</strong>
                <p class="muted">Hãy gửi tin nhắn đầu tiên để được admin hỗ trợ.</p>
            </div>
        `;
        setSupportChatFormState(true);
        return;
    }

    thread.innerHTML = messages.map((message) => {
        const isMine = !!(message && message.fromCurrentUser);
        const sender = String(message && message.senderDisplayName ? message.senderDisplayName : (isMine ? "Bạn" : "Admin")).trim();
        const content = String(message && message.content ? message.content : "");

        return `
            <article class="support-chat-message ${isMine ? "is-mine" : "is-admin"}">
                <div class="support-chat-message-head">
                    <strong>${escapeHtml(sender)}</strong>
                    <time>${escapeHtml(formatSupportChatTime(message && message.createdAt))}</time>
                </div>
                <p>${escapeHtml(content)}</p>
            </article>
        `;
    }).join("");

    thread.scrollTop = thread.scrollHeight;
    setSupportChatFormState(true);
}

function isSupportChatOpen() {
    const { panel } = supportChatElements();
    return Boolean(panel && !panel.hidden);
}

function closeSupportChatPanel() {
    const { panel, toggle } = supportChatElements();
    if (panel) {
        panel.hidden = true;
    }
    if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
    }
}

async function openSupportChatPanel() {
    ensureSupportChatWidget();
    const { panel, toggle, input } = supportChatElements();
    if (!panel || !toggle) {
        return;
    }

    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");

    if (!isCustomerSignedIn()) {
        renderSupportChatGuestState();
        return;
    }

    await refreshSupportChatConversation(true).catch(() => {
        // Errors are shown in the chat panel via fallback states.
    });

    if (input && !input.disabled) {
        input.focus();
    }
}

function ensureSupportChatWidget() {
    if (!canRenderSupportChat()) {
        stopSupportChatPolling();
        const existing = document.getElementById("support-chat-widget");
        if (existing) {
            existing.remove();
        }
        return null;
    }

    let widget = document.getElementById("support-chat-widget");
    if (!widget) {
        widget = document.createElement("div");
        widget.id = "support-chat-widget";
        widget.className = "support-chat-widget";
        widget.innerHTML = `
            <button
                id="support-chat-toggle"
                class="support-chat-toggle"
                type="button"
                aria-label="Chat hỗ trợ"
                aria-haspopup="dialog"
                aria-expanded="false"
                aria-controls="support-chat-panel"
            >
                <span class="icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                        <path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4V7a2 2 0 0 1 2-2Z"></path>
                        <path d="M8 10h8"></path>
                        <path d="M8 14h5"></path>
                    </svg>
                </span>
                <span class="support-chat-toggle-label">Hỗ trợ</span>
                <span id="support-chat-badge" class="badge" style="display:none;">0</span>
            </button>

            <section id="support-chat-panel" class="support-chat-panel" hidden>
                <div class="support-chat-head">
                    <strong>Chat với admin</strong>
                    <button id="support-chat-close" class="support-chat-close" type="button" aria-label="Đóng">×</button>
                </div>
                <div id="support-chat-thread" class="support-chat-thread"></div>
                <form id="support-chat-form" class="support-chat-form">
                    <textarea
                        id="support-chat-input"
                        class="textarea"
                        rows="2"
                        maxlength="4000"
                        placeholder="Nhập nội dung cần hỗ trợ..."
                        required
                    ></textarea>
                    <button id="support-chat-send" class="btn btn-primary btn-sm" type="submit">Gửi</button>
                </form>
            </section>
        `;
        document.body.appendChild(widget);
    }

    if (widget.dataset.bound !== "1") {
        widget.dataset.bound = "1";
        const { toggle, form } = supportChatElements();
        const closeBtn = document.getElementById("support-chat-close");

        if (toggle) {
            toggle.addEventListener("click", async (event) => {
                event.preventDefault();
                if (isSupportChatOpen()) {
                    closeSupportChatPanel();
                    return;
                }
                await openSupportChatPanel();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                closeSupportChatPanel();
            });
        }

        if (form) {
            form.addEventListener("submit", sendSupportChatMessage);
        }
    }

    if (!supportChatDocumentEventsBound) {
        supportChatDocumentEventsBound = true;
        document.addEventListener("click", (event) => {
            const { widget, panel } = supportChatElements();
            if (!widget || !panel || panel.hidden) {
                return;
            }
            if (widget.contains(event.target)) {
                return;
            }
            closeSupportChatPanel();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeSupportChatPanel();
            }
        });
    }

    if (isCustomerSignedIn()) {
        setSupportChatFormState(true);
    } else {
        setSupportChatFormState(false);
    }

    return widget;
}

async function refreshSupportChatSummary() {
    if (!isCustomerSignedIn()) {
        setSupportChatBadge(0);
        return null;
    }

    const response = await fetch("/api/customer/messages/summary", {
        headers: {
            ...authHeader()
        },
        credentials: "same-origin"
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            supportChatConversation = null;
            stopSupportChatPolling();
            setSupportChatBadge(0);
            return null;
        }
        return null;
    }

    const data = await response.json().catch(() => null);
    setSupportChatBadge(data && data.unreadForCustomer ? data.unreadForCustomer : 0);
    return data;
}

async function refreshSupportChatConversation(markRead = false) {
    if (!isCustomerSignedIn()) {
        supportChatConversation = null;
        setSupportChatBadge(0);
        renderSupportChatGuestState();
        return null;
    }

    const params = new URLSearchParams();
    params.set("markRead", markRead ? "true" : "false");

    const response = await fetch(`/api/customer/messages?${params.toString()}`, {
        headers: {
            ...authHeader()
        },
        credentials: "same-origin"
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            supportChatConversation = null;
            setSupportChatBadge(0);
            stopSupportChatPolling();
            renderSupportChatGuestState();
            return null;
        }

        const { thread } = supportChatElements();
        if (thread) {
            thread.innerHTML = `
                <div class="support-chat-empty">
                    <strong>Không tải được hội thoại</strong>
                    <p class="muted">${escapeHtml(await parseError(response, "Vui lòng thử lại sau."))}</p>
                </div>
            `;
        }
        throw new Error("Không tải được hội thoại hỗ trợ");
    }

    supportChatConversation = await response.json().catch(() => null);
    setSupportChatBadge(supportChatConversation && supportChatConversation.unreadForCustomer ? supportChatConversation.unreadForCustomer : 0);
    renderSupportChatConversation();
    return supportChatConversation;
}

async function sendSupportChatMessage(event) {
    if (event) {
        event.preventDefault();
    }

    if (!isCustomerSignedIn()) {
        setRedirectAndGoLogin();
        return;
    }

    if (supportChatSending) {
        return;
    }

    const { input, send } = supportChatElements();
    const content = String(input ? input.value : "").trim();
    if (!content) {
        return;
    }

    supportChatSending = true;
    if (send) {
        send.disabled = true;
    }

    try {
        const response = await fetch("/api/customer/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeader()
            },
            credentials: "same-origin",
            body: JSON.stringify({ content })
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                supportChatConversation = null;
                stopSupportChatPolling();
                renderSupportChatGuestState();
                return;
            }

            const { thread } = supportChatElements();
            if (thread) {
                thread.insertAdjacentHTML("beforeend", `
                    <div class="support-chat-inline-error">${escapeHtml(await parseError(response, "Không gửi được tin nhắn."))}</div>
                `);
            }
            return;
        }

        if (input) {
            input.value = "";
        }
        await refreshSupportChatConversation(true);
    } finally {
        supportChatSending = false;
        setSupportChatFormState(isCustomerSignedIn());
    }
}

async function pollSupportChat() {
    if (supportChatPollingPending) {
        return;
    }
    if (!isCustomerSignedIn()) {
        stopSupportChatPolling();
        return;
    }

    supportChatPollingPending = true;
    try {
        if (isSupportChatOpen()) {
            await refreshSupportChatConversation(true);
        } else {
            await refreshSupportChatSummary();
        }
    } catch (_) {
        // Ignore intermittent polling failures.
    } finally {
        supportChatPollingPending = false;
    }
}

function startSupportChatPolling() {
    if (!isCustomerSignedIn()) {
        stopSupportChatPolling();
        return;
    }

    if (!supportChatPollingTimer) {
        pollSupportChat();
        supportChatPollingTimer = window.setInterval(pollSupportChat, SUPPORT_CHAT_POLL_MS);
    }
}

function stopSupportChatPolling() {
    if (supportChatPollingTimer) {
        window.clearInterval(supportChatPollingTimer);
        supportChatPollingTimer = null;
    }
    supportChatPollingPending = false;
}

function refreshSupportChatWidget() {
    const widget = ensureSupportChatWidget();
    if (!widget) {
        return;
    }

    if (!isCustomerSignedIn()) {
        supportChatConversation = null;
        stopSupportChatPolling();
        setSupportChatBadge(0);
        if (isSupportChatOpen()) {
            renderSupportChatGuestState();
        }
        return;
    }

    if (isSupportChatOpen()) {
        refreshSupportChatConversation(true).catch(() => {
            // UI fallback is handled in refreshSupportChatConversation.
        });
    } else {
        refreshSupportChatSummary().catch(() => {
            // Ignore background refresh errors.
        });
    }

    startSupportChatPolling();
}

function stopOrderStatusWatcher() {
    if (orderStatusWatcherTimer) {
        window.clearInterval(orderStatusWatcherTimer);
        orderStatusWatcherTimer = null;
    }
    orderStatusWatcherPending = false;
}

function buildOrderSnapshot(orders) {
    const snapshot = {};
    (Array.isArray(orders) ? orders : []).forEach((order) => {
        const id = Number(order && order.id ? order.id : 0);
        if (!id) {
            return;
        }
        snapshot[String(id)] = {
            status: String(order && order.status ? order.status : ""),
            onlinePaymentStatus: String(order && order.onlinePaymentStatus ? order.onlinePaymentStatus : "")
        };
    });
    return snapshot;
}

async function pollOrderStatusChanges() {
    const username = getUsername();
    if (!username || !getToken() || orderStatusWatcherPending) {
        return;
    }

    orderStatusWatcherPending = true;
    try {
        const response = await fetch("/api/customer/orders", {
            headers: {
                ...authHeader()
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                logout(false);
            }
            return;
        }

        const orders = await response.json().catch(() => []);
        const currentSnapshot = buildOrderSnapshot(orders);
        const previousSnapshot = loadOrderSnapshot(username);
        const hasPreviousSnapshot = previousSnapshot && Object.keys(previousSnapshot).length > 0;

        if (hasPreviousSnapshot) {
            Object.entries(currentSnapshot).forEach(([id, currentState]) => {
                const previousState = previousSnapshot[id];
                if (!previousState) {
                    return;
                }

                if (previousState.status !== currentState.status && currentState.status) {
                    pushNotification({
                        type: "order-status",
                        eventKey: `order-status:${id}:${currentState.status}`,
                        title: `Đơn #${id} cập nhật`,
                        message: `Trạng thái đơn đã chuyển sang "${orderStatusLabel(currentState.status)}".`,
                        orderId: Number(id)
                    });
                }

                if (previousState.onlinePaymentStatus !== currentState.onlinePaymentStatus && currentState.onlinePaymentStatus) {
                    if (currentState.onlinePaymentStatus === "PAID") {
                        pushNotification({
                            type: "payment-status",
                            eventKey: `payment-status:${id}:PAID`,
                            title: "Thanh toán thành công",
                            message: `Đơn #${id} đã được xác nhận thanh toán.`,
                            orderId: Number(id)
                        });
                    } else if (currentState.onlinePaymentStatus === "FAILED") {
                        pushNotification({
                            type: "payment-status",
                            eventKey: `payment-status:${id}:FAILED`,
                            title: "Thanh toán thất bại",
                            message: `Đơn #${id}: ${onlinePaymentStatusLabel(currentState.onlinePaymentStatus)}.`,
                            orderId: Number(id)
                        });
                    }
                }
            });
        }

        saveOrderSnapshot(currentSnapshot, username);
    } catch (_) {
        // Ignore intermittent network errors for passive polling.
    } finally {
        orderStatusWatcherPending = false;
    }
}

function startOrderStatusWatcher() {
    if (orderStatusWatcherTimer || !getUsername() || !getToken()) {
        return;
    }
    pollOrderStatusChanges();
    orderStatusWatcherTimer = window.setInterval(pollOrderStatusChanges, ORDER_STATUS_POLL_MS);
}

function getToken() {
    return localStorage.getItem("techstore_token");
}

function getRole() {
    return localStorage.getItem("techstore_role");
}

function getUsername() {
    return localStorage.getItem("techstore_user");
}

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function resetCartCache() {
    cartCache = [];
    cartOwner = null;
    cartLoaded = false;
    cartRequest = null;
}

function normalizeCartItems(items) {
    return (items || []).map((item) => {
        const pricing = resolveProductPricing({
            originalPrice: item.originalPrice ?? item.price,
            discountPercent: item.discountPercent,
            finalPrice: item.finalPrice ?? item.price
        });

        return {
            ...pricing,
            productId: Number(item.productId || 0),
            productName: item.productName || "Sản phẩm",
            variantId: Number(item.variantId || 0),
            variantName: item.variantName || "",
            price: pricing.finalPrice,
            imageUrl: item.imageUrl || "",
            stock: Number(item.stock || 0),
            quantity: Number(item.quantity || 0)
        };
    }).filter((item) => item.productId > 0 && item.quantity > 0);
}

function applyCartResponse(data) {
    cartCache = normalizeCartItems(data && data.items ? data.items : []);
    cartOwner = getUsername();
    cartLoaded = true;
    return getCart();
}

async function parseError(response, fallback) {
    const data = await response.json().catch(() => ({}));
    if (data && typeof data === "object" && data.message) {
        return data.message;
    }
    return fallback;
}

async function fetchCart(force = false) {
    const token = getToken();
    const username = getUsername();
    if (!token || !username) {
        resetCartCache();
        return [];
    }

    if (cartOwner && cartOwner !== username) {
        resetCartCache();
    }

    if (!force && cartLoaded && cartOwner === username) {
        return getCart();
    }

    if (!force && cartRequest) {
        return cartRequest;
    }

    cartRequest = (async () => {
        const response = await fetch("/api/customer/cart", {
            headers: {
                ...authHeader()
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                // Session is no longer valid.
                logout(false);
                throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
            }

            throw new Error(await parseError(response, "Không tải được giỏ hàng"));
        }

        const data = await response.json();
        return applyCartResponse(data);
    })();

    try {
        return await cartRequest;
    } finally {
        cartRequest = null;
    }
}

function getCart() {
    // Keep API backward-compatible for existing pages.
    return cartCache.map((item) => ({ ...item }));
}

function saveCart(cart) {
    // Deprecated local cart helper: keep in-memory only for compatibility.
    cartCache = normalizeCartItems(cart);
    cartLoaded = true;
    cartOwner = getUsername() || cartOwner;
}

function cartCount() {
    return cartCache.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

function cartTotal() {
    return cartCache.reduce((sum, item) => sum + (item.finalPrice || item.price || 0) * (item.quantity || 0), 0);
}

function renderCartBadge() {
    const badge = document.getElementById("cart-badge");
    if (!badge) {
        return;
    }

    const count = cartCount();
    badge.textContent = String(count);
    badge.style.display = count > 0 ? "inline-flex" : "none";
}

async function callCartApi(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...authHeader(),
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            logout(false);
            throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        }

        throw new Error(await parseError(response, "Không cập nhật được giỏ hàng"));
    }

    const data = await response.json();
    applyCartResponse(data);
    renderCartBadge();
    return getCart();
}

function setRedirectAndGoLogin() {
    sessionStorage.setItem("techstore_redirect", window.location.pathname + window.location.search);
    window.location.href = "/login";
}

function ensureLoggedIn() {
    if (!getToken()) {
        setRedirectAndGoLogin();
        return false;
    }
    return true;
}

function updateHeader() {
    // Start with current cache, then refresh from DB in background when logged in.
    renderCartBadge();
    ensureNotificationWidget();
    renderNotificationCenter();
    refreshSupportChatWidget();

    const loginLink = document.getElementById("login-link");
    const registerLink = document.getElementById("register-link");
    const logoutBtn = document.getElementById("logout-btn");
    const ordersLink = document.getElementById("orders-link");
    const adminLink = document.getElementById("admin-link");

    const username = getUsername();
    const role = getRole();

    if (!username) {
        if (loginLink) {
            loginLink.style.display = "inline-flex";
            loginLink.href = "/login";

            const label = loginLink.querySelector("[data-login-label]");
            if (label) {
                label.textContent = "Đăng nhập";
            } else {
                loginLink.textContent = "Đăng nhập";
            }

            loginLink.removeAttribute("title");
        }

        if (registerLink) registerLink.style.display = "inline-flex";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (ordersLink) ordersLink.style.display = "none";
        if (adminLink) adminLink.style.display = "none";
        const notificationWrap = document.getElementById("customer-notification-wrap");
        if (notificationWrap) {
            notificationWrap.style.display = "inline-flex";
        }
        renderNotificationCenter();
        stopOrderStatusWatcher();
        resetCartCache();
        renderCartBadge();
        return;
    }

    if (loginLink) {
        loginLink.style.display = "inline-flex";

        const label = loginLink.querySelector("[data-login-label]");
        if (label) {
            label.textContent = username;
        } else {
            loginLink.textContent = username;
        }

        loginLink.href = "/account";
        loginLink.title = "Xem tài khoản của bạn";
    }

    if (registerLink) registerLink.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-flex";
    if (ordersLink) ordersLink.style.display = "inline-flex";
    const notificationWrap = document.getElementById("customer-notification-wrap");
    if (notificationWrap) {
        notificationWrap.style.display = "inline-flex";
    }
    renderNotificationCenter();
    startOrderStatusWatcher();

    if (adminLink) {
        const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
        adminLink.style.display = isAdmin ? "inline-flex" : "none";
    }

    fetchCart(false)
        .then(() => renderCartBadge())
        .catch(() => {
            // Keep UI usable even if cart request fails.
        });
}

function notifyServerLogout() {
    // Ask backend to clear HttpOnly auth cookie used for server-side route protection.
    fetch("/api/auth/logout", {
        method: "POST",
        headers: {
            ...authHeader()
        },
        credentials: "same-origin"
    }).catch(() => {
        // Logout on server is best-effort; local logout still proceeds.
    });
}

function logout(redirectHome = true) {
    notifyServerLogout();
    stopOrderStatusWatcher();
    stopSupportChatPolling();
    closeSupportChatPanel();
    closeNotificationPanel();
    localStorage.removeItem("techstore_token");
    localStorage.removeItem("techstore_role");
    localStorage.removeItem("techstore_user");
    localStorage.removeItem("techstore_cart"); // Cleanup old legacy key.
    resetCartCache();
    renderCartBadge();

    if (redirectHome) {
        window.location.href = "/";
    }
}

async function addToCart(product, quantity) {
    if (!ensureLoggedIn()) {
        return getCart();
    }

    const productId = Number(product && (product.productId || product.id));
    if (!productId) {
        throw new Error("Sản phẩm không hợp lệ");
    }
    const variantId = Number(product && product.variantId ? product.variantId : 0);

    const qty = Math.max(1, Number(quantity || 1));
    const payload = { productId, quantity: qty };
    if (Number.isFinite(variantId) && variantId > 0) {
        payload.variantId = variantId;
    }
    const updatedCart = await callCartApi("/api/customer/cart/items", {
        method: "POST",
        body: JSON.stringify(payload)
    });

    const productName = String(product && (product.productName || product.name) ? (product.productName || product.name) : "Sản phẩm");
    pushNotification({
        type: "cart",
        title: "Đã thêm vào giỏ hàng",
        message: `${productName} (x${qty}) đã được thêm vào giỏ hàng.`
    });
    return updatedCart;
}

function cartItemEndpoint(productId, variantId) {
    const baseUrl = `/api/customer/cart/items/${encodeURIComponent(productId)}`;
    const normalizedVariantId = Number(variantId || 0);
    if (!Number.isFinite(normalizedVariantId) || normalizedVariantId <= 0) {
        return baseUrl;
    }
    const params = new URLSearchParams({ variantId: String(normalizedVariantId) });
    return `${baseUrl}?${params.toString()}`;
}

async function removeFromCart(productId, variantId = null) {
    if (!ensureLoggedIn()) {
        return getCart();
    }

    return callCartApi(cartItemEndpoint(productId, variantId), {
        method: "DELETE"
    });
}

async function setCartQuantity(productId, quantity, variantId = null) {
    if (!ensureLoggedIn()) {
        return getCart();
    }

    const qty = Math.max(1, Number(quantity || 1));
    return callCartApi(cartItemEndpoint(productId, variantId), {
        method: "PUT",
        body: JSON.stringify({ quantity: qty })
    });
}

async function clearCart() {
    if (!ensureLoggedIn()) {
        return [];
    }

    return callCartApi("/api/customer/cart", {
        method: "DELETE"
    });
}

function goCart(event) {
    if (event) {
        event.preventDefault();
    }

    if (!ensureLoggedIn()) {
        return false;
    }

    window.location.href = "/cart";
    return false;
}

async function goCheckoutFromCart() {
    if (!ensureLoggedIn()) {
        return;
    }

    try {
        const cart = await fetchCart(true);
        if (!cart.length) {
            window.location.href = "/cart";
            return;
        }
        window.location.href = "/checkout";
    } catch (err) {
        alert(err.message || "Không thể kiểm tra giỏ hàng");
    }
}

function getHeaderSearchInput() {
    return document.getElementById("search");
}

function getHeaderSearchWrap() {
    const input = getHeaderSearchInput();
    return input ? input.closest(".header-search") : null;
}

function mapHeaderSearchProduct(raw) {
    const id = Number(raw && (raw.id ?? raw.productId));
    const name = String(raw && (raw.name ?? raw.productName) ? (raw.name ?? raw.productName) : "").trim();
    if (!id || !name) {
        return null;
    }

    const categoryName = String(raw?.category?.name || raw?.categoryName || "").trim();
    const imageUrl = String(raw && raw.imageUrl ? raw.imageUrl : "").trim();
    const pricing = resolveProductPricing(raw || {});

    return {
        id,
        name,
        categoryName,
        imageUrl,
        pricing,
        normalizedName: normalizeSearchText(name)
    };
}

async function fetchHeaderSearchProducts(force = false) {
    if (!force && Array.isArray(headerSearchProductsCache)) {
        return headerSearchProductsCache;
    }

    if (!force && headerSearchProductsRequest) {
        return headerSearchProductsRequest;
    }

    headerSearchProductsRequest = fetch("/api/public/products", {
        credentials: "same-origin"
    })
        .then(async (response) => {
            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                return [];
            }

            return data
                .map((item) => mapHeaderSearchProduct(item))
                .filter(Boolean);
        })
        .catch(() => [])
        .finally(() => {
            headerSearchProductsRequest = null;
        });

    const list = await headerSearchProductsRequest;
    headerSearchProductsCache = Array.isArray(list) ? list : [];
    return headerSearchProductsCache;
}

function ensureHeaderSearchSuggestPanel() {
    const wrap = getHeaderSearchWrap();
    if (!wrap) {
        return null;
    }

    let panel = wrap.querySelector(".header-search-suggest");
    if (!panel) {
        panel = document.createElement("div");
        panel.id = "header-search-suggest";
        panel.className = "header-search-suggest";
        panel.hidden = true;
        panel.setAttribute("role", "listbox");
        wrap.appendChild(panel);
    }

    return panel;
}

function isHeaderSearchSuggestOpen() {
    const wrap = getHeaderSearchWrap();
    if (!wrap) {
        return false;
    }
    const panel = wrap.querySelector(".header-search-suggest");
    return !!(panel && !panel.hidden);
}

function closeHeaderSearchSuggestions(invalidateRequest = false) {
    if (headerSearchSuggestDebounceTimer) {
        window.clearTimeout(headerSearchSuggestDebounceTimer);
        headerSearchSuggestDebounceTimer = null;
    }

    if (invalidateRequest) {
        headerSearchSuggestRequestSeq += 1;
    }

    const wrap = getHeaderSearchWrap();
    const panel = wrap ? wrap.querySelector(".header-search-suggest") : null;
    if (panel) {
        panel.hidden = true;
        panel.innerHTML = "";
    }
    if (wrap) {
        wrap.classList.remove("is-suggest-open");
    }

    const input = getHeaderSearchInput();
    if (input) {
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
    }

    headerSearchSuggestItems = [];
    headerSearchSuggestActiveIndex = -1;
}

function renderHeaderSearchSuggestState(className, message) {
    const input = getHeaderSearchInput();
    const wrap = getHeaderSearchWrap();
    const panel = ensureHeaderSearchSuggestPanel();
    if (!input || !wrap || !panel) {
        return;
    }

    headerSearchSuggestItems = [];
    headerSearchSuggestActiveIndex = -1;
    input.removeAttribute("aria-activedescendant");

    panel.innerHTML = `
        <div class="${className}">${escapeHtml(message)}</div>
    `;
    panel.hidden = false;
    wrap.classList.add("is-suggest-open");
    input.setAttribute("aria-expanded", "true");
}

function buildHeaderSearchSuggestItem(item, index) {
    const finalPrice = formatVnd(item && item.pricing ? item.pricing.finalPrice : 0);
    const hasDiscount = !!(item && item.pricing && item.pricing.hasDiscount);
    const originalPrice = hasDiscount ? formatVnd(item.pricing.originalPrice) : "";
    const category = item && item.categoryName ? item.categoryName : "Danh mục đang cập nhật";

    const thumbHtml = item && item.imageUrl
        ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy">`
        : `<span class="header-search-suggest-thumb-fallback" aria-hidden="true">SP</span>`;

    return `
        <button
            id="header-search-option-${index}"
            class="header-search-suggest-item"
            type="button"
            role="option"
            aria-selected="false"
            data-index="${index}"
        >
            <span class="header-search-suggest-thumb">${thumbHtml}</span>
            <span class="header-search-suggest-content">
                <span class="header-search-suggest-title">${escapeHtml(item.name)}</span>
                <span class="header-search-suggest-category">${escapeHtml(category)}</span>
            </span>
            <span class="header-search-suggest-prices">
                <strong>${escapeHtml(finalPrice)}</strong>
                ${hasDiscount ? `<small>${escapeHtml(originalPrice)}</small>` : ""}
            </span>
        </button>
    `;
}

function renderHeaderSearchSuggestions(items) {
    const input = getHeaderSearchInput();
    const wrap = getHeaderSearchWrap();
    const panel = ensureHeaderSearchSuggestPanel();
    if (!input || !wrap || !panel) {
        return;
    }

    headerSearchSuggestItems = Array.isArray(items) ? items : [];
    headerSearchSuggestActiveIndex = -1;
    input.removeAttribute("aria-activedescendant");

    if (!headerSearchSuggestItems.length) {
        renderHeaderSearchSuggestState("header-search-suggest-empty", "Không tìm thấy sản phẩm phù hợp.");
        return;
    }

    panel.innerHTML = headerSearchSuggestItems
        .map((item, index) => buildHeaderSearchSuggestItem(item, index))
        .join("");

    panel.hidden = false;
    wrap.classList.add("is-suggest-open");
    input.setAttribute("aria-expanded", "true");
}

function setHeaderSearchSuggestActive(index) {
    const panel = ensureHeaderSearchSuggestPanel();
    const input = getHeaderSearchInput();
    if (!panel || !input || !headerSearchSuggestItems.length) {
        return;
    }

    const nodes = Array.from(panel.querySelectorAll(".header-search-suggest-item"));
    if (!nodes.length) {
        return;
    }

    const safeIndex = ((Number(index) || 0) % nodes.length + nodes.length) % nodes.length;
    headerSearchSuggestActiveIndex = safeIndex;

    nodes.forEach((node, nodeIndex) => {
        const isActive = nodeIndex === safeIndex;
        node.classList.toggle("is-active", isActive);
        node.setAttribute("aria-selected", isActive ? "true" : "false");
        if (isActive) {
            node.scrollIntoView({
                block: "nearest"
            });
            if (node.id) {
                input.setAttribute("aria-activedescendant", node.id);
            }
        }
    });
}

function openHeaderSearchSuggestionAt(index) {
    const safeIndex = Number(index);
    if (!Number.isFinite(safeIndex) || safeIndex < 0 || safeIndex >= headerSearchSuggestItems.length) {
        return false;
    }

    const item = headerSearchSuggestItems[safeIndex];
    if (!item || !item.id) {
        return false;
    }

    window.location.href = `/product/${encodeURIComponent(item.id)}`;
    return true;
}

function findHeaderSearchSuggestions(keyword, products) {
    const normalizedKeyword = normalizeSearchText(keyword);
    if (!normalizedKeyword) {
        return [];
    }

    const tokens = normalizedKeyword.split(" ").filter(Boolean);
    if (!tokens.length) {
        return [];
    }

    return (products || [])
        .filter((product) => {
            if (!product || !product.normalizedName) {
                return false;
            }
            return tokens.every((token) => product.normalizedName.includes(token));
        })
        .map((product) => {
            const fullKeywordIndex = product.normalizedName.indexOf(normalizedKeyword);
            return {
                product,
                startsWithKeyword: product.normalizedName.startsWith(normalizedKeyword) ? 0 : 1,
                fullKeywordIndex: fullKeywordIndex >= 0 ? fullKeywordIndex : 999,
                nameLength: product.normalizedName.length
            };
        })
        .sort((a, b) => a.startsWithKeyword - b.startsWithKeyword
            || a.fullKeywordIndex - b.fullKeywordIndex
            || a.nameLength - b.nameLength
            || a.product.name.localeCompare(b.product.name, "vi"))
        .slice(0, HEADER_SEARCH_SUGGEST_LIMIT)
        .map((entry) => entry.product);
}

async function requestHeaderSearchSuggestions(keyword, requestSeq) {
    const normalizedKeyword = normalizeSearchText(keyword);
    if (!normalizedKeyword) {
        closeHeaderSearchSuggestions(true);
        return;
    }

    renderHeaderSearchSuggestState("header-search-suggest-loading", "Đang tìm sản phẩm...");

    const products = await fetchHeaderSearchProducts(false);
    if (requestSeq !== headerSearchSuggestRequestSeq) {
        return;
    }

    const matches = findHeaderSearchSuggestions(normalizedKeyword, products);
    renderHeaderSearchSuggestions(matches);
}

function scheduleHeaderSearchSuggestions() {
    const input = getHeaderSearchInput();
    if (!input) {
        return;
    }

    if (headerSearchSuggestDebounceTimer) {
        window.clearTimeout(headerSearchSuggestDebounceTimer);
        headerSearchSuggestDebounceTimer = null;
    }

    if (!input.value.trim()) {
        closeHeaderSearchSuggestions(true);
        return;
    }

    const requestSeq = ++headerSearchSuggestRequestSeq;
    headerSearchSuggestDebounceTimer = window.setTimeout(() => {
        headerSearchSuggestDebounceTimer = null;

        const currentInput = getHeaderSearchInput();
        const currentKeyword = currentInput ? currentInput.value.trim() : "";
        if (!currentKeyword) {
            closeHeaderSearchSuggestions(true);
            return;
        }

        requestHeaderSearchSuggestions(currentKeyword, requestSeq).catch(() => {
            if (requestSeq !== headerSearchSuggestRequestSeq) {
                return;
            }
            renderHeaderSearchSuggestState("header-search-suggest-error", "Không thể tải gợi ý lúc này.");
        });
    }, 180);
}

function searchFromHeader() {
    const input = getHeaderSearchInput();
    const keyword = input ? input.value.trim() : "";
    closeHeaderSearchSuggestions(true);

    const params = new URLSearchParams();
    if (keyword) {
        params.set("keyword", keyword);
    }
    window.location.href = "/?" + params.toString();
}

function wireHeaderSearchEnter() {
    const input = getHeaderSearchInput();
    if (!input) {
        return;
    }

    if (input.dataset.wiredEnter === "1") {
        return;
    }
    input.dataset.wiredEnter = "1";

    input.setAttribute("autocomplete", "off");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-haspopup", "listbox");
    input.setAttribute("aria-expanded", "false");

    ensureHeaderSearchSuggestPanel();

    input.addEventListener("input", () => {
        headerSearchSuggestActiveIndex = -1;
        scheduleHeaderSearchSuggestions();
    });

    input.addEventListener("focus", () => {
        if (input.value.trim()) {
            scheduleHeaderSearchSuggestions();
        }
    });

    input.addEventListener("keydown", (event) => {
        const hasSuggestions = isHeaderSearchSuggestOpen() && headerSearchSuggestItems.length > 0;

        if (event.key === "ArrowDown") {
            if (!hasSuggestions) {
                return;
            }
            event.preventDefault();
            const nextIndex = headerSearchSuggestActiveIndex < 0 ? 0 : headerSearchSuggestActiveIndex + 1;
            setHeaderSearchSuggestActive(nextIndex);
            return;
        }

        if (event.key === "ArrowUp") {
            if (!hasSuggestions) {
                return;
            }
            event.preventDefault();
            const nextIndex = headerSearchSuggestActiveIndex < 0
                ? headerSearchSuggestItems.length - 1
                : headerSearchSuggestActiveIndex - 1;
            setHeaderSearchSuggestActive(nextIndex);
            return;
        }

        if (event.key === "Escape") {
            if (!isHeaderSearchSuggestOpen()) {
                return;
            }
            event.preventDefault();
            closeHeaderSearchSuggestions(true);
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            if (hasSuggestions && headerSearchSuggestActiveIndex >= 0) {
                const navigated = openHeaderSearchSuggestionAt(headerSearchSuggestActiveIndex);
                if (navigated) {
                    return;
                }
            }
            searchFromHeader();
        }
    });

    const wrap = input.closest(".header-search");
    if (wrap) {
        wrap.addEventListener("mousedown", (event) => {
            if (event.target.closest(".header-search-suggest-item")) {
                event.preventDefault();
            }
        });

        wrap.addEventListener("mouseover", (event) => {
            const item = event.target.closest(".header-search-suggest-item");
            if (!item) {
                return;
            }
            const itemIndex = Number(item.getAttribute("data-index"));
            if (Number.isFinite(itemIndex)) {
                setHeaderSearchSuggestActive(itemIndex);
            }
        });

        wrap.addEventListener("click", (event) => {
            const item = event.target.closest(".header-search-suggest-item");
            if (!item) {
                return;
            }
            const itemIndex = Number(item.getAttribute("data-index"));
            openHeaderSearchSuggestionAt(itemIndex);
        });
    }

    if (!headerSearchDocumentEventsBound) {
        headerSearchDocumentEventsBound = true;

        document.addEventListener("click", (event) => {
            const wrapEl = getHeaderSearchWrap();
            if (!wrapEl) {
                return;
            }
            if (wrapEl.contains(event.target)) {
                return;
            }
            closeHeaderSearchSuggestions(true);
        });
    }
}

function toggleCatalog() {
    const el = document.getElementById("catalog");
    if (!el) {
        return;
    }

    const isDesktop = window.matchMedia("(min-width: 981px)").matches;
    if (isDesktop) {
        el.classList.remove("show");
        el.classList.toggle("collapsed");
        syncCatalogLayout();
        return;
    }

    el.classList.remove("collapsed");
    el.classList.toggle("show");
    syncCatalogLayout();
}

function syncCatalogLayout() {
    const catalog = document.getElementById("catalog");
    const storeHero = document.querySelector(".store-hero");
    if (!catalog || !storeHero) {
        return;
    }

    const isDesktop = window.matchMedia("(min-width: 981px)").matches;
    const isCollapsed = isDesktop && catalog.classList.contains("collapsed");
    storeHero.classList.toggle("catalog-collapsed", isCollapsed);
}

window.TechStore = {
    formatVnd,
    normalizeDiscountPercent,
    calculateDiscountedPrice,
    resolveProductPricing,
    resolveProductRating,
    getToken,
    getRole,
    getUsername,
    authHeader,
    fetchCart,
    getCart,
    saveCart,
    cartCount,
    cartTotal,
    ensureLoggedIn,
    updateHeader,
    showToast,
    notify: pushNotification,
    notifyOrderPlaced,
    notifyPaymentSuccess,
    getNotifications: loadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications: clearAllNotifications,
    refreshNotificationCenter: renderNotificationCenter,
    logout,
    addToCart,
    removeFromCart,
    setCartQuantity,
    clearCart,
    goCart,
    goCheckoutFromCart,
    searchFromHeader,
    wireHeaderSearchEnter,
    toggleCatalog
};

window.addEventListener("DOMContentLoaded", () => {
    wireHeaderSearchEnter();
    updateHeader();
    syncCatalogLayout();
});

window.addEventListener("resize", syncCatalogLayout);

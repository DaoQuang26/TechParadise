// notifications.js
// /notifications page:
// - render full notification history for current user
// - allow mark-all-read / clear-all

function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function formatNotificationTime(value) {
    const date = new Date(value || "");
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
        return `${Math.floor(diffMin / 60)} giờ trước`;
    }
    return new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit"
    }).format(date);
}

function renderNotificationsPage() {
    const listEl = document.getElementById("notifications-list");
    const emptyEl = document.getElementById("notifications-empty");
    if (!listEl || !emptyEl) {
        return;
    }

    const list = typeof TechStore.getNotifications === "function"
        ? TechStore.getNotifications()
        : [];

    if (!Array.isArray(list) || !list.length) {
        listEl.innerHTML = "";
        emptyEl.style.display = "block";
        return;
    }

    emptyEl.style.display = "none";
    listEl.innerHTML = list.map((item) => {
        const orderId = Number(item && item.orderId ? item.orderId : 0);
        const hasOrderLink = orderId > 0;
        return `
            <button
                class="notification-item ${item && item.read ? "" : "is-unread"}"
                type="button"
                data-notification-id="${escapeHtml(item && item.id ? item.id : "")}"
                ${hasOrderLink ? `data-order-id="${orderId}"` : ""}
            >
                <div class="notification-item-head">
                    <strong>${escapeHtml(item && item.title ? item.title : "Thông báo")}</strong>
                    <time>${escapeHtml(formatNotificationTime(item && item.createdAt ? item.createdAt : ""))}</time>
                </div>
                <div class="notification-item-body">${escapeHtml(item && item.message ? item.message : "")}</div>
                ${hasOrderLink ? `<div class="notification-item-meta">Xem đơn #${orderId}</div>` : ""}
            </button>
        `;
    }).join("");
}

function bindNotificationPageActions() {
    const markReadBtn = document.getElementById("notifications-mark-read-btn");
    if (markReadBtn) {
        markReadBtn.addEventListener("click", () => {
            if (typeof TechStore.markAllNotificationsRead === "function") {
                TechStore.markAllNotificationsRead();
            }
            if (typeof TechStore.refreshNotificationCenter === "function") {
                TechStore.refreshNotificationCenter();
            }
            renderNotificationsPage();
        });
    }

    const clearBtn = document.getElementById("notifications-clear-btn");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (!confirm("Xóa toàn bộ thông báo?")) {
                return;
            }
            if (typeof TechStore.clearNotifications === "function") {
                TechStore.clearNotifications();
            }
            if (typeof TechStore.refreshNotificationCenter === "function") {
                TechStore.refreshNotificationCenter();
            }
            renderNotificationsPage();
        });
    }

    const refreshBtn = document.getElementById("notifications-refresh-btn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            if (typeof TechStore.refreshNotificationCenter === "function") {
                TechStore.refreshNotificationCenter();
            }
            renderNotificationsPage();
        });
    }

    const listEl = document.getElementById("notifications-list");
    if (listEl) {
        listEl.addEventListener("click", (event) => {
            const item = event.target.closest(".notification-item");
            if (!item) {
                return;
            }

            const notificationId = item.getAttribute("data-notification-id");
            if (notificationId && typeof TechStore.markNotificationRead === "function") {
                TechStore.markNotificationRead(notificationId);
            }
            if (typeof TechStore.refreshNotificationCenter === "function") {
                TechStore.refreshNotificationCenter();
            }

            const orderId = Number(item.getAttribute("data-order-id") || 0);
            if (orderId > 0) {
                window.location.href = `/orders/${encodeURIComponent(orderId)}`;
                return;
            }
            renderNotificationsPage();
        });
    }
}

window.addEventListener("DOMContentLoaded", () => {
    TechStore.updateHeader();
    if (!TechStore.ensureLoggedIn()) {
        return;
    }
    if (typeof TechStore.refreshNotificationCenter === "function") {
        TechStore.refreshNotificationCenter();
    }
    renderNotificationsPage();
    bindNotificationPageActions();
});

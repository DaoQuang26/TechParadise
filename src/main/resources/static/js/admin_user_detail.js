// admin_user_detail.js
// Trang /admin/users/{id}
// - Hiển thị chi tiết tài khoản cho admin
// - Cho phép chỉnh sửa thông tin
// - Cho phép quản lý trạng thái hoạt động + mở khóa tài khoản

let currentUserDetail = null;
let stateActionBusy = false;

function token() {
    return localStorage.getItem("techstore_token");
}

function role() {
    return localStorage.getItem("techstore_role");
}

function username() {
    return localStorage.getItem("techstore_user");
}

function normalizeRole(value) {
    return String(value || "").trim().toUpperCase();
}

function authHeaders() {
    const t = token();
    return t ? { Authorization: `Bearer ${t}` } : {};
}

function ensureAdmin() {
    const currentRole = normalizeRole(role());
    if (!(currentRole === "ADMIN" || currentRole === "SUPER_ADMIN")) {
        window.location.href = "/login";
        return false;
    }
    return true;
}

function isSuperAdmin() {
    return normalizeRole(role()) === "SUPER_ADMIN";
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

function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
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

function isFutureDateTime(value) {
    if (!value) {
        return false;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return false;
    }

    return parsed.getTime() > Date.now();
}

function getUserIdFromPath() {
    const parts = (window.location.pathname || "").split("/").filter(Boolean);
    return Number(parts[parts.length - 1] || 0);
}

function getInputValue(id) {
    const element = document.getElementById(id);
    return String(element ? element.value : "").trim();
}

function setMessageById(id, text, type) {
    const el = document.getElementById(id);
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

function setFormMessage(text, type) {
    setMessageById("admin-user-form-msg", text, type);
}

function setStateMessage(text, type) {
    setMessageById("admin-user-state-msg", text, type);
}

function renderSkeleton() {
    const holder = document.getElementById("admin-user-detail-holder");
    if (!holder) {
        return;
    }

    holder.innerHTML = `
        <section class="card admin-detail-card">
            <div class="card-body">
                <div class="skeleton skeleton-line" style="height: 20px; width: 52%;"></div>
                <div class="skeleton skeleton-line" style="height: 16px; width: 76%; margin-top: 10px;"></div>
                <div class="skeleton skeleton-line" style="height: 16px; width: 70%; margin-top: 10px;"></div>
                <div class="skeleton skeleton-line" style="height: 16px; width: 74%; margin-top: 10px;"></div>
            </div>
        </section>
    `;
}

function iconSvg(pathA, pathB = "") {
    const secondPath = pathB ? `<path d="${pathB}"></path>` : "";
    return `
        <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
                <path d="${pathA}"></path>
                ${secondPath}
            </svg>
        </span>
    `;
}

function isActiveUser(user) {
    return !user || user.active !== false;
}

function isLockedUser(user) {
    return !!(user && isFutureDateTime(user.lockoutUntil));
}

function isSameAccount(user) {
    const actor = String(username() || "").trim().toLowerCase();
    const target = String(user && user.username ? user.username : "").trim().toLowerCase();
    if (!actor || !target) {
        return false;
    }
    return actor === target;
}

function canManageUserState(user) {
    if (!user) {
        return false;
    }

    const targetRole = normalizeRole(user.role || "CUSTOMER");
    if (targetRole === "SUPER_ADMIN") {
        return false;
    }

    if (isSuperAdmin()) {
        return true;
    }

    return targetRole === "CUSTOMER";
}

function renderUserDetail(user) {
    const holder = document.getElementById("admin-user-detail-holder");
    if (!holder) {
        return;
    }

    currentUserDetail = user || null;

    const titleEl = document.getElementById("admin-user-title");
    if (titleEl) {
        titleEl.textContent = `Chi tiết tài khoản #${user.id}`;
    }

    const subtitleEl = document.getElementById("admin-user-subtitle");
    const fullName = String(user.fullName || "").trim();
    const usernameText = String(user.username || "").trim();
    const displayName = fullName || usernameText || "N/A";
    const roleValue = normalizeRole(user.role || "CUSTOMER") || "CUSTOMER";
    if (subtitleEl) {
        subtitleEl.textContent = `Họ tên: ${displayName} | Role: ${roleValue || "N/A"}`;
    }

    const createdAt = formatDateTime(user.createdAt || "");
    const lastLoginAt = formatDateTime(user.lastLoginAt || "");
    const lockoutUntilRaw = user.lockoutUntil || "";
    const lockoutUntil = formatDateTime(lockoutUntilRaw);
    const failedAttempts = Number(user.failedLoginAttempts || 0);

    const isActive = isActiveUser(user);
    const isLocked = isLockedUser(user);
    const activeStatusLabel = isActive ? "Đang hoạt động" : "Đã tắt hoạt động";
    const lockStatusLabel = isLocked
        ? `Tạm khóa đến ${lockoutUntil || "N/A"}`
        : `Không bị tạm khóa (${Math.max(0, failedAttempts)} lần sai gần đây)`;

    const canEditRole = isSuperAdmin() && roleValue !== "SUPER_ADMIN";
    const roleHint = canEditRole
        ? "Bạn có thể đổi role giữa CUSTOMER và ADMIN."
        : (roleValue === "SUPER_ADMIN"
            ? "Không cho phép chỉnh role SUPER_ADMIN từ API."
            : "Chỉ SUPER_ADMIN mới có quyền đổi role.");

    const canManageState = canManageUserState(user);
    const canToggleActive = canManageState && !isSameAccount(user);
    const canUnlock = canManageState && isLocked;
    const nextActive = !isActive;
    const toggleButtonText = nextActive ? "Bật hoạt động" : "Tắt hoạt động";
    const toggleButtonClass = nextActive ? "btn-admin-state-activate" : "btn-admin-state-deactivate";

    const toggleDisabledReason = !canManageState
        ? (roleValue === "SUPER_ADMIN"
            ? "Không thể đổi trạng thái tài khoản SUPER_ADMIN."
            : "Bạn không có quyền đổi trạng thái tài khoản này.")
        : (!canToggleActive ? "Không thể tắt tài khoản đang đăng nhập của chính bạn." : "");

    const unlockDisabledReason = !canManageState
        ? (roleValue === "SUPER_ADMIN"
            ? "Không thể mở khóa tài khoản SUPER_ADMIN."
            : "Bạn không có quyền mở khóa tài khoản này.")
        : (!isLocked ? "Tài khoản hiện không bị tạm khóa." : "");

    holder.innerHTML = `
        <section class="admin-detail-hero">
            <div class="admin-detail-hero-main">
                <h4 class="admin-detail-order-id">Tài khoản #${user.id}</h4>
                <p class="admin-detail-sub">
                    Họ tên: <strong>${escapeHtml(displayName)}</strong>
                    <span class="admin-detail-dot">|</span>
                    Email: <strong>${escapeHtml(user.email || "N/A")}</strong>
                    <span class="admin-detail-dot">|</span>
                    Role: <strong>${escapeHtml(roleValue || "N/A")}</strong>
                </p>
            </div>
            <div class="admin-detail-chip-group">
                <span class="admin-detail-chip ${isActive ? "admin-detail-chip-active-on" : "admin-detail-chip-active-off"}">
                    ${escapeHtml(activeStatusLabel)}
                </span>
                <span class="admin-detail-chip ${isLocked ? "admin-detail-chip-lock-on" : "admin-detail-chip-lock-off"}">
                    ${escapeHtml(isLocked ? `Tạm khóa đến ${lockoutUntil || "N/A"}` : "Không bị tạm khóa")}
                </span>
            </div>
        </section>

        <section class="card admin-detail-card" style="margin-bottom:14px;">
            <div class="card-head admin-detail-head">
                <h2 style="margin:0;">Thông tin tài khoản</h2>
            </div>
            <div class="card-body">
                <form id="admin-user-form">
                    <input id="admin-user-id" type="hidden" value="${Number(user.id || 0)}">
                    <input id="admin-user-role-current" type="hidden" value="${escapeHtml(roleValue)}">

                    <div class="admin-form-grid">
                        <label>ID
                            <input class="input" value="${escapeHtml(user.id)}" disabled>
                        </label>
                        <label>Role
                            <select id="admin-user-role" class="select" ${canEditRole ? "" : "disabled"}>
                                <option value="CUSTOMER" ${roleValue === "CUSTOMER" ? "selected" : ""}>CUSTOMER</option>
                                <option value="ADMIN" ${roleValue === "ADMIN" ? "selected" : ""}>ADMIN</option>
                                <option value="SUPER_ADMIN" ${roleValue === "SUPER_ADMIN" ? "selected" : ""} ${roleValue === "SUPER_ADMIN" ? "" : "disabled"}>SUPER_ADMIN</option>
                            </select>
                        </label>
                    </div>
                    <p class="muted" style="margin-top:10px;">${escapeHtml(roleHint)}</p>

                    <div class="admin-form-grid" style="margin-top:12px;">
                        <label>Họ và tên *
                            <input id="admin-user-full-name" class="input" required value="${escapeHtml(fullName)}">
                        </label>
                        <label>Tên đăng nhập *
                            <input id="admin-user-username" class="input" required value="${escapeHtml(user.username || "")}">
                        </label>
                    </div>

                    <div class="admin-form-grid" style="margin-top:12px;">
                        <label>Email *
                            <input id="admin-user-email" type="email" class="input" required value="${escapeHtml(user.email || "")}">
                        </label>
                        <label>Số điện thoại
                            <input id="admin-user-phone" class="input" value="${escapeHtml(user.phone || "")}">
                        </label>
                    </div>

                    <div class="admin-form-grid" style="margin-top:12px;">
                        <label>Ngày tạo
                            <input class="input" value="${escapeHtml(createdAt || "N/A")}" disabled>
                        </label>
                        <label>Đăng nhập gần nhất
                            <input class="input" value="${escapeHtml(lastLoginAt || "Chưa có dữ liệu")}" disabled>
                        </label>
                    </div>

                    <label style="display:block; margin-top:12px;">Địa chỉ
                        <textarea id="admin-user-address" class="input" rows="3">${escapeHtml(user.address || "")}</textarea>
                    </label>

                    <div class="admin-form-grid" style="margin-top:12px;">
                        <label>Số lần nhập sai gần đây
                            <input class="input" value="${escapeHtml(String(failedAttempts))}" disabled>
                        </label>
                        <label>Trạng thái khóa
                            <input class="input" value="${escapeHtml(lockStatusLabel)}" disabled>
                        </label>
                    </div>

                    <section class="admin-user-state-panel">
                        <div class="admin-user-state-head">
                            <h3>Quản lý truy cập</h3>
                        </div>
                        <div class="admin-user-state-actions">
                            <button
                                id="admin-user-toggle-active-btn"
                                class="btn btn-sm btn-admin-state ${toggleButtonClass}"
                                type="button"
                                ${canToggleActive ? "" : "disabled"}
                                title="${escapeHtml(toggleDisabledReason)}"
                            >
                                ${iconSvg("M5 13l4 4L19 7")}
                                <span>${escapeHtml(toggleButtonText)}</span>
                            </button>
                            <button
                                id="admin-user-unlock-btn"
                                class="btn btn-sm btn-admin-state btn-admin-unlock"
                                type="button"
                                ${canUnlock ? "" : "disabled"}
                                title="${escapeHtml(unlockDisabledReason)}"
                            >
                                ${iconSvg("M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h7V7a1 1 0 0 0-2 0", "M12 15.5v1")}
                                <span>Mở khóa tài khoản</span>
                            </button>
                        </div>
                        <div id="admin-user-state-msg" class="message" style="display:none; margin-top:12px;"></div>
                    </section>

                    <div id="admin-user-form-msg" class="message" style="display:none; margin-top:12px;"></div>

                    <div class="admin-form-actions" style="margin-top:14px;">
                        <button class="btn btn-solid" type="submit">
                            ${iconSvg("M5 12.5 10 17l9-10")}
                            Lưu thay đổi
                        </button>
                        <a class="btn btn-outline" href="/admin/dashboard#users">Quay lại danh sách</a>
                    </div>
                </form>
            </div>
        </section>
    `;

    const form = document.getElementById("admin-user-form");
    if (form) {
        form.addEventListener("submit", saveUserDetail);
    }

    const toggleButton = document.getElementById("admin-user-toggle-active-btn");
    if (toggleButton) {
        toggleButton.addEventListener("click", handleToggleActive);
    }

    const unlockButton = document.getElementById("admin-user-unlock-btn");
    if (unlockButton) {
        unlockButton.addEventListener("click", handleUnlockUser);
    }
}

async function fetchLatestUserDetail(id) {
    return fetchJson(`/api/admin/users/${encodeURIComponent(id)}`, {
        headers: {
            ...authHeaders()
        }
    });
}

async function updateUserActiveStatus(id, active) {
    return fetchJson(`/api/admin/users/${encodeURIComponent(id)}/active`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders()
        },
        body: JSON.stringify({ active })
    });
}

async function unlockUserAccount(id) {
    return fetchJson(`/api/admin/users/${encodeURIComponent(id)}/unlock`, {
        method: "POST",
        headers: {
            ...authHeaders()
        }
    });
}

function setStateButtonsBusy(isBusy) {
    const buttonIds = ["admin-user-toggle-active-btn", "admin-user-unlock-btn"];
    buttonIds.forEach((id) => {
        const button = document.getElementById(id);
        if (!button) {
            return;
        }

        if (isBusy) {
            button.dataset.wasDisabled = button.disabled ? "1" : "0";
            button.disabled = true;
            button.classList.add("is-busy");
            return;
        }

        const shouldStayDisabled = button.dataset.wasDisabled === "1";
        button.disabled = shouldStayDisabled;
        delete button.dataset.wasDisabled;
        button.classList.remove("is-busy");
    });
}

async function handleToggleActive() {
    if (stateActionBusy) {
        return;
    }

    const user = currentUserDetail;
    const id = Number(user && user.id ? user.id : 0);
    if (!id || !user) {
        setStateMessage("Không tìm thấy tài khoản.", "error");
        return;
    }

    const canToggleActive = canManageUserState(user) && !isSameAccount(user);
    if (!canToggleActive) {
        setStateMessage("Bạn không có quyền đổi trạng thái tài khoản này.", "error");
        return;
    }

    const nextActive = !isActiveUser(user);
    const confirmText = nextActive
        ? "Bật hoạt động lại tài khoản này?"
        : "Tắt hoạt động tài khoản này? Sau khi tắt, tài khoản sẽ không đăng nhập được.";
    if (!window.confirm(confirmText)) {
        return;
    }

    stateActionBusy = true;
    setFormMessage("", "");
    setStateMessage("", "");
    setStateButtonsBusy(true);

    let rendered = false;
    try {
        await updateUserActiveStatus(id, nextActive);
        const latest = await fetchLatestUserDetail(id);
        renderUserDetail(latest);
        rendered = true;
        setStateMessage(
            nextActive
                ? "Đã bật hoạt động tài khoản. Tài khoản có thể đăng nhập lại nếu không bị tạm khóa."
                : "Đã tắt hoạt động tài khoản. Tài khoản sẽ không thể đăng nhập.",
            "success"
        );
    } catch (err) {
        setStateMessage(err.message, "error");
    } finally {
        stateActionBusy = false;
        if (!rendered) {
            setStateButtonsBusy(false);
        }
    }
}

async function handleUnlockUser() {
    if (stateActionBusy) {
        return;
    }

    const user = currentUserDetail;
    const id = Number(user && user.id ? user.id : 0);
    if (!id || !user) {
        setStateMessage("Không tìm thấy tài khoản.", "error");
        return;
    }

    const canUnlock = canManageUserState(user) && isLockedUser(user);
    if (!canUnlock) {
        setStateMessage("Tài khoản hiện không thể mở khóa bởi thao tác này.", "error");
        return;
    }

    if (!window.confirm("Mở khóa tài khoản này?")) {
        return;
    }

    stateActionBusy = true;
    setFormMessage("", "");
    setStateMessage("", "");
    setStateButtonsBusy(true);

    let rendered = false;
    try {
        await unlockUserAccount(id);
        const latest = await fetchLatestUserDetail(id);
        renderUserDetail(latest);
        rendered = true;
        setStateMessage("Đã mở khóa tài khoản thành công.", "success");
    } catch (err) {
        setStateMessage(err.message, "error");
    } finally {
        stateActionBusy = false;
        if (!rendered) {
            setStateButtonsBusy(false);
        }
    }
}

async function saveUserDetail(event) {
    event.preventDefault();
    setFormMessage("", "");

    const id = Number(getInputValue("admin-user-id") || 0);
    if (!id) {
        setFormMessage("Không tìm thấy tài khoản.", "error");
        return;
    }

    const fullNameValue = getInputValue("admin-user-full-name");
    const usernameValue = getInputValue("admin-user-username");
    const emailValue = getInputValue("admin-user-email");
    const phoneValue = getInputValue("admin-user-phone");
    const addressValue = getInputValue("admin-user-address");
    const selectedRole = normalizeRole(getInputValue("admin-user-role"));
    const currentRole = normalizeRole(getInputValue("admin-user-role-current"));
    const canEditRole = isSuperAdmin() && currentRole !== "SUPER_ADMIN";

    if (!fullNameValue) {
        setFormMessage("Họ và tên không được để trống.", "error");
        return;
    }
    if (!usernameValue) {
        setFormMessage("Tên đăng nhập không được để trống.", "error");
        return;
    }
    if (!emailValue) {
        setFormMessage("Email không được để trống.", "error");
        return;
    }

    try {
        await fetchJson(`/api/admin/users/${encodeURIComponent(id)}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders()
            },
            body: JSON.stringify({
                fullName: fullNameValue,
                username: usernameValue,
                email: emailValue,
                phone: phoneValue || null,
                address: addressValue || null
            })
        });

        let roleUpdated = false;
        if (canEditRole && selectedRole && selectedRole !== currentRole) {
            if (selectedRole === "SUPER_ADMIN") {
                setFormMessage("Không thể gán role SUPER_ADMIN từ form này.", "error");
                return;
            }

            try {
                await fetchJson(`/api/super-admin/users/${encodeURIComponent(id)}/role`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        ...authHeaders()
                    },
                    body: JSON.stringify({ role: selectedRole })
                });
                roleUpdated = true;
            } catch (err) {
                const latestOnRoleError = await fetchLatestUserDetail(id);
                renderUserDetail(latestOnRoleError);
                setFormMessage(`Đã lưu thông tin, nhưng đổi role thất bại: ${err.message}`, "error");
                return;
            }
        }

        const latest = await fetchLatestUserDetail(id);
        renderUserDetail(latest);
        setFormMessage(
            roleUpdated ? "Đã cập nhật thông tin và role tài khoản." : "Đã cập nhật thông tin tài khoản.",
            "success"
        );
    } catch (err) {
        setFormMessage(err.message, "error");
    }
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

    const userId = getUserIdFromPath();
    if (!userId) {
        window.location.href = "/admin/dashboard#users";
        return;
    }

    const dashboardLinkEl = document.getElementById("admin-open-dashboard-user");
    if (dashboardLinkEl) {
        dashboardLinkEl.href = "/admin/dashboard#users";
    }

    renderSkeleton();

    try {
        const detail = await fetchLatestUserDetail(userId);
        renderUserDetail(detail);
    } catch (err) {
        const holder = document.getElementById("admin-user-detail-holder");
        if (!holder) {
            return;
        }
        holder.innerHTML = `
            <section class="empty-state" style="display:block;">
                <div class="empty-card">
                    <h2>Không tải được tài khoản</h2>
                    <p class="muted">${escapeHtml(err.message)}</p>
                    <a class="btn btn-solid" href="/admin/dashboard#users">Về danh sách tài khoản</a>
                </div>
            </section>
        `;
    }
});

window.logout = logout;

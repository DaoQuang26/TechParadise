// account.js
// /account page:
// - left form: update profile info
// - right form: change password

let latestProfile = null;

function setMessage(id, text, type) {
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

function formatDateTime(raw) {
    if (!raw) {
        return "";
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return String(raw).replace("T", " ").slice(0, 16);
    }

    const day = String(parsed.getDate()).padStart(2, "0");
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const year = parsed.getFullYear();
    const hour = String(parsed.getHours()).padStart(2, "0");
    const minute = String(parsed.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hour}:${minute}`;
}

async function loadProfile() {
    const response = await fetch("/api/customer/profile", {
        headers: {
            ...TechStore.authHeader()
        }
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Không tải được thông tin tài khoản");
    }

    return response.json();
}

async function updateProfile(payload) {
    const response = await fetch("/api/customer/profile", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...TechStore.authHeader()
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Cập nhật thất bại");
    }

    return response.json();
}

function fillInfoForm(profile) {
    if (!profile) {
        return;
    }
    document.getElementById("pf-full-name").value = profile.fullName || "";
    document.getElementById("pf-email").value = profile.email || "";
    document.getElementById("pf-phone").value = profile.phone || "";
    document.getElementById("pf-address").value = profile.address || "";
    document.getElementById("pf-username").value = profile.username || "";
    document.getElementById("pf-created").value = formatDateTime(profile.createdAt);
}

function clearPasswordForm() {
    document.getElementById("pf-current").value = "";
    document.getElementById("pf-new").value = "";
    document.getElementById("pf-confirm").value = "";
}

function bindPasswordVisibilityToggles() {
    const toggleButtons = document.querySelectorAll("[data-password-target]");
    toggleButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const targetId = String(button.getAttribute("data-password-target") || "").trim();
            if (!targetId) {
                return;
            }

            const input = document.getElementById(targetId);
            if (!input) {
                return;
            }

            const showPassword = input.type === "password";
            input.type = showPassword ? "text" : "password";
            button.setAttribute("aria-label", showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu");
        });
    });
}

window.addEventListener("DOMContentLoaded", async () => {
    TechStore.updateHeader();

    if (!TechStore.ensureLoggedIn()) {
        return;
    }

    setMessage("pf-info-msg", "", "");
    setMessage("pf-password-msg", "", "");
    bindPasswordVisibilityToggles();

    const infoForm = document.getElementById("profile-info-form");
    const passwordForm = document.getElementById("profile-password-form");
    const infoSaveBtn = document.getElementById("pf-info-save");
    const passwordSaveBtn = document.getElementById("pf-password-save");
    const infoResetBtn = document.getElementById("pf-info-reset");
    const passwordResetBtn = document.getElementById("pf-password-reset");

    try {
        latestProfile = await loadProfile();
        fillInfoForm(latestProfile);
    } catch (err) {
        setMessage("pf-info-msg", err.message, "error");
    }

    if (infoResetBtn) {
        infoResetBtn.addEventListener("click", () => {
            fillInfoForm(latestProfile);
            setMessage("pf-info-msg", "", "");
        });
    }

    if (passwordResetBtn) {
        passwordResetBtn.addEventListener("click", () => {
            clearPasswordForm();
            setMessage("pf-password-msg", "", "");
        });
    }

    if (infoForm) {
        infoForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            setMessage("pf-info-msg", "", "");

            const payload = {
                fullName: document.getElementById("pf-full-name").value.trim() || null,
                email: document.getElementById("pf-email").value.trim() || null,
                phone: document.getElementById("pf-phone").value.trim(),
                address: document.getElementById("pf-address").value.trim()
            };

            if (!payload.fullName) {
                setMessage("pf-info-msg", "Họ và tên không được để trống.", "error");
                return;
            }
            if (!payload.email) {
                setMessage("pf-info-msg", "Email không được để trống.", "error");
                return;
            }

            if (infoSaveBtn) {
                infoSaveBtn.disabled = true;
                infoSaveBtn.textContent = "Đang lưu...";
            }

            try {
                latestProfile = await updateProfile(payload);
                fillInfoForm(latestProfile);
                setMessage("pf-info-msg", "Cập nhật thông tin thành công.", "success");
            } catch (err) {
                setMessage("pf-info-msg", err.message, "error");
            } finally {
                if (infoSaveBtn) {
                    infoSaveBtn.disabled = false;
                    infoSaveBtn.textContent = "Lưu thông tin";
                }
            }
        });
    }

    if (passwordForm) {
        passwordForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            setMessage("pf-password-msg", "", "");

            const currentPassword = document.getElementById("pf-current").value;
            const newPassword = document.getElementById("pf-new").value;
            const confirmPassword = document.getElementById("pf-confirm").value;

            if (!currentPassword.trim()) {
                setMessage("pf-password-msg", "Vui lòng nhập mật khẩu hiện tại.", "error");
                return;
            }
            if (!newPassword || newPassword.length < 6) {
                setMessage("pf-password-msg", "Mật khẩu mới phải từ 6 ký tự.", "error");
                return;
            }
            if (newPassword !== confirmPassword) {
                setMessage("pf-password-msg", "Xác nhận mật khẩu mới không khớp.", "error");
                return;
            }

            if (passwordSaveBtn) {
                passwordSaveBtn.disabled = true;
                passwordSaveBtn.textContent = "Đang đổi...";
            }

            try {
                await updateProfile({
                    currentPassword,
                    newPassword
                });
                clearPasswordForm();
                setMessage("pf-password-msg", "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.", "success");
                setTimeout(() => TechStore.logout(), 900);
            } catch (err) {
                setMessage("pf-password-msg", err.message, "error");
            } finally {
                if (passwordSaveBtn) {
                    passwordSaveBtn.disabled = false;
                    passwordSaveBtn.textContent = "Đổi mật khẩu";
                }
            }
        });
    }
});

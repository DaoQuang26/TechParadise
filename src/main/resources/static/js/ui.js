// ui.js
// Mục đích: hiệu ứng giao diện dùng chung cho toàn bộ website (store/auth/admin)
// - Ripple (gợn sóng) khi click nút/đường dẫn để cảm giác "app-like"
// - Reveal animation khi trang vừa render để UI mượt và hiện đại hơn
//
// Lưu ý: file này KHÔNG phụ thuộc vào JWT hay dữ liệu business, chỉ làm UI effect.

(function initTechStoreUI() {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // -----------------------------
    // Ripple effect
    // -----------------------------
    if (!prefersReducedMotion) {
        // Bắt pointerdown để có toạ độ click (clientX/clientY).
        document.addEventListener("pointerdown", (event) => {
            const target = event.target;
            if (!target) {
                return;
            }

            // Chỉ áp dụng ripple cho các phần tử "interactive".
            const el = target.closest(".btn, .action, .catalog-btn, .admin-menu-item, .icon-btn, .qty-btn, .link-btn");
            if (!el) {
                return;
            }

            // Tránh ripple khi nút bị disable.
            if (el.matches(":disabled") || el.getAttribute("aria-disabled") === "true") {
                return;
            }

            // Tạo 1 span ripple và animate bằng CSS.
            const rect = el.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height) * 1.3;
            const ripple = document.createElement("span");
            ripple.className = "ripple";
            ripple.style.width = `${size}px`;
            ripple.style.height = `${size}px`;
            ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
            ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

            el.appendChild(ripple);

            // Xoá ripple sau khi animation kết thúc để không tăng DOM mãi.
            ripple.addEventListener("animationend", () => ripple.remove(), {once: true});
        }, {passive: true});
    }

    // -----------------------------
    // "Enter" animation (nhẹ) cho trang
    // -----------------------------
    // Thêm class vào body để CSS có thể animate các phần tử khi load.
    // (Nếu user bật reduced motion thì không animate.)
    if (!prefersReducedMotion) {
        window.addEventListener("DOMContentLoaded", () => {
            document.body.classList.add("motion-ok");
        });
    }
})();

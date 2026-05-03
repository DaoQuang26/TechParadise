// cart.js
// /cart page:
// - Load cart from database via TechStore.fetchCart()
// - Update quantity / remove item via cart APIs

function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

async function renderCartPage() {
    TechStore.updateHeader();

    if (!TechStore.ensureLoggedIn()) {
        return;
    }

    let cart = [];
    try {
        cart = await TechStore.fetchCart(true);
    } catch (err) {
        alert(err.message || "Không tải được giỏ hàng");
        return;
    }

    const emptyEl = document.getElementById("cart-empty");
    const contentEl = document.getElementById("cart-content");
    const rowsEl = document.getElementById("cart-rows");
    const subtotalEl = document.getElementById("cart-subtotal");
    const totalEl = document.getElementById("cart-total");

    if (!cart.length) {
        if (emptyEl) emptyEl.style.display = "block";
        if (contentEl) contentEl.style.display = "none";
        if (rowsEl) rowsEl.innerHTML = "";
        return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    if (contentEl) contentEl.style.display = "grid";

    let total = 0;
    if (rowsEl) {
        rowsEl.innerHTML = "";

        cart.forEach((item) => {
            const variantId = Number(item.variantId || 0);
            const unitPrice = Number(item.finalPrice ?? item.price ?? 0);
            const originalPrice = Number(item.originalPrice ?? unitPrice);
            const discountPercent = Number(item.discountPercent || 0);
            const hasDiscount = discountPercent > 0 && unitPrice < originalPrice;
            const lineTotal = unitPrice * (item.quantity || 0);
            const originalLineTotal = originalPrice * (item.quantity || 0);
            total += lineTotal;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div class="line-item">
                        <img class="line-thumb" src="${escapeHtml(item.imageUrl || "https://placehold.co/120x90/f3f4f6/111827?text=TP")}" alt="${escapeHtml(item.productName || "Sản phẩm")}">
                        <div class="cell-product">
                            <div class="cell-title">${escapeHtml(item.productName || "Sản phẩm")}</div>
                            <div class="muted">ID: ${item.productId}</div>
                        </div>
                    </div>
                </td>
                <td class="col-right">
                    <strong>${TechStore.formatVnd(unitPrice)}</strong>
                    ${hasDiscount ? `<div class="line-price-note"><span class="price-old-text">${TechStore.formatVnd(originalPrice)}</span><span class="price-discount-badge">-${Math.round(discountPercent)}%</span></div>` : ""}
                </td>
                <td class="col-center">
                    <div class="qty">
                        <button class="qty-btn" type="button" data-action="dec" data-id="${item.productId}" data-variant-id="${variantId}">-</button>
                        <input class="qty-input" type="number" min="1" value="${item.quantity}" data-action="input" data-id="${item.productId}" data-variant-id="${variantId}">
                        <button class="qty-btn" type="button" data-action="inc" data-id="${item.productId}" data-variant-id="${variantId}">+</button>
                    </div>
                </td>
                <td class="col-right">
                    <strong>${TechStore.formatVnd(lineTotal)}</strong>
                    ${hasDiscount ? `<div class="line-price-note"><span class="price-old-text">${TechStore.formatVnd(originalLineTotal)}</span></div>` : ""}
                </td>
                <td class="col-center">
                    <button class="icon-btn" type="button" data-action="remove" data-id="${item.productId}" data-variant-id="${variantId}" aria-label="Xóa">×</button>
                </td>
            `;

            rowsEl.appendChild(tr);
        });
    }

    if (subtotalEl) subtotalEl.textContent = TechStore.formatVnd(total);
    if (totalEl) totalEl.textContent = TechStore.formatVnd(total);
}

async function handleCartEvents(event) {
    const target = event.target;
    if (!target) {
        return;
    }

    const action = target.getAttribute("data-action");
    const idRaw = target.getAttribute("data-id");
    if (!action || !idRaw) {
        return;
    }
    const variantIdRaw = target.getAttribute("data-variant-id");
    const variantId = Number(variantIdRaw || 0);

    const productId = Number(idRaw);
    const cart = TechStore.getCart();
    const item = cart.find((i) => i.productId === productId && Number(i.variantId || 0) === variantId);
    if (!item) {
        return;
    }

    try {
        if (action === "remove") {
            await TechStore.removeFromCart(productId, variantId);
            await renderCartPage();
            return;
        }

        if (action === "inc") {
            await TechStore.setCartQuantity(productId, (item.quantity || 1) + 1, variantId);
            await renderCartPage();
            return;
        }

        if (action === "dec") {
            await TechStore.setCartQuantity(productId, Math.max(1, (item.quantity || 1) - 1), variantId);
            await renderCartPage();
        }
    } catch (err) {
        alert(err.message || "Không thể cập nhật giỏ hàng");
        await renderCartPage();
    }
}

async function handleQtyInput(event) {
    const target = event.target;
    if (!target || target.getAttribute("data-action") !== "input") {
        return;
    }

    const idRaw = target.getAttribute("data-id");
    if (!idRaw) {
        return;
    }
    const variantIdRaw = target.getAttribute("data-variant-id");
    const variantId = Number(variantIdRaw || 0);

    const productId = Number(idRaw);
    const qty = Number(target.value || 1);

    try {
        await TechStore.setCartQuantity(productId, qty, variantId);
        await renderCartPage();
    } catch (err) {
        alert(err.message || "Không thể cập nhật số lượng");
        await renderCartPage();
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    await renderCartPage();

    const rowsEl = document.getElementById("cart-rows");
    if (rowsEl) {
        rowsEl.addEventListener("click", (event) => {
            handleCartEvents(event);
        });
        rowsEl.addEventListener("change", (event) => {
            handleQtyInput(event);
        });
    }
});

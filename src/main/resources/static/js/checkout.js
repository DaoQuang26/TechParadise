// checkout.js
// /checkout page:
// - cart mode: checkout all items currently in DB cart
// - buyNow mode: checkout 1 product from query ?productId=...
// tac dung code: xu ly dat don va redirect sang cong thanh toan online neu user chon ONLINE_GATEWAY.

let checkoutMode = "cart"; // "cart" | "buyNow"
let checkoutItems = []; // [{ productId, variantId, variantName, productName, imageUrl, price(final), originalPrice, discountPercent, quantity }]
let appliedPromo = null; // { code, discountPercent }
const REQUIRED_SHIPPING_FIELD_IDS = Object.freeze([
    "recipient-name",
    "recipient-phone",
    "shipping-province",
    "shipping-district",
    "shipping-detail"
]);

function parsePositiveQuantity(rawValue, fallback = 1) {
    const parsed = Number(rawValue);
    const safe = Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
    return safe > 0 ? safe : fallback;
}

const PROVINCE_OPTIONS = [
    "An Giang",
    "Bà Rịa - Vũng Tàu",
    "Bắc Giang",
    "Bắc Kạn",
    "Bạc Liêu",
    "Bắc Ninh",
    "Bến Tre",
    "Bình Định",
    "Bình Dương",
    "Bình Phước",
    "Bình Thuận",
    "Cà Mau",
    "Cần Thơ",
    "Cao Bằng",
    "Đà Nẵng",
    "Đắk Lắk",
    "Đắk Nông",
    "Điện Biên",
    "Đồng Nai",
    "Đồng Tháp",
    "Gia Lai",
    "Hà Giang",
    "Hà Nam",
    "Hà Nội",
    "Hà Tĩnh",
    "Hải Dương",
    "Hải Phòng",
    "Hậu Giang",
    "Hòa Bình",
    "Hưng Yên",
    "Khánh Hòa",
    "Kiên Giang",
    "Kon Tum",
    "Lai Châu",
    "Lâm Đồng",
    "Lạng Sơn",
    "Lào Cai",
    "Long An",
    "Nam Định",
    "Nghệ An",
    "Ninh Bình",
    "Ninh Thuận",
    "Phú Thọ",
    "Phú Yên",
    "Quảng Bình",
    "Quảng Nam",
    "Quảng Ngãi",
    "Quảng Ninh",
    "Quảng Trị",
    "Sóc Trăng",
    "Sơn La",
    "Tây Ninh",
    "Thái Bình",
    "Thái Nguyên",
    "Thanh Hóa",
    "Thừa Thiên Huế",
    "Tiền Giang",
    "TP. Hồ Chí Minh",
    "Trà Vinh",
    "Tuyên Quang",
    "Vĩnh Long",
    "Vĩnh Phúc",
    "Yên Bái"
];

const COMMON_DISTRICT_HINTS = [
    "Quận 1",
    "Quận 3",
    "Quận 7",
    "Quận Bình Thạnh",
    "Quận Cầu Giấy",
    "Quận Thanh Xuân",
    "Quận Hải Châu",
    "Quận Ninh Kiều",
    "Thành phố Thủ Đức",
    "Huyện Nhà Bè"
];

const DISTRICT_SUGGESTIONS_BY_PROVINCE = {
    "TP. Hồ Chí Minh": [
        "Quận 1",
        "Quận 3",
        "Quận 4",
        "Quận 5",
        "Quận 7",
        "Quận 10",
        "Quận 12",
        "Quận Bình Thạnh",
        "Quận Gò Vấp",
        "Thành phố Thủ Đức",
        "Huyện Bình Chánh",
        "Huyện Củ Chi",
        "Huyện Hóc Môn",
        "Huyện Nhà Bè"
    ],
    "Hà Nội": [
        "Quận Ba Đình",
        "Quận Hoàn Kiếm",
        "Quận Đống Đa",
        "Quận Hai Bà Trưng",
        "Quận Cầu Giấy",
        "Quận Thanh Xuân",
        "Quận Hoàng Mai",
        "Quận Long Biên",
        "Quận Hà Đông",
        "Huyện Đông Anh",
        "Huyện Gia Lâm",
        "Huyện Sóc Sơn"
    ],
    "Đà Nẵng": [
        "Quận Hải Châu",
        "Quận Thanh Khê",
        "Quận Sơn Trà",
        "Quận Ngũ Hành Sơn",
        "Quận Liên Chiểu",
        "Huyện Hòa Vang"
    ],
    "Hải Phòng": [
        "Quận Hồng Bàng",
        "Quận Ngô Quyền",
        "Quận Lê Chân",
        "Quận Hải An",
        "Quận Kiến An",
        "Huyện An Dương",
        "Huyện Thủy Nguyên"
    ],
    "Cần Thơ": [
        "Quận Ninh Kiều",
        "Quận Bình Thủy",
        "Quận Cái Răng",
        "Quận Ô Môn",
        "Quận Thốt Nốt",
        "Huyện Phong Điền"
    ],
    "Bình Dương": [
        "Thành phố Thủ Dầu Một",
        "Thành phố Dĩ An",
        "Thành phố Thuận An",
        "Thành phố Tân Uyên",
        "Huyện Bàu Bàng",
        "Huyện Dầu Tiếng"
    ],
    "Đồng Nai": [
        "Thành phố Biên Hòa",
        "Thành phố Long Khánh",
        "Huyện Trảng Bom",
        "Huyện Long Thành",
        "Huyện Nhơn Trạch",
        "Huyện Vĩnh Cửu"
    ],
    "Khánh Hòa": [
        "Thành phố Nha Trang",
        "Thành phố Cam Ranh",
        "Thị xã Ninh Hòa",
        "Huyện Diên Khánh",
        "Huyện Cam Lâm"
    ],
    "Lâm Đồng": [
        "Thành phố Đà Lạt",
        "Thành phố Bảo Lộc",
        "Huyện Đức Trọng",
        "Huyện Lâm Hà",
        "Huyện Đơn Dương"
    ],
    "Quảng Ninh": [
        "Thành phố Hạ Long",
        "Thành phố Cẩm Phả",
        "Thành phố Uông Bí",
        "Thành phố Móng Cái",
        "Thị xã Quảng Yên"
    ]
};

function setMessage(text, type) {
    const el = document.getElementById("checkout-message");
    if (!el) {
        return;
    }
    el.textContent = text || "";
    el.className = "message " + (type ? `message-${type}` : "");
}

function setPromoHint(text, type) {
    const el = document.getElementById("promo-hint");
    if (!el) {
        return;
    }

    if (!text) {
        el.style.display = "none";
        el.textContent = "";
        el.className = "muted hint";
        return;
    }

    el.style.display = "block";
    el.textContent = text;

    if (type === "error") {
        el.className = "message message-error";
        return;
    }
    if (type === "success") {
        el.className = "message message-success";
        return;
    }

    el.className = "muted hint";
}

function showEmpty() {
    const empty = document.getElementById("checkout-empty");
    const content = document.getElementById("checkout-content");
    if (empty) empty.style.display = "block";
    if (content) content.style.display = "none";
}

function showContent() {
    const empty = document.getElementById("checkout-empty");
    const content = document.getElementById("checkout-content");
    if (empty) empty.style.display = "none";
    if (content) content.style.display = "grid";
}

function calcSubtotal() {
    return checkoutItems.reduce((sum, item) => {
        const unitPrice = Number(item.finalPrice ?? item.price ?? 0);
        return sum + (unitPrice * Number(item.quantity || 0));
    }, 0);
}

function calcDiscount(subtotal) {
    if (!appliedPromo || !appliedPromo.discountPercent) {
        return 0;
    }

    const percent = Number(appliedPromo.discountPercent || 0);
    if (percent <= 0) {
        return 0;
    }
    return Math.round(subtotal * percent / 100.0);
}

function updateTotals() {
    const subtotalEl = document.getElementById("checkout-subtotal");
    const discountRow = document.getElementById("discount-row");
    const discountEl = document.getElementById("checkout-discount");
    const discountLabel = document.getElementById("discount-label");
    const totalEl = document.getElementById("checkout-total");

    const subtotal = calcSubtotal();
    const discount = calcDiscount(subtotal);
    const total = Math.max(0, subtotal - discount);

    if (subtotalEl) subtotalEl.textContent = TechStore.formatVnd(subtotal);
    if (totalEl) totalEl.textContent = TechStore.formatVnd(total);

    if (discountRow && discountEl && discountLabel) {
        if (discount > 0) {
            discountRow.style.display = "flex";
            discountEl.textContent = "- " + TechStore.formatVnd(discount);
            discountLabel.textContent = appliedPromo && appliedPromo.code
                ? `Giảm giá (${appliedPromo.code} - ${appliedPromo.discountPercent}%)`
                : "Giảm giá";
        } else {
            discountRow.style.display = "none";
        }
    }
}

function renderCheckout() {
    const itemsEl = document.getElementById("checkout-items");
    if (!itemsEl) {
        return;
    }

    itemsEl.innerHTML = "";

    checkoutItems.forEach((item) => {
        const unitPrice = Number(item.finalPrice ?? item.price ?? 0);
        const originalPrice = Number(item.originalPrice ?? unitPrice);
        const discountPercent = Number(item.discountPercent || 0);
        const hasDiscount = discountPercent > 0 && unitPrice < originalPrice;
        const lineTotal = unitPrice * (item.quantity || 0);
        const originalLineTotal = originalPrice * (item.quantity || 0);
        const row = document.createElement("div");
        row.className = "mini-row";
        row.innerHTML = `
            <div class="mini-main">
                <div class="mini-thumb-wrap">${renderCheckoutItemThumb(item)}</div>
                <div class="mini-meta">
                    <div class="mini-title">${escapeHtml(item.productName || "Sản phẩm")}</div>
                    <div class="muted">SL: ${item.quantity}</div>
                    ${hasDiscount ? `<div class="mini-price-note"><span class="price-old-text">${TechStore.formatVnd(originalLineTotal)}</span><span class="price-discount-badge">-${Math.round(discountPercent)}%</span></div>` : ""}
                </div>
            </div>
            <strong class="mini-total">${TechStore.formatVnd(lineTotal)}</strong>
        `;
        itemsEl.appendChild(row);
    });

    updateTotals();
}

function renderCheckoutItemThumb(item) {
    const rawImage = String(item?.imageUrl || "").trim();
    const safeName = String(item?.productName || "Sản phẩm").trim();
    if (rawImage) {
        return `<img class="mini-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(safeName)}" loading="lazy">`;
    }

    const fallbackLabel = escapeHtml((safeName || "SP").slice(0, 2).toUpperCase());
    return `<span class="mini-thumb mini-thumb-fallback" aria-hidden="true">${fallbackLabel}</span>`;
}

function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
}

function clearMissingFieldState(field) {
    if (!field) {
        return;
    }
    field.classList.remove("input-missing", "select-missing", "textarea-missing");
    field.removeAttribute("aria-invalid");
}

function markMissingFieldState(field) {
    if (!field) {
        return;
    }

    clearMissingFieldState(field);
    const tagName = String(field.tagName || "").toUpperCase();
    if (tagName === "SELECT") {
        field.classList.add("select-missing");
    } else if (tagName === "TEXTAREA") {
        field.classList.add("textarea-missing");
    } else {
        field.classList.add("input-missing");
    }
    field.setAttribute("aria-invalid", "true");
}

function focusMissingField(field) {
    if (!field) {
        return;
    }

    try {
        field.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (_) {
        // Ignore smooth scroll unsupported browsers.
    }

    setTimeout(() => {
        try {
            field.focus({ preventScroll: true });
        } catch (_) {
            field.focus();
        }

        if (typeof field.setSelectionRange === "function") {
            const end = String(field.value || "").length;
            try {
                field.setSelectionRange(end, end);
            } catch (_) {
                // Ignore elements that do not support setSelectionRange.
            }
        }
    }, 120);
}

function validateRequiredShippingFields() {
    let firstMissingField = null;

    REQUIRED_SHIPPING_FIELD_IDS.forEach((id) => {
        const field = document.getElementById(id);
        if (!field) {
            return;
        }

        const value = String(field.value || "").trim();
        if (!value) {
            markMissingFieldState(field);
            if (!firstMissingField) {
                firstMissingField = field;
            }
            return;
        }

        clearMissingFieldState(field);
    });

    if (!firstMissingField) {
        return true;
    }

    setMessage("Vui lòng điền đủ thông tin.", "error");
    focusMissingField(firstMissingField);
    return false;
}

function bindRequiredShippingFieldInteractions() {
    REQUIRED_SHIPPING_FIELD_IDS.forEach((id) => {
        const field = document.getElementById(id);
        if (!field) {
            return;
        }

        const eventName = String(field.tagName || "").toUpperCase() === "SELECT" ? "change" : "input";
        field.addEventListener(eventName, () => {
            const value = String(field.value || "").trim();
            if (value) {
                clearMissingFieldState(field);
            }
        });
    });
}

function buildShippingAddress() {
    const province = getInputValue("shipping-province");
    const district = getInputValue("shipping-district");
    const detail = getInputValue("shipping-detail");
    const note = getInputValue("shipping-note");

    const addressParts = [detail, district, province].filter(Boolean);
    const baseAddress = addressParts.join(", ");
    if (!note) {
        return baseAddress;
    }

    return `${baseAddress}\nGhi chú: ${note}`;
}

function renderShippingPreview() {
    const previewEl = document.getElementById("shipping-preview");
    const hiddenAddressEl = document.getElementById("shipping-address");
    const fullAddress = buildShippingAddress();

    if (hiddenAddressEl) {
        hiddenAddressEl.value = fullAddress;
    }

    if (!previewEl) {
        return;
    }

    if (!fullAddress) {
        previewEl.textContent = "Địa chỉ sẽ được hiển thị tại đây sau khi bạn nhập thông tin.";
        return;
    }

    previewEl.textContent = `Địa chỉ nhận hàng: ${fullAddress}`;
}

function updateDistrictSuggestions() {
    const province = getInputValue("shipping-province");
    const datalist = document.getElementById("district-suggestions");
    if (!datalist) {
        return;
    }

    const provinceHints = DISTRICT_SUGGESTIONS_BY_PROVINCE[province] || [];
    const merged = Array.from(new Set([...provinceHints, ...COMMON_DISTRICT_HINTS]));

    datalist.innerHTML = merged.map((item) => `<option value="${escapeHtml(item)}"></option>`).join("");
}

function initAddressSelectors() {
    const provinceSelect = document.getElementById("shipping-province");
    if (!provinceSelect) {
        return;
    }

    provinceSelect.innerHTML = `
        <option value="">Chọn tỉnh/thành phố</option>
        ${PROVINCE_OPTIONS.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}
    `;

    updateDistrictSuggestions();

    provinceSelect.addEventListener("change", () => {
        updateDistrictSuggestions();
        renderShippingPreview();
    });

    const districtInput = document.getElementById("shipping-district");
    if (districtInput) {
        districtInput.addEventListener("input", renderShippingPreview);
    }

    const detailInput = document.getElementById("shipping-detail");
    if (detailInput) {
        detailInput.addEventListener("input", renderShippingPreview);
    }

    const noteInput = document.getElementById("shipping-note");
    if (noteInput) {
        noteInput.addEventListener("input", renderShippingPreview);
    }

    renderShippingPreview();
}

function getSelectedPaymentOption() {
    const checked = document.querySelector('input[name="paymentOption"]:checked');
    return checked ? String(checked.value || "COD").trim().toUpperCase() : "COD";
}

function resolvePaymentSelection() {
    const option = getSelectedPaymentOption();
    // tac dung code: map option giao dien thanh payload backend (paymentMethod + provider) giu nguyen API hien tai.
    switch (option) {
        case "ONLINE_VNPAY":
            return { paymentMethod: "ONLINE_GATEWAY", provider: "VNPAY", isOnlineGateway: true };
        case "ONLINE_MOMO":
            return { paymentMethod: "ONLINE_GATEWAY", provider: "MOMO", isOnlineGateway: true };
        case "COD":
        default:
            return { paymentMethod: "COD", provider: null, isOnlineGateway: false };
    }
}

async function loadProfileAddress() {
    try {
        const response = await fetch("/api/customer/profile", {
            headers: {
                ...TechStore.authHeader()
            }
        });

        if (!response.ok) {
            return;
        }

        const profile = await response.json();
        const recipientNameEl = document.getElementById("recipient-name");
        if (recipientNameEl && profile && profile.fullName && !recipientNameEl.value.trim()) {
            recipientNameEl.value = String(profile.fullName).trim();
        }

        const recipientPhoneEl = document.getElementById("recipient-phone");
        if (recipientPhoneEl && profile && profile.phone && !recipientPhoneEl.value.trim()) {
            recipientPhoneEl.value = String(profile.phone).trim();
        }

        const detailEl = document.getElementById("shipping-detail");
        if (detailEl && profile && profile.address && !detailEl.value) {
            detailEl.value = profile.address;
        }

        REQUIRED_SHIPPING_FIELD_IDS.forEach((id) => {
            const field = document.getElementById(id);
            if (field && String(field.value || "").trim()) {
                clearMissingFieldState(field);
            }
        });

        renderShippingPreview();
    } catch (_) {
        // Ignore profile auto-fill errors.
    }
}

async function initCheckoutItems() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get("productId");
    const variantIdParam = Number(params.get("variantId") || 0);
    const requestedQuantity = parsePositiveQuantity(params.get("quantity") || params.get("qty"), 1);

    if (productId) {
        checkoutMode = "buyNow";

        const response = await fetch(`/api/public/products/${encodeURIComponent(productId)}`);
        if (!response.ok) {
            checkoutItems = [];
            return;
        }

        const product = await response.json();
        const pricing = TechStore.resolveProductPricing(product);

        const selectedVariantId = Number.isFinite(variantIdParam) && variantIdParam > 0 ? variantIdParam : 0;
        let variants = [];
        try {
            const variantResponse = await fetch(`/api/public/products/${encodeURIComponent(productId)}/variants`);
            if (variantResponse.ok) {
                const rawVariants = await variantResponse.json();
                variants = Array.isArray(rawVariants) ? rawVariants : [];
            }
        } catch (_) {
            variants = [];
        }

        let selectedVariant = null;
        if (variants.length > 0) {
            selectedVariant = Array.isArray(variants)
                ? variants.find((variant) => Number(variant && variant.id ? variant.id : 0) === selectedVariantId)
                : null;
            if (!selectedVariant && selectedVariantId <= 0) {
                selectedVariant = variants.find((variant) => Number(variant && variant.stock ? variant.stock : 0) > 0) || variants[0];
            }
            if (selectedVariantId > 0 && !selectedVariant) {
                throw new Error("Biến thể sản phẩm không còn tồn tại");
            }
        }

        const variantPricing = selectedVariant
            ? TechStore.resolveProductPricing({
                originalPrice: Number(selectedVariant.price || 0),
                discountPercent: pricing.discountPercent
            })
            : null;
        const originalPrice = variantPricing ? variantPricing.originalPrice : pricing.originalPrice;
        const finalPrice = variantPricing ? variantPricing.finalPrice : pricing.finalPrice;
        const variantStock = selectedVariant
            ? Number(selectedVariant.stock || 0)
            : Number(product && product.stock ? product.stock : 0);
        const variantName = selectedVariant && selectedVariant.name ? String(selectedVariant.name) : "";
        const displayName = variantName ? `${product.name} (${variantName})` : product.name;
        const quantity = variantStock > 0
            ? Math.min(requestedQuantity, variantStock)
            : requestedQuantity;
        checkoutItems = [{
            productId: product.id,
            variantId: selectedVariant ? Number(selectedVariant.id || 0) : 0,
            variantName,
            productName: displayName,
            imageUrl: product.imageUrl,
            price: finalPrice,
            originalPrice,
            discountPercent: pricing.discountPercent,
            finalPrice,
            quantity
        }];
        return;
    }

    checkoutMode = "cart";
    checkoutItems = await TechStore.fetchCart(true);
}

async function placeOrder() {
    setMessage("", "");

    if (!TechStore.ensureLoggedIn()) {
        return;
    }

    if (!checkoutItems || checkoutItems.length === 0) {
        showEmpty();
        return;
    }

    const btn = document.getElementById("place-order-btn");
    if (!btn) {
        return;
    }

    if (!validateRequiredShippingFields()) {
        return;
    }

    const recipientName = getInputValue("recipient-name");
    const recipientPhone = getInputValue("recipient-phone");
    const shippingAddress = buildShippingAddress();
    if (!shippingAddress) {
        setMessage("Vui lòng điền đủ thông tin.", "error");
        focusMissingField(document.getElementById("shipping-detail"));
        return;
    }

    btn.disabled = true;
    btn.textContent = "Đang xử lý...";

    const paymentSelection = resolvePaymentSelection();
    const paymentMethod = paymentSelection.paymentMethod;

    const payload = {
        recipientName,
        recipientPhone,
        shippingAddress,
        paymentMethod,
        promotionCode: appliedPromo ? appliedPromo.code : null,
        items: checkoutItems.map((item) => ({
            productId: item.productId,
            variantId: Number(item.variantId || 0) > 0 ? Number(item.variantId || 0) : null,
            quantity: item.quantity
        }))
    };

    try {
        const response = await fetch("/api/customer/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...TechStore.authHeader()
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || "Đặt hàng thất bại");
        }

        const data = await response.json();

        const isOnlineGateway = paymentSelection.isOnlineGateway;
        if (typeof TechStore.notifyOrderPlaced === "function" && data && data.id) {
            TechStore.notifyOrderPlaced(data.id, isOnlineGateway);
        }

        // tác dụng code: neu khach chon ONLINE_GATEWAY thi tao phien thanh toan va redirect sang cong thanh toan.

        if (checkoutMode === "cart") {
            try {
                await TechStore.clearCart();
            } catch (_) {
                // Order is already created; cart cleanup can be retried later.
            }
        }

        if (isOnlineGateway) {
            try {
                const sessionResponse = await fetch("/api/customer/payments/session", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...TechStore.authHeader()
                    },
                    body: JSON.stringify({
                        orderId: data.id,
                        provider: paymentSelection.provider || "VNPAY"
                    })
                });

                if (!sessionResponse.ok) {
                    const sessionErr = await sessionResponse.json().catch(() => ({}));
                    throw new Error(sessionErr.message || "Tạo phiên thanh toán online thất bại.");
                }

                const session = await sessionResponse.json();
                setMessage("Đơn đã tạo. Đang chuyển sang cổng thanh toán...", "success");
                setTimeout(() => {
                    window.location.href = session.checkoutUrl;
                }, 300);
                return;
            } catch (sessionError) {
                // tac dung code: tranh tao lap don khi redirect cong thanh toan loi, uu tien dua user ve don da tao.
                setMessage("Đơn đã tạo nhưng chưa mở được cổng thanh toán. Hệ thống sẽ chuyển bạn đến trang đơn.", "error");
                setTimeout(() => {
                    window.location.href = `/orders/${encodeURIComponent(data.id)}`;
                }, 900);
                return;
            }
        }

        setMessage("Đặt hàng thành công. Cảm ơn bạn!", "success");
        setTimeout(() => {
            window.location.href = `/orders/${encodeURIComponent(data.id)}`;
        }, 900);
    } catch (err) {
        setMessage(err.message, "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "Đặt hàng";
    }
}

async function applyPromo() {
    setPromoHint("", "");

    const input = document.getElementById("promo-code");
    const code = input ? input.value.trim() : "";

    if (!code) {
        appliedPromo = null;
        updateTotals();
        setPromoHint("Đã bỏ mã khuyến mãi.", "success");
        return;
    }

    try {
        const response = await fetch(`/api/public/promotions/validate?code=${encodeURIComponent(code)}`);
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || "Mã khuyến mãi không hợp lệ");
        }

        const data = await response.json();
        appliedPromo = { code: data.code, discountPercent: data.discountPercent };
        if (input) {
            input.value = data.code || code.toUpperCase();
        }
        updateTotals();
        setPromoHint(data.message || "Áp dụng mã thành công.", "success");
    } catch (err) {
        appliedPromo = null;
        updateTotals();
        setPromoHint(err.message, "error");
    }
}

window.TechStore.placeOrder = placeOrder;
window.TechStore.applyPromo = applyPromo;

window.addEventListener("DOMContentLoaded", async () => {
    TechStore.updateHeader();

    if (!TechStore.ensureLoggedIn()) {
        return;
    }

    initAddressSelectors();
    bindRequiredShippingFieldInteractions();

    try {
        await initCheckoutItems();
    } catch (err) {
        setMessage(err.message || "Không tải được thông tin thanh toán", "error");
        showEmpty();
        return;
    }

    if (!checkoutItems.length) {
        showEmpty();
        return;
    }

    showContent();
    renderCheckout();
    await loadProfileAddress();

    const promoInput = document.getElementById("promo-code");
    if (promoInput) {
        promoInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                applyPromo();
            }
        });
    }
});

// product.js
// Trang chi tiết sản phẩm:
// - Load sản phẩm theo id
// - Render gallery nhiều ảnh (ảnh lớn + thumbnail)
// - Hiển thị thông số nhanh + thông số chi tiết
// - Thêm vào giỏ / mua ngay
// - Hỗ trợ biến thể + đánh giá

const REVIEW_MAX_CONTENT = 1200;
const AI_REVIEW_MAX_ITEMS = 5;
const AI_REVIEW_USE_CASE_LIBRARY = Object.freeze({
    gaming: {
        id: "gaming",
        icon: "🎮",
        tag: "GM",
        title: "Chơi game",
        description: "Độ trễ thấp, phản hồi nhanh, trải nghiệm mượt"
    },
    office: {
        id: "office",
        icon: "💼",
        tag: "VP",
        title: "Văn phòng",
        description: "Ổn định, dễ dùng, phù hợp làm việc hằng ngày"
    },
    design: {
        id: "design",
        icon: "🎨",
        tag: "DH",
        title: "Thiết kế đồ họa",
        description: "Màu sắc, độ chính xác, không gian làm việc"
    },
    video: {
        id: "video",
        icon: "🎬",
        tag: "VD",
        title: "Dựng video",
        description: "Xử lý media, timeline, hiệu suất ổn định"
    },
    programming: {
        id: "programming",
        icon: "💻",
        tag: "LT",
        title: "Lập trình",
        description: "Đa nhiệm, độ tin cậy, workflow phát triển"
    },
    study: {
        id: "study",
        icon: "📚",
        tag: "HT",
        title: "Học tập",
        description: "Dễ tiếp cận, bền bỉ, cân bằng chi phí"
    }
});
const AI_REVIEW_USE_CASES_BY_PRODUCT_TYPE = Object.freeze({
    laptop: ["gaming", "office", "design", "video", "programming", "study"],
    monitor: ["gaming", "office", "design", "video", "study"],
    keyboard: ["gaming", "office", "programming", "study"],
    mouse: ["gaming", "office", "study"],
    headphone: ["gaming", "office", "video", "study"],
    network: ["gaming", "office", "programming", "study"],
    component: ["gaming", "office", "design", "video", "programming"],
    accessory: ["gaming", "office", "study"],
    general: ["gaming", "office", "study"]
});
let currentProduct = null;
let currentVariants = [];
let currentActiveVariantId = null;
const aiReviewCacheByProductId = new Map();
const aiReviewUseCaseByProductId = new Map();

function normalizeQuantity(rawValue, availableStock) {
    const stock = Number(availableStock || 0);
    const maxQty = stock > 0 ? stock : 1;
    const parsed = Number(rawValue);
    const safe = Number.isFinite(parsed) ? Math.trunc(parsed) : 1;
    return Math.min(Math.max(safe, 1), maxQty);
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

function toast(message) {
    let holder = document.getElementById("toast");
    if (!holder) {
        holder = document.createElement("div");
        holder.id = "toast";
        holder.className = "toast";
        document.body.appendChild(holder);
    }

    holder.textContent = message || "";
    holder.classList.add("show");
    setTimeout(() => holder.classList.remove("show"), 1300);
}

function syncProductModalBodyLock() {
    const modalIds = [
        "product-image-modal",
        "product-spec-modal",
        "ai-review-usecase-modal",
        "product-ai-result-modal",
        "product-ai-loading-modal"
    ];
    const hasVisibleModal = modalIds
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .some((el) => !el.hidden);
    document.body.style.overflow = hasVisibleModal ? "hidden" : "";
}

function openAiResultModal() {
    const modal = document.getElementById("product-ai-result-modal");
    if (!modal) {
        return;
    }
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    syncProductModalBodyLock();
}

function closeAiResultModal() {
    const modal = document.getElementById("product-ai-result-modal");
    if (!modal) {
        return;
    }
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    syncProductModalBodyLock();
}

function openAiLoadingModal(message) {
    const modal = document.getElementById("product-ai-loading-modal");
    if (!modal) {
        return;
    }
    const textEl = document.getElementById("product-ai-loading-text");
    if (textEl) {
        textEl.textContent = message || "AI đang phân tích cấu hình sản phẩm...";
    }
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    syncProductModalBodyLock();
}

function closeAiLoadingModal() {
    const modal = document.getElementById("product-ai-loading-modal");
    if (!modal) {
        return;
    }
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    syncProductModalBodyLock();
}

function actionIcon(kind) {
    if (kind === "buy") {
        return `
            <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg>
            </span>
        `;
    }
    if (kind === "ai") {
        return `
            <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                    <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z"/>
                    <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z"/>
                </svg>
            </span>
        `;
    }

    return `
        <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
                <path d="M6 6h15l-2 10H7L6 6Z"/>
                <path d="M6 6 5 3H2"/>
                <path d="M12 10v6"/>
                <path d="M9 13h6"/>
            </svg>
        </span>
    `;
}

function parseMultiline(value) {
    return String(value || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

function cleanDescriptionText(value) {
    return String(value || "")
        .replace(/[#*_`>]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function resolveDescriptionUseCase(product) {
    const category = normalizeText(product && product.category ? product.category.name : "");
    if (category.includes("laptop")) {
        return "học tập, làm việc và giải trí";
    }
    if (category.includes("man hinh")) {
        return "làm việc, giải trí và chơi game";
    }
    if (category.includes("ban phim") || category.includes("chuot") || category.includes("tai nghe")) {
        return "chơi game và sử dụng hằng ngày";
    }
    if (category.includes("phu kien")) {
        return "nâng cấp góc máy và sử dụng ổn định lâu dài";
    }
    return "nhu cầu sử dụng hằng ngày";
}

function buildDescriptionFeatureList(product) {
    const unique = new Set();
    const features = [];

    const pushFeature = (rawValue) => {
        const value = cleanDescriptionText(rawValue);
        if (!value || value.length < 6) {
            return;
        }
        const key = normalizeText(value);
        if (!key || unique.has(key)) {
            return;
        }
        unique.add(key);
        features.push(value);
    };

    buildDefaultSpecRows(product).forEach((row) => {
        pushFeature(`${row.label} ${row.value}`);
    });

    parseMultiline(product && product.quickSpecs).forEach((line) => {
        pushFeature(line);
    });

    parseMultiline(product && product.detailSpecs).forEach((line) => {
        const idx = line.indexOf(":");
        if (idx > 0) {
            pushFeature(`${line.slice(0, idx).trim()} ${line.slice(idx + 1).trim()}`);
        }
    });

    return features.slice(0, 2);
}

function getShortProductDescription(product) {
    const productName = String(product && product.name || "").trim();
    const fallbackName = productName || "Sản phẩm này";
    const rawCategory = String(product && product.category ? product.category.name : "").trim();
    const categoryPart = rawCategory ? `mẫu ${rawCategory.toLowerCase()}` : "sản phẩm công nghệ";
    const useCase = resolveDescriptionUseCase(product);
    const features = buildDescriptionFeatureList(product);

    let summary = `${fallbackName} là ${categoryPart}`;
    if (features.length > 0) {
        summary += ` nổi bật với ${features.join(", ")}`;
    }
    summary += `, phù hợp cho ${useCase}.`;

    if (summary.length <= 240) {
        return summary;
    }

    if (features.length > 1) {
        return `${fallbackName} là ${categoryPart} nổi bật với ${features[0]}, phù hợp cho ${useCase}.`;
    }
    return `${fallbackName} là ${categoryPart}, phù hợp cho ${useCase}.`;
}

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function resolveAiProductType(product) {
    const category = normalizeText(product && product.category ? product.category.name : "");
    const name = normalizeText(product && product.name ? product.name : "");
    const fingerprint = `${category} ${name}`.trim();

    if (fingerprint.includes("laptop") || fingerprint.includes("notebook") || fingerprint.includes("macbook")) {
        return "laptop";
    }
    if (fingerprint.includes("man hinh") || fingerprint.includes("monitor") || fingerprint.includes("display")) {
        return "monitor";
    }
    if (fingerprint.includes("ban phim") || fingerprint.includes("keyboard")) {
        return "keyboard";
    }
    if (fingerprint.includes("chuot") || fingerprint.includes("mouse")) {
        return "mouse";
    }
    if (fingerprint.includes("tai nghe") || fingerprint.includes("headphone") || fingerprint.includes("headset")) {
        return "headphone";
    }
    if (fingerprint.includes("thiet bi mang") || fingerprint.includes("router") || fingerprint.includes("mesh") || fingerprint.includes("wifi")) {
        return "network";
    }
    if (fingerprint.includes("linh kien") || fingerprint.includes("vga") || fingerprint.includes("mainboard") || fingerprint.includes("ssd")) {
        return "component";
    }
    if (fingerprint.includes("phu kien") || fingerprint.includes("dock") || fingerprint.includes("hub") || fingerprint.includes("adapter")) {
        return "accessory";
    }
    return "general";
}

function getAiUseCaseOptions(product = currentProduct) {
    const productType = resolveAiProductType(product);
    const ids = AI_REVIEW_USE_CASES_BY_PRODUCT_TYPE[productType] || AI_REVIEW_USE_CASES_BY_PRODUCT_TYPE.general;
    return ids
        .map((id) => AI_REVIEW_USE_CASE_LIBRARY[id])
        .filter(Boolean);
}

function getAiUseCasePrompt(product = currentProduct) {
    const productType = resolveAiProductType(product);
    switch (productType) {
        case "laptop":
            return "Bạn sẽ dùng laptop này để làm gì?";
        case "monitor":
            return "Bạn cần màn hình này cho nhu cầu nào?";
        case "keyboard":
            return "Bạn cần bàn phím này cho nhu cầu nào?";
        case "mouse":
            return "Bạn cần chuột này cho nhu cầu nào?";
        case "headphone":
            return "Bạn cần tai nghe này cho nhu cầu nào?";
        case "network":
            return "Bạn cần thiết bị mạng này cho nhu cầu nào?";
        case "component":
            return "Bạn muốn đánh giá linh kiện này theo nhu cầu nào?";
        case "accessory":
            return "Bạn sẽ dùng phụ kiện này vào mục đích nào?";
        default:
            return "Bạn sẽ dùng sản phẩm này cho nhu cầu nào?";
    }
}

function getAiLoadingHint(product = currentProduct, useCaseId = "") {
    const productType = resolveAiProductType(product);
    const useCaseLabel = getAiUseCaseLabel(useCaseId, product).toLowerCase();
    switch (productType) {
        case "laptop":
            return `AI đang phân tích CPU, GPU, RAM, SSD và màn hình cho mục đích ${useCaseLabel}.`;
        case "monitor":
            return `AI đang phân tích tần số quét, tấm nền, độ phân giải và cổng kết nối cho mục đích ${useCaseLabel}.`;
        case "keyboard":
            return `AI đang phân tích switch, độ phản hồi, kiểu kết nối và độ bền cho mục đích ${useCaseLabel}.`;
        case "mouse":
            return `AI đang phân tích cảm biến, polling rate, trọng lượng và kết nối cho mục đích ${useCaseLabel}.`;
        case "headphone":
            return `AI đang phân tích driver, độ trễ, microphone và cách âm cho mục đích ${useCaseLabel}.`;
        case "network":
            return `AI đang phân tích chuẩn Wi-Fi, băng thông, vùng phủ và độ ổn định cho mục đích ${useCaseLabel}.`;
        default:
            return `AI đang phân tích thông số kỹ thuật theo loại sản phẩm cho mục đích ${useCaseLabel}.`;
    }
}

function normalizeBrandKey(value) {
    return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function resolveProductBrand(product) {
    const knownBrands = [
        "ASUS", "ACER", "MSI", "LENOVO", "GIGABYTE", "DELL", "HP", "LG",
        "APPLE", "SAMSUNG", "SONY", "XIAOMI", "RAZER", "LOGITECH", "TP-LINK",
        "Keychron", "E-Dra", "DareU", "HyperX", "AULA", "AKKO", "Ugreen",
        "Rapoo", "Veekos", "Corsair", "SteelSeries", "Anker", "Baseus",
        "JBL", "Edifier"
    ];
    const blockedFirstTokens = new Set([
        "ban", "phim", "tai", "nghe", "chuot", "laptop", "dien", "thoai",
        "gaming", "co", "day", "khong", "wireless", "headset", "cap"
    ]);

    const detailSpecs = parseMultiline(product && product.detailSpecs);
    const brandLine = detailSpecs.find((line) => {
        const idx = line.indexOf(":");
        if (idx <= 0) {
            return false;
        }
        const label = normalizeText(line.slice(0, idx));
        return label.includes("thuong hieu");
    });
    if (brandLine) {
        const idx = brandLine.indexOf(":");
        const label = brandLine.slice(idx + 1).trim();
        const key = normalizeBrandKey(label);
        if (key) {
            return { label, key };
        }
    }

    const name = String(product && product.name || "").trim();
    const normalizedName = normalizeBrandKey(name);
    if (!normalizedName) {
        return { label: "", key: "" };
    }

    const matchedBrand = knownBrands.find((brand) => normalizedName.includes(normalizeBrandKey(brand)));
    if (matchedBrand) {
        return { label: matchedBrand, key: normalizeBrandKey(matchedBrand) };
    }

    const firstToken = name.split(/[\s/-]+/).find(Boolean) || "";
    const tokenKey = normalizeBrandKey(firstToken);
    if (tokenKey && !blockedFirstTokens.has(tokenKey)) {
        return { label: firstToken, key: tokenKey };
    }

    return { label: "", key: "" };
}

function shouldPreferCategorySpecs(product) {
    const categoryName = normalizeText(product && product.category ? product.category.name : "");
    // Keyboard, headphones, and accessories should display contextual specs, not generic CPU/RAM labels.
    return categoryName.includes("ban phim") || categoryName.includes("tai nghe") || categoryName.includes("phu kien");
}

function getGalleryImages(product) {
    // Danh sách ảnh hiển thị: ảnh đại diện + bộ ảnh (không trùng lặp).
    const seen = new Set();
    const images = [];

    const push = (url) => {
        const clean = String(url || "").trim();
        if (!clean) {
            return;
        }
        const key = clean.toLowerCase();
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        images.push(clean);
    };

    push(product.imageUrl);
    parseMultiline(product.galleryImages).forEach(push);

    if (!images.length) {
        images.push("https://placehold.co/1200x900/f3f4f6/111827?text=TechParadise");
    }
    return images;
}

function buildDefaultSpecRows(product) {
    return [
        { label: "CPU", value: product.cpu },
        { label: "RAM", value: product.ram },
        { label: "Bộ nhớ", value: product.storage },
        { label: "Card đồ hoạ", value: product.gpu },
        { label: "Màn hình", value: product.screen },
        { label: "Pin", value: product.battery },
        { label: "Camera", value: product.camera },
        { label: "Hệ điều hành", value: product.operatingSystem }
    ].filter((row) => String(row.value || "").trim());
}

function normalizeSpecKey(label) {
    const key = normalizeText(label).replace(/[^a-z0-9]/g, "");
    if (key === "cpuchip") {
        return "cpu";
    }
    if (key === "gpu" || key === "cardmanhinh") {
        return "carddohoa";
    }
    if (key === "ocung" || key === "luutru" || key === "storage") {
        return "bonho";
    }
    return key;
}

function hasSpecLabel(rows, containsText) {
    const needle = normalizeText(containsText);
    return rows.some((row) => normalizeText(row.label).includes(needle));
}

function upsertSpecRow(rows, label, value) {
    const safeLabel = String(label || "").trim();
    const safeValue = String(value || "").trim();
    if (!safeLabel || !safeValue) {
        return;
    }

    const key = normalizeSpecKey(safeLabel);
    const found = rows.find((row) => normalizeSpecKey(row.label) === key);
    if (found) {
        found.value = safeValue;
        return;
    }

    rows.push({ label: safeLabel, value: safeValue });
}

function getQuickSpecs(product) {
    if (shouldPreferCategorySpecs(product)) {
        const customSpecs = parseMultiline(product.quickSpecs);
        if (customSpecs.length) {
            return customSpecs.slice(0, 6);
        }
    }

    const fromDefaultFields = buildDefaultSpecRows(product).map((row) => `${row.label}: ${row.value}`);
    if (fromDefaultFields.length) {
        return fromDefaultFields.slice(0, 6);
    }

    const specs = parseMultiline(product.quickSpecs);
    if (specs.length) {
        return specs.slice(0, 6);
    }

    const fallback = [];
    if (product.category && product.category.name) {
        fallback.push(`Danh mục: ${product.category.name}`);
    }

    const stock = Number(product.stock || 0);
    fallback.push(stock > 0 ? `Tồn kho: ${stock}` : "Hết hàng");

    const description = String(product.description || "").trim();
    if (description) {
        const head = description.split(/[|,.;]/).map((x) => x.trim()).filter(Boolean)[0];
        if (head) {
            fallback.push(head);
        }
    }

    return fallback.slice(0, 4);
}

function renderProductRating(product, extraClass = "") {
    const rating = TechStore.resolveProductRating(product);
    const className = extraClass ? `product-rating ${extraClass}` : "product-rating";
    const meta = `${rating.averageRating.toFixed(1)} (${rating.totalReviews})`;
    const title = rating.totalReviews > 0
        ? `${rating.averageRating.toFixed(1)}/5 từ ${rating.totalReviews} đánh giá`
        : "Chưa có đánh giá";

    return `
        <div class="${className}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
            <span class="rating-stars" aria-hidden="true">${rating.stars}</span>
            <span class="rating-meta">${escapeHtml(meta)}</span>
        </div>
    `;
}

function parseDetailSpecs(product) {
    const rows = [];
    let genericSpecIndex = 1;
    const preferCategorySpecs = shouldPreferCategorySpecs(product);

    if (!preferCategorySpecs) {
        buildDefaultSpecRows(product).forEach((row) => {
            upsertSpecRow(rows, row.label, row.value);
        });
    }

    parseMultiline(product.detailSpecs).forEach((line) => {
        const idx = line.indexOf(":");
        if (idx > 0) {
            upsertSpecRow(rows, line.slice(0, idx).trim(), line.slice(idx + 1).trim());
            return;
        }

        // Nếu không có dấu ":" thì vẫn giữ để hiển thị dưới dạng ghi chú thông số.
        rows.push({ label: `Thông số ${genericSpecIndex}`, value: line });
        genericSpecIndex += 1;
    });

    if (!rows.length) {
        getQuickSpecs(product).forEach((spec, index) => {
            rows.push({ label: `Thông số ${index + 1}`, value: spec });
        });
    }

    // Bổ sung một số dòng cơ bản để bảng luôn đầy đủ khi chưa nhập đủ thông số.
    if (!hasSpecLabel(rows, "danh muc")) {
        rows.push({
            label: "Danh mục",
            value: product.category && product.category.name ? product.category.name : "Chưa phân loại"
        });
    }

    if (!hasSpecLabel(rows, "ton kho")) {
        rows.push({ label: "Tồn kho", value: String(Number(product.stock || 0)) });
    }

    return rows;
}

function getProductIdFromPath() {
    const parts = (window.location.pathname || "").split("/").filter(Boolean);
    const raw = parts[parts.length - 1];
    return Number(raw || 0);
}

function emptyReviewSummary(productId) {
    return {
        productId,
        totalReviews: 0,
        averageRating: 0,
        oneStar: 0,
        twoStar: 0,
        threeStar: 0,
        fourStar: 0,
        fiveStar: 0,
        canReview: false,
        hasReviewed: false
    };
}

function normalizeVariant(variant) {
    return {
        id: Number(variant && variant.id ? variant.id : 0),
        name: String(variant && variant.name ? variant.name : "Biến thể"),
        price: Number(variant && variant.price ? variant.price : 0),
        stock: Number(variant && variant.stock ? variant.stock : 0)
    };
}

function resolveVariantState(product, variants, preferredVariantId) {
    const list = Array.isArray(variants) ? variants.map(normalizeVariant) : [];
    const productPricing = TechStore.resolveProductPricing(product || {});
    const productDiscountPercent = productPricing.discountPercent;

    if (!list.length) {
        return {
            hasVariants: false,
            variant: null,
            price: productPricing.finalPrice,
            originalPrice: productPricing.originalPrice,
            discountPercent: productDiscountPercent,
            hasDiscount: productPricing.hasDiscount,
            stock: Number(product.stock || 0)
        };
    }

    let variant = null;
    if (preferredVariantId) {
        variant = list.find((item) => Number(item.id) === Number(preferredVariantId)) || null;
    }
    if (!variant) {
        variant = list.find((item) => Number(item.stock || 0) > 0) || list[0];
    }

    return {
        hasVariants: true,
        variant,
        price: TechStore.calculateDiscountedPrice(variant.price || 0, productDiscountPercent),
        originalPrice: Number(variant.price || 0),
        discountPercent: productDiscountPercent,
        hasDiscount: productDiscountPercent > 0
            && TechStore.calculateDiscountedPrice(variant.price || 0, productDiscountPercent) < Number(variant.price || 0),
        stock: Number(variant.stock || 0)
    };
}

async function readJsonResponse(response, fallbackMessage) {
    const raw = await response.text();
    let data = null;
    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch (_) {
            data = null;
        }
    }

    if (!response.ok) {
        const message = data && data.message ? data.message : fallbackMessage;
        throw new Error(message || "Có lỗi xảy ra");
    }

    return data;
}

async function fetchVariants(productId) {
    const response = await fetch(`/api/public/products/${encodeURIComponent(productId)}/variants`);
    const data = await readJsonResponse(response, "Không tải được biến thể sản phẩm");
    return Array.isArray(data) ? data.map(normalizeVariant) : [];
}

async function fetchReviewSummary(productId) {
    const response = await fetch(`/api/public/products/${encodeURIComponent(productId)}/review-summary`, {
        headers: {
            ...TechStore.authHeader()
        }
    });
    const data = await readJsonResponse(response, "Không tải được thông tin đánh giá");
    return data || emptyReviewSummary(productId);
}

async function fetchReviews(productId) {
    const response = await fetch(`/api/public/products/${encodeURIComponent(productId)}/reviews`, {
        headers: {
            ...TechStore.authHeader()
        }
    });
    const data = await readJsonResponse(response, "Không tải được danh sách đánh giá");
    return Array.isArray(data) ? data : [];
}

function normalizeAiUseCaseId(rawValue, product = currentProduct) {
    const id = String(rawValue || "").trim().toLowerCase();
    return getAiUseCaseOptions(product).some((item) => item.id === id) ? id : "";
}

function getAiUseCaseMeta(useCaseId, product = currentProduct) {
    const id = normalizeAiUseCaseId(useCaseId, product);
    return getAiUseCaseOptions(product).find((item) => item.id === id) || null;
}

function getAiUseCaseLabel(useCaseId, product = currentProduct) {
    const meta = getAiUseCaseMeta(useCaseId, product);
    return meta ? meta.title : "Tổng quan";
}

function buildAiReviewCacheKey(productId, useCaseId, product = currentProduct) {
    const safeId = Number(productId || 0);
    const safeUseCase = normalizeAiUseCaseId(useCaseId, product);
    return `${safeId}::${safeUseCase || "general"}`;
}

function getSelectedAiUseCase(productId, product = currentProduct) {
    const safeId = Number(productId || 0);
    if (!safeId) {
        return "";
    }
    return normalizeAiUseCaseId(aiReviewUseCaseByProductId.get(safeId), product);
}

function setSelectedAiUseCase(productId, useCaseId, product = currentProduct) {
    const safeId = Number(productId || 0);
    if (!safeId) {
        return;
    }
    const normalized = normalizeAiUseCaseId(useCaseId, product);
    if (!normalized) {
        aiReviewUseCaseByProductId.delete(safeId);
        return;
    }
    aiReviewUseCaseByProductId.set(safeId, normalized);
}

function renderAiUseCaseOptions(selectedUseCaseId, product = currentProduct) {
    const selected = normalizeAiUseCaseId(selectedUseCaseId, product);
    return getAiUseCaseOptions(product).map((item) => `
        <button
            class="ai-usecase-option ${selected === item.id ? "active" : ""}"
            type="button"
            data-ai-usecase="${escapeHtml(item.id)}"
            aria-pressed="${selected === item.id ? "true" : "false"}"
        >
            <span class="ai-usecase-visual">
                <span class="ai-usecase-icon" aria-hidden="true">${escapeHtml(item.icon || "✨")}</span>
            </span>
            <span class="ai-usecase-text">
                <strong>${escapeHtml(item.title)}</strong>
                <small>${escapeHtml(item.description)}</small>
            </span>
        </button>
    `).join("");
}

function sanitizeAiReviewText(value, fallback, maxLen) {
    const text = String(value || "").trim();
    const base = text || String(fallback || "").trim();
    if (!base) {
        return "";
    }
    const safeLen = Math.max(32, Number(maxLen || 0));
    if (base.length <= safeLen) {
        return base;
    }
    return `${base.slice(0, safeLen).trim()}...`;
}

function sanitizeAiReviewList(rawList, fallbackText, maxItems = AI_REVIEW_MAX_ITEMS, itemMaxLen = 180) {
    const list = Array.isArray(rawList) ? rawList : [];
    const items = list
        .map((item) => sanitizeAiReviewText(item, "", itemMaxLen))
        .filter(Boolean)
        .slice(0, Math.max(1, Number(maxItems || AI_REVIEW_MAX_ITEMS)));

    if (!items.length) {
        const fallback = sanitizeAiReviewText(fallbackText, "", itemMaxLen);
        if (fallback) {
            items.push(fallback);
        }
    }

    return items;
}

function normalizeAiReviewPayload(productId, payload, product = currentProduct) {
    const source = String(payload && payload.generatedBy ? payload.generatedBy : "").trim().toUpperCase();
    const scoreRaw = Number(payload && payload.score ? payload.score : 0);
    const safeScore = Math.max(1, Math.min(10, Number.isFinite(scoreRaw) ? Math.round(scoreRaw) : 5));
    const useCaseId = normalizeAiUseCaseId(payload && payload.useCase ? payload.useCase : "", product);
    return {
        productId: Number(productId || 0),
        productName: sanitizeAiReviewText(payload && payload.productName ? payload.productName : "", "", 240),
        useCase: useCaseId,
        model: sanitizeAiReviewText(payload && payload.model ? payload.model : "", "", 80),
        generatedBy: source || "LOCAL_RULES",
        score: safeScore,
        scoreReason: sanitizeAiReviewText(
            payload && payload.scoreReason ? payload.scoreReason : "",
            "AI chấm điểm dựa trên thông số kỹ thuật theo loại sản phẩm cho mục đích đã chọn.",
            520
        ),
        summary: sanitizeAiReviewText(
            payload && payload.summary ? payload.summary : "",
            "AI chưa đủ dữ liệu để kết luận chi tiết từ cấu hình sản phẩm.",
            620
        ),
        strengths: sanitizeAiReviewList(
            payload && payload.strengths ? payload.strengths : [],
            "Chưa có đủ điểm mạnh rõ ràng từ dữ liệu cấu hình hiện tại."
        ),
        weaknesses: sanitizeAiReviewList(
            payload && payload.weaknesses ? payload.weaknesses : [],
            "Chưa có đủ dữ liệu về điểm yếu, nên kiểm tra thêm chi tiết kỹ thuật."
        ),
        detailedEvaluation: sanitizeAiReviewText(
            payload && payload.detailedEvaluation ? payload.detailedEvaluation : "",
            "AI đang đánh giá mức độ phù hợp của thông số với nhu cầu sử dụng.",
            860
        ),
        predictedPerformance: sanitizeAiReviewList(
            payload && payload.predictedPerformance ? payload.predictedPerformance : [],
            "Hiệu năng dự đoán đang được cập nhật từ dữ liệu cấu hình."
        ),
        valueAndComparison: sanitizeAiReviewText(
            payload && payload.valueAndComparison ? payload.valueAndComparison : "",
            "Giá trị sử dụng ở mức trung bình, nên so sánh thêm với mẫu cùng tầm giá.",
            420
        ),
        conclusion: sanitizeAiReviewText(
            payload && payload.conclusion ? payload.conclusion : "",
            "Kết luận cần được đối chiếu thêm với nhu cầu và ngân sách thực tế.",
            300
        ),
        recommendation: sanitizeAiReviewText(
            payload && payload.recommendation ? payload.recommendation : "",
            "Nên so sánh thêm với mẫu có cấu hình tương đương trước khi chốt.",
            280
        )
    };
}

async function fetchAiReview(productId, options = {}) {
    const safeProductId = Number(productId || 0);
    if (!safeProductId) {
        throw new Error("ID sản phẩm không hợp lệ.");
    }

    const productContext = options.product || currentProduct;
    const useCaseId = normalizeAiUseCaseId(options.useCase, productContext);
    const cacheKey = buildAiReviewCacheKey(safeProductId, useCaseId, productContext);
    const force = !!options.force;
    if (!force && aiReviewCacheByProductId.has(cacheKey)) {
        return aiReviewCacheByProductId.get(cacheKey);
    }

    let endpoint = `/api/public/products/${encodeURIComponent(safeProductId)}/ai-review`;
    if (useCaseId) {
        endpoint += `?useCase=${encodeURIComponent(useCaseId)}`;
    }

    const response = await fetch(endpoint, {
        headers: {
            ...TechStore.authHeader()
        }
    });
    const data = await readJsonResponse(response, "Không thể tạo AI review cho sản phẩm này.");
    const normalized = normalizeAiReviewPayload(safeProductId, data || {}, productContext);
    normalized.useCase = normalizeAiUseCaseId(normalized.useCase || useCaseId, productContext);
    aiReviewCacheByProductId.set(cacheKey, normalized);
    return normalized;
}

function buildAiAnalysisReportHtml(aiReview, useCaseId) {
    const resolvedUseCase = normalizeAiUseCaseId(useCaseId || aiReview.useCase, currentProduct);
    const useCaseLabel = getAiUseCaseLabel(resolvedUseCase, currentProduct);
    const productName = sanitizeAiReviewText(
        aiReview.productName || (currentProduct && currentProduct.name ? currentProduct.name : ""),
        "Sản phẩm",
        260
    );

    return `
        <div class="product-ai-analysis-report">
            <div class="product-ai-analysis-head">
                <div class="product-ai-analysis-head-text">
                    <h3>Kết Quả Phân Tích AI</h3>
                    <p>${escapeHtml(productName)} - Mục đích: ${escapeHtml(useCaseLabel)}</p>
                </div>
            </div>
            <div class="product-ai-analysis-body">
                <section class="product-ai-analysis-block">
                    <h4>🎯 Tổng quan & Điểm số (1-10)</h4>
                    <p class="product-ai-analysis-score">
                        Điểm tổng thể cho mục đích ${escapeHtml(useCaseLabel)}:
                        <strong>${Number(aiReview.score || 5)}/10</strong>
                    </p>
                    <p><strong>Lý do chấm điểm:</strong> ${escapeHtml(aiReview.scoreReason)}</p>
                    <p>${escapeHtml(aiReview.summary)}</p>
                </section>

                <section class="product-ai-analysis-block">
                    <h4>✅ Điểm mạnh</h4>
                    ${aiReview.strengths.map((item) => `
                        <p class="product-ai-analysis-positive">${escapeHtml(item)}</p>
                    `).join("")}
                </section>

                <section class="product-ai-analysis-block">
                    <h4>❌ Điểm yếu & Hạn chế</h4>
                    ${aiReview.weaknesses.map((item) => `
                        <p class="product-ai-analysis-negative">${escapeHtml(item)}</p>
                    `).join("")}
                </section>

                <section class="product-ai-analysis-block">
                    <h4>🧩 Đánh giá chi tiết</h4>
                    <p>${escapeHtml(aiReview.detailedEvaluation)}</p>
                </section>

                <section class="product-ai-analysis-block">
                    <h4>⚡ Hiệu năng dự đoán</h4>
                    <ul class="product-ai-analysis-list">
                        ${aiReview.predictedPerformance.map((item) => `
                            <li>${escapeHtml(item)}</li>
                        `).join("")}
                    </ul>
                </section>

                <section class="product-ai-analysis-block">
                    <h4>💰 Giá trị & So sánh</h4>
                    <p>${escapeHtml(aiReview.valueAndComparison)}</p>
                </section>

                <section class="product-ai-analysis-block">
                    <h4>📌 Kết luận & Khuyến nghị</h4>
                    <p>${escapeHtml(aiReview.conclusion)}</p>
                    <p><strong>Khuyến nghị:</strong> ${escapeHtml(aiReview.recommendation)}</p>
                </section>
            </div>
        </div>
    `;
}

function renderAiReviewSectionContent(aiReview, useCaseId, autoOpenModal = false) {
    const holder = document.getElementById("product-ai-review-section");
    if (!holder || !aiReview) {
        return;
    }

    const resolvedUseCase = normalizeAiUseCaseId(useCaseId || aiReview.useCase, currentProduct);
    const reportHtml = buildAiAnalysisReportHtml(aiReview, resolvedUseCase);
    const modalBody = document.getElementById("product-ai-result-body");
    if (modalBody) {
        modalBody.innerHTML = reportHtml;
    }

    holder.innerHTML = `
        <div class="product-ai-review-compact">
            <div class="product-ai-review-actions">
                <button type="button" class="btn btn-primary btn-sm" id="btn-open-ai-result-modal">Xem báo cáo chi tiết</button>
                <button type="button" class="btn btn-outline btn-sm" id="btn-ai-review-retry">Phân tích lại</button>
            </div>
        </div>
    `;

    const openResultBtn = document.getElementById("btn-open-ai-result-modal");
    if (openResultBtn) {
        openResultBtn.addEventListener("click", () => openAiResultModal());
    }
    const retryBtn = document.getElementById("btn-ai-review-retry");
    if (retryBtn) {
        retryBtn.addEventListener("click", async () => {
            await renderAiReviewSection(aiReview.productId, {
                force: true,
                useCase: resolvedUseCase,
                autoOpen: true
            });
        });
    }

    if (autoOpenModal) {
        openAiResultModal();
    }
}

function renderAiReviewSectionLoading(useCaseId) {
    const holder = document.getElementById("product-ai-review-section");
    if (!holder) {
        return;
    }

    const useCaseLabel = getAiUseCaseLabel(useCaseId, currentProduct);
    const loadingHint = getAiLoadingHint(currentProduct, useCaseId);

    holder.innerHTML = `
        <div class="product-ai-analysis-report">
            <div class="product-ai-analysis-head">
                <div class="product-ai-analysis-head-text">
                    <h3>Kết Quả Phân Tích AI</h3>
                    <p>Mục đích: ${escapeHtml(useCaseLabel)}</p>
                </div>
            </div>
            <div class="product-ai-analysis-body">
                <section class="product-ai-analysis-block">
                    <h4>🎯 Tổng quan & Điểm số (1-10)</h4>
                    <p class="product-ai-review-summary muted">${escapeHtml(loadingHint)}</p>
                </section>
            </div>
        </div>
    `;
}

function renderAiReviewSectionError(productId, message, useCaseId) {
    const holder = document.getElementById("product-ai-review-section");
    if (!holder) {
        return;
    }

    const useCaseLabel = getAiUseCaseLabel(useCaseId, currentProduct);

    holder.innerHTML = `
        <div class="product-ai-analysis-report">
            <div class="product-ai-analysis-head">
                <div class="product-ai-analysis-head-text">
                    <h3>Kết Quả Phân Tích AI</h3>
                    <p>Mục đích: ${escapeHtml(useCaseLabel)}</p>
                </div>
            </div>
            <div class="product-ai-analysis-body">
                <section class="product-ai-analysis-block">
                    <p class="product-ai-review-summary muted">${escapeHtml(message || "Không thể tạo AI review lúc này.")}</p>
                    <div class="product-ai-review-actions">
                        <button type="button" class="btn btn-outline btn-sm" id="btn-ai-review-retry">Thử lại</button>
                    </div>
                </section>
            </div>
        </div>
    `;

    const retryBtn = document.getElementById("btn-ai-review-retry");
    if (retryBtn) {
        retryBtn.addEventListener("click", async () => {
            await renderAiReviewSection(productId, {
                force: true,
                useCase: useCaseId,
                autoOpen: true
            });
        });
    }
}

async function renderAiReviewSection(productId, options = {}) {
    const holder = document.getElementById("product-ai-review-section");
    if (!holder) {
        return;
    }

    const safeProductId = Number(productId || 0);
    const productContext = options.product || currentProduct;
    const hasExplicitUseCase = Object.prototype.hasOwnProperty.call(options, "useCase");
    const resolvedUseCase = hasExplicitUseCase
        ? normalizeAiUseCaseId(options.useCase, productContext)
        : getSelectedAiUseCase(safeProductId, productContext);

    setSelectedAiUseCase(safeProductId, resolvedUseCase, productContext);

    closeAiResultModal();
    renderAiReviewSectionLoading(resolvedUseCase);
    openAiLoadingModal(`AI đang phân tích cho mục đích ${getAiUseCaseLabel(resolvedUseCase, productContext).toLowerCase()}...`);
    try {
        const aiReview = await fetchAiReview(safeProductId, {
            force: !!options.force,
            useCase: resolvedUseCase,
            product: productContext
        });
        renderAiReviewSectionContent(aiReview, resolvedUseCase, !!options.autoOpen);
    } catch (err) {
        renderAiReviewSectionError(
            safeProductId,
            err && err.message ? err.message : "Không thể tạo AI review lúc này.",
            resolvedUseCase
        );
    } finally {
        closeAiLoadingModal();
    }
}

function renderStars(rating) {
    const safe = Math.max(0, Math.min(5, Math.round(Number(rating || 0))));
    return `${"★".repeat(safe)}${"☆".repeat(5 - safe)}`;
}

function renderSkeleton() {
    const holder = document.getElementById("product-view");
    if (!holder) {
        return;
    }

    holder.innerHTML = `
        <div class="product-grid-2">
            <div class="product-gallery">
                <div class="skeleton skeleton-thumb"></div>
            </div>
            <div class="product-info">
                <div class="skeleton skeleton-line" style="height: 28px; width: 78%;"></div>
                <div class="skeleton skeleton-line" style="height: 16px; width: 56%; margin-top: 10px;"></div>
                <div class="skeleton skeleton-line" style="height: 34px; width: 42%; margin-top: 14px;"></div>
                <div class="skeleton skeleton-line" style="height: 18px; width: 88%; margin-top: 18px;"></div>
                <div class="skeleton skeleton-line" style="height: 18px; width: 82%; margin-top: 10px;"></div>
                <div class="skeleton skeleton-line" style="height: 18px; width: 76%; margin-top: 10px;"></div>
                <div style="display:flex; gap:10px; margin-top: 18px; flex-wrap: wrap;">
                    <div class="skeleton skeleton-line" style="height: 44px; width: 180px;"></div>
                    <div class="skeleton skeleton-line" style="height: 44px; width: 180px;"></div>
                </div>
            </div>
        </div>
    `;
}

function renderProduct(product, options = {}) {
    const holder = document.getElementById("product-view");
    if (!holder) {
        return;
    }

    currentProduct = product;
    currentVariants = Array.isArray(options.variants) ? options.variants.map(normalizeVariant) : [];
    const reviewSummary = options.reviewSummary || emptyReviewSummary(product.id);
    const reviews = Array.isArray(options.reviews) ? options.reviews : [];

    const variantState = resolveVariantState(product, currentVariants, currentActiveVariantId);
    currentActiveVariantId = variantState.variant ? variantState.variant.id : null;

    const images = getGalleryImages(product);
    const categoryName = product.category ? product.category.name : "Chưa phân loại";
    const stock = Number(variantState.stock || product.stock || 0);
    const inStock = stock > 0;
    const stockLabel = inStock ? `Còn ${stock}` : "Hết hàng";
    const salesCommitments = [
        "✔ Bảo hành chính hãng 24 tháng.",
        "✔ Hỗ trợ đổi mới trong 7 ngày.",
        "✔ Miễn phí giao hàng toàn quốc."
    ];
    const shortDescription = getShortProductDescription(product);
    const detailSpecs = parseDetailSpecs(product);
    const techPreviewRows = detailSpecs.slice(0, 3);

    const titleEl = document.getElementById("product-title");
    if (titleEl) {
        titleEl.textContent = product.name || "Sản phẩm";
    }
    const subtitleEl = document.getElementById("product-subtitle");
    if (subtitleEl) {
        subtitleEl.textContent = categoryName;
    }

    holder.innerHTML = `
        <div class="product-grid-2">
            <div class="product-gallery">
                <div class="product-gallery-main">
                    <button class="product-main-image-btn" type="button" id="btn-open-image-modal" aria-label="Phóng to ảnh sản phẩm">
                        <img class="product-hero-img" id="product-main-image" src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}">
                    </button>
                </div>

                <div class="product-thumbs" id="product-thumbs" aria-label="Danh sách ảnh sản phẩm">
                    ${images.map((imageUrl, index) => `
                        <button class="product-thumb-btn ${index === 0 ? "active" : ""}" type="button" data-thumb-index="${index}" aria-label="Xem ảnh ${index + 1}">
                            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)} ảnh ${index + 1}">
                        </button>
                    `).join("")}
                </div>
            </div>

            <div class="product-info">
                <div class="product-info-top">
                    <div class="stock-pill ${inStock ? "in" : "out"}" id="product-stock-pill">${escapeHtml(stockLabel)}</div>
                    <div class="product-category">${escapeHtml(categoryName)}</div>
                </div>

                <h2 class="product-name">${escapeHtml(product.name || "Sản phẩm")}</h2>
                <div class="product-price-lg" id="product-price-lg">${TechStore.formatVnd(variantState.price)}</div>
                <div class="product-price-sub" id="product-price-sub">
                    ${variantState.hasDiscount
            ? `<span class="price-old-text">${TechStore.formatVnd(variantState.originalPrice)}</span>
                           <span class="price-discount-badge">-${Math.round(variantState.discountPercent || 0)}%</span>`
            : ""}
                </div>

                ${variantState.hasVariants ? `
                    <div class="product-variant-box">
                        <h3>Biến thể</h3>
                        <div class="product-variant-list" id="product-variant-list">
                            ${currentVariants.map((variant) => `
                                <button class="variant-chip ${Number(variant.id) === Number(currentActiveVariantId) ? "active" : ""}" type="button" data-variant-id="${variant.id}">
                                    <span class="variant-name">${escapeHtml(variant.name)}</span>
                                    <span class="variant-meta">${TechStore.formatVnd(TechStore.calculateDiscountedPrice(variant.price || 0, variantState.discountPercent || 0))} · ${variant.stock > 0 ? `Còn ${variant.stock}` : "Hết"}</span>
                                </button>
                            `).join("")}
                        </div>
                        <p class="muted variant-note" id="variant-note">${variantState.variant ? `Đang chọn: ${escapeHtml(variantState.variant.name)}` : ""}</p>
                    </div>
                ` : ""}

                <div class="product-quick-specs">
                    ${salesCommitments.map((line) => `<span class="spec-chip">${escapeHtml(line)}</span>`).join("")}
                </div>

                <div class="product-qty-row">
                    <span class="product-qty-label">Số lượng</span>
                    <div class="product-qty-control" aria-label="Chọn số lượng mua">
                        <button class="product-qty-btn" type="button" id="btn-qty-decrease" aria-label="Giảm số lượng">−</button>
                        <input class="product-qty-input" id="product-qty-input" type="number" min="1" value="1" inputmode="numeric" aria-label="Số lượng">
                        <button class="product-qty-btn" type="button" id="btn-qty-increase" aria-label="Tăng số lượng">+</button>
                    </div>
                    <span class="product-qty-hint muted" id="product-qty-hint">Tối đa ${stock > 0 ? stock : 1}</span>
                </div>

                <div class="product-actions-2">
                    <button class="btn btn-cart" type="button" id="btn-add" ${inStock ? "" : "disabled"}>
                        ${actionIcon("add")}Thêm vào giỏ
                    </button>
                    <button class="btn btn-buy" type="button" id="btn-buy" ${inStock ? "" : "disabled"}>
                        ${actionIcon("buy")}Mua ngay
                    </button>
                    <button class="btn btn-outline btn-ai-review-trigger" type="button" id="btn-open-ai-usecase-modal">
                        ${actionIcon("ai")}AI Review
                    </button>
                </div>

                <div class="product-desc">
                    <h3>Mô tả</h3>
                    <p class="muted">${escapeHtml(shortDescription)}</p>
                </div>

                <div class="product-tech-box">
                    <h3>Thông số kỹ thuật</h3>
                    <div class="product-tech-table-wrap product-tech-preview">
                        <table class="product-tech-table" aria-label="Thông số kỹ thuật tóm tắt">
                            <tbody>
                                ${techPreviewRows.map((row) => `
                                    <tr>
                                        <th title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</th>
                                        <td title="${escapeHtml(row.value)}">${escapeHtml(row.value)}</td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </div>
                    <div class="product-tech-more">
                        <button class="btn btn-outline btn-sm" type="button" id="btn-open-spec-modal">Xem chi tiết thông số</button>
                    </div>
                </div>

            </div>
        </div>

        <div class="product-spec-modal" id="product-spec-modal" hidden aria-hidden="true">
            <div class="product-spec-overlay" data-close="1"></div>
            <div class="product-spec-dialog" role="dialog" aria-modal="true" aria-labelledby="product-spec-modal-title">
                <div class="product-spec-dialog-head">
                    <h3 id="product-spec-modal-title">Thông số kỹ thuật</h3>
                    <button class="product-spec-close" type="button" data-close="1" aria-label="Đóng">×</button>
                </div>
                <div class="product-spec-dialog-body">
                    <div class="product-spec-banner">THÔNG SỐ KỸ THUẬT</div>
                    <table class="product-spec-full-table" aria-label="Thông số kỹ thuật đầy đủ">
                        <tbody>
                            ${detailSpecs.map((row) => `
                                <tr>
                                    <th>${escapeHtml(row.label)}</th>
                                    <td>${escapeHtml(row.value)}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="product-image-modal" id="product-image-modal" hidden aria-hidden="true">
            <div class="product-image-overlay" data-image-close="1"></div>
            <div class="product-image-dialog" role="dialog" aria-modal="true" aria-labelledby="product-image-modal-title">
                <div class="product-image-dialog-head">
                    <h3 id="product-image-modal-title">Ảnh sản phẩm</h3>
                    <button class="product-image-close" type="button" data-image-close="1" aria-label="Đóng">×</button>
                </div>
                <div class="product-image-dialog-body">
                    <img id="product-image-modal-img" src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}">
                </div>
            </div>
        </div>

        <section class="product-ai-review-section" id="product-ai-review-section"></section>

        <div class="product-ai-usecase-modal" id="ai-review-usecase-modal" hidden aria-hidden="true">
            <div class="product-ai-usecase-overlay" data-ai-usecase-close="1"></div>
            <div class="product-ai-usecase-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-review-usecase-title">
                <div class="product-ai-usecase-head">
                    <h3 id="ai-review-usecase-title">AI Review Sản Phẩm</h3>
                    <button class="product-ai-usecase-close" type="button" data-ai-usecase-close="1" aria-label="Đóng">×</button>
                </div>
                <div class="product-ai-usecase-body">
                    <h4>${escapeHtml(getAiUseCasePrompt(product))}</h4>
                    <div class="ai-usecase-grid" id="ai-usecase-grid">
                        ${renderAiUseCaseOptions(getSelectedAiUseCase(product.id, product), product)}
                    </div>
                </div>
                <div class="product-ai-usecase-foot">
                    <button class="btn btn-outline btn-sm" type="button" data-ai-usecase-close="1">Hủy bỏ</button>
                    <button class="btn btn-primary btn-sm" type="button" id="btn-ai-usecase-apply" disabled>Bắt đầu phân tích AI</button>
                </div>
            </div>
        </div>

        <div class="product-ai-result-modal" id="product-ai-result-modal" hidden aria-hidden="true">
            <div class="product-ai-result-overlay" data-ai-result-close="1"></div>
            <div class="product-ai-result-dialog" role="dialog" aria-modal="true" aria-labelledby="product-ai-result-title">
                <button class="product-ai-result-close" type="button" data-ai-result-close="1" aria-label="Đóng">×</button>
                <div id="product-ai-result-body" class="product-ai-result-body">
                    <div class="product-ai-analysis-report">
                        <div class="product-ai-analysis-head">
                            <div class="product-ai-analysis-head-text">
                                <h3 id="product-ai-result-title">Kết Quả Phân Tích AI</h3>
                                <p>Đang chuẩn bị dữ liệu...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="product-ai-loading-modal" id="product-ai-loading-modal" hidden aria-hidden="true">
            <div class="product-ai-loading-overlay"></div>
            <div class="product-ai-loading-dialog" role="status" aria-live="polite" aria-busy="true">
                <span class="product-ai-loading-spinner" aria-hidden="true"></span>
                <p id="product-ai-loading-text">AI đang phân tích cấu hình sản phẩm...</p>
            </div>
        </div>

        <section class="product-review-section" id="product-reviews-section"></section>
    `;

    const thumbs = document.getElementById("product-thumbs");
    const mainImage = document.getElementById("product-main-image");
    const openImageModalBtn = document.getElementById("btn-open-image-modal");
    const imageModal = document.getElementById("product-image-modal");
    const imageModalImg = document.getElementById("product-image-modal-img");
    const qtyInput = document.getElementById("product-qty-input");
    const qtyHint = document.getElementById("product-qty-hint");
    const qtyDecreaseBtn = document.getElementById("btn-qty-decrease");
    const qtyIncreaseBtn = document.getElementById("btn-qty-increase");
    const aiUseCaseModal = document.getElementById("ai-review-usecase-modal");
    const aiUseCaseGrid = document.getElementById("ai-usecase-grid");
    const aiUseCaseApplyBtn = document.getElementById("btn-ai-usecase-apply");
    const openAiUseCaseBtn = document.getElementById("btn-open-ai-usecase-modal");
    const aiResultModal = document.getElementById("product-ai-result-modal");
    let pendingAiUseCase = getSelectedAiUseCase(product.id, product);

    const syncBodyScrollLock = () => {
        syncProductModalBodyLock();
    };

    const openImageModal = () => {
        if (!imageModal || !mainImage || !imageModalImg) {
            return;
        }
        imageModalImg.src = mainImage.src;
        imageModalImg.alt = mainImage.alt || "Ảnh sản phẩm";
        imageModal.hidden = false;
        imageModal.setAttribute("aria-hidden", "false");
        syncBodyScrollLock();
    };

    const closeImageModal = () => {
        if (!imageModal) {
            return;
        }
        imageModal.hidden = true;
        imageModal.setAttribute("aria-hidden", "true");
        syncBodyScrollLock();
    };

    const syncAiUseCaseChoiceUI = () => {
        if (aiUseCaseGrid) {
            aiUseCaseGrid.querySelectorAll(".ai-usecase-option").forEach((item) => {
                const normalizedOption = normalizeAiUseCaseId(item.getAttribute("data-ai-usecase"), product);
                const isActive = normalizedOption === pendingAiUseCase;
                item.classList.toggle("active", isActive);
                item.setAttribute("aria-pressed", isActive ? "true" : "false");
            });
        }
        if (aiUseCaseApplyBtn) {
            aiUseCaseApplyBtn.disabled = !pendingAiUseCase;
        }
    };

    const openAiUseCaseModal = () => {
        if (!aiUseCaseModal) {
            return;
        }
        pendingAiUseCase = getSelectedAiUseCase(product.id, product);
        syncAiUseCaseChoiceUI();
        aiUseCaseModal.hidden = false;
        aiUseCaseModal.setAttribute("aria-hidden", "false");
        syncBodyScrollLock();
    };

    const closeAiUseCaseModal = () => {
        if (!aiUseCaseModal) {
            return;
        }
        aiUseCaseModal.hidden = true;
        aiUseCaseModal.setAttribute("aria-hidden", "true");
        syncBodyScrollLock();
    };

    if (thumbs && mainImage) {
        thumbs.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-thumb-index]");
            if (!button) {
                return;
            }

            const index = Number(button.getAttribute("data-thumb-index") || 0);
            const nextImage = images[index] || images[0];
            mainImage.src = nextImage;
            mainImage.alt = `${product.name} ảnh ${index + 1}`;
            if (imageModalImg) {
                imageModalImg.src = nextImage;
                imageModalImg.alt = `${product.name} ảnh ${index + 1}`;
            }

            thumbs.querySelectorAll(".product-thumb-btn").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
        });
    }

    if (openImageModalBtn) {
        openImageModalBtn.addEventListener("click", openImageModal);
    }
    if (imageModal) {
        imageModal.addEventListener("click", (event) => {
            const target = event.target;
            if (target && target.getAttribute("data-image-close") === "1") {
                closeImageModal();
            }
        });
    }
    if (openAiUseCaseBtn) {
        openAiUseCaseBtn.addEventListener("click", openAiUseCaseModal);
    }
    if (aiUseCaseGrid) {
        aiUseCaseGrid.addEventListener("click", (event) => {
            const option = event.target.closest("button[data-ai-usecase]");
            if (!option) {
                return;
            }
            pendingAiUseCase = normalizeAiUseCaseId(option.getAttribute("data-ai-usecase"), product);
            syncAiUseCaseChoiceUI();
        });
    }
    if (aiUseCaseApplyBtn) {
        aiUseCaseApplyBtn.addEventListener("click", async () => {
            if (!pendingAiUseCase) {
                return;
            }
            setSelectedAiUseCase(product.id, pendingAiUseCase, product);
            closeAiUseCaseModal();
            await renderAiReviewSection(product.id, {
                force: true,
                useCase: pendingAiUseCase,
                product,
                autoOpen: true
            });
        });
    }
    if (aiUseCaseModal) {
        aiUseCaseModal.addEventListener("click", (event) => {
            const target = event.target;
            if (target && target.getAttribute("data-ai-usecase-close") === "1") {
                closeAiUseCaseModal();
            }
        });
    }
    if (aiResultModal) {
        aiResultModal.addEventListener("click", (event) => {
            const target = event.target;
            if (target && target.getAttribute("data-ai-result-close") === "1") {
                closeAiResultModal();
            }
        });
    }
    syncAiUseCaseChoiceUI();

    const updateQuantityUI = (availableStock) => {
        if (!qtyInput) {
            return 1;
        }

        const quantity = normalizeQuantity(qtyInput.value, availableStock);
        const inStockNow = Number(availableStock || 0) > 0;
        qtyInput.value = String(quantity);
        qtyInput.max = String(inStockNow ? availableStock : 1);
        qtyInput.disabled = !inStockNow;

        if (qtyHint) {
            qtyHint.textContent = inStockNow ? `Tối đa ${availableStock}` : "Hết hàng";
        }
        if (qtyDecreaseBtn) {
            qtyDecreaseBtn.disabled = !inStockNow || quantity <= 1;
        }
        if (qtyIncreaseBtn) {
            qtyIncreaseBtn.disabled = !inStockNow || quantity >= Number(availableStock || 1);
        }
        return quantity;
    };

    const readSelectedQuantity = (availableStock) => {
        if (!qtyInput) {
            return 1;
        }
        const quantity = normalizeQuantity(qtyInput.value, availableStock);
        qtyInput.value = String(quantity);
        return quantity;
    };

    const updateVariantStateUI = () => {
        const next = resolveVariantState(currentProduct, currentVariants, currentActiveVariantId);
        const priceEl = document.getElementById("product-price-lg");
        const priceSubEl = document.getElementById("product-price-sub");
        const stockEl = document.getElementById("product-stock-pill");
        const noteEl = document.getElementById("variant-note");
        const addBtn = document.getElementById("btn-add");
        const buyBtn = document.getElementById("btn-buy");

        if (priceEl) {
            priceEl.textContent = TechStore.formatVnd(next.price);
        }
        if (priceSubEl) {
            priceSubEl.innerHTML = next.hasDiscount
                ? `<span class="price-old-text">${TechStore.formatVnd(next.originalPrice)}</span>
                   <span class="price-discount-badge">-${Math.round(next.discountPercent || 0)}%</span>`
                : "";
        }

        if (stockEl) {
            stockEl.textContent = next.stock > 0 ? `Còn ${next.stock}` : "Hết hàng";
            stockEl.classList.remove("in", "out");
            stockEl.classList.add(next.stock > 0 ? "in" : "out");
        }

        if (noteEl && next.variant) {
            noteEl.textContent = `Đang chọn: ${next.variant.name}`;
        }

        if (addBtn) {
            addBtn.disabled = next.stock <= 0;
        }
        if (buyBtn) {
            buyBtn.disabled = next.stock <= 0;
        }

        updateQuantityUI(next.stock);
    };

    const variantListEl = document.getElementById("product-variant-list");
    if (variantListEl) {
        variantListEl.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-variant-id]");
            if (!button) {
                return;
            }

            const variantId = Number(button.getAttribute("data-variant-id") || 0);
            if (!variantId) {
                return;
            }

            currentActiveVariantId = variantId;
            variantListEl.querySelectorAll(".variant-chip").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
            updateVariantStateUI();
        });
    }

    if (qtyDecreaseBtn) {
        qtyDecreaseBtn.addEventListener("click", () => {
            const selected = resolveVariantState(currentProduct, currentVariants, currentActiveVariantId);
            const nextQty = normalizeQuantity(Number(qtyInput ? qtyInput.value : 1) - 1, selected.stock);
            if (qtyInput) {
                qtyInput.value = String(nextQty);
            }
            updateQuantityUI(selected.stock);
        });
    }
    if (qtyIncreaseBtn) {
        qtyIncreaseBtn.addEventListener("click", () => {
            const selected = resolveVariantState(currentProduct, currentVariants, currentActiveVariantId);
            const nextQty = normalizeQuantity(Number(qtyInput ? qtyInput.value : 1) + 1, selected.stock);
            if (qtyInput) {
                qtyInput.value = String(nextQty);
            }
            updateQuantityUI(selected.stock);
        });
    }
    if (qtyInput) {
        const syncQtyInput = () => {
            const selected = resolveVariantState(currentProduct, currentVariants, currentActiveVariantId);
            updateQuantityUI(selected.stock);
        };
        qtyInput.addEventListener("input", syncQtyInput);
        qtyInput.addEventListener("change", syncQtyInput);
    }

    const addBtn = document.getElementById("btn-add");
    if (addBtn) {
        addBtn.addEventListener("click", async () => {
            if (!TechStore.ensureLoggedIn()) {
                return;
            }

            try {
                const selected = resolveVariantState(currentProduct, currentVariants, currentActiveVariantId);
                const quantity = readSelectedQuantity(selected.stock);
                const selectedName = selected.variant
                    ? `${currentProduct.name} (${selected.variant.name})`
                    : currentProduct.name;
                await TechStore.addToCart({
                    productId: currentProduct.id,
                    variantId: selected.variant ? selected.variant.id : null,
                    productName: selectedName,
                    price: selected.price
                }, quantity);
            } catch (err) {
                alert(err.message || "Không thể thêm vào giỏ hàng");
            }
        });
    }

    const buyBtn = document.getElementById("btn-buy");
    if (buyBtn) {
        buyBtn.addEventListener("click", () => {
            if (!TechStore.ensureLoggedIn()) {
                return;
            }
            const selected = resolveVariantState(currentProduct, currentVariants, currentActiveVariantId);
            const quantity = readSelectedQuantity(selected.stock);
            const params = new URLSearchParams({
                productId: String(currentProduct.id),
                quantity: String(quantity)
            });
            if (selected.variant && selected.variant.id) {
                params.set("variantId", String(selected.variant.id));
            }
            window.location.href = `/checkout?${params.toString()}`;
        });
    }

    const modal = document.getElementById("product-spec-modal");
    const openModalBtn = document.getElementById("btn-open-spec-modal");
    const openSpecModal = () => {
        if (!modal) {
            return;
        }
        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
        syncBodyScrollLock();
    };
    const closeSpecModal = () => {
        if (!modal) {
            return;
        }
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
        syncBodyScrollLock();
    };

    if (openModalBtn) {
        openModalBtn.addEventListener("click", openSpecModal);
    }
    if (modal) {
        modal.addEventListener("click", (event) => {
            const target = event.target;
            if (target && target.getAttribute("data-close") === "1") {
                closeSpecModal();
            }
        });
    }

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") {
            return;
        }
        if (modal && !modal.hidden) {
            closeSpecModal();
        }
        if (imageModal && !imageModal.hidden) {
            closeImageModal();
        }
        if (aiUseCaseModal && !aiUseCaseModal.hidden) {
            closeAiUseCaseModal();
        }
        if (aiResultModal && !aiResultModal.hidden) {
            closeAiResultModal();
        }
    });

    renderReviewSection(product.id, reviewSummary, reviews);
    bindReviewActions(product.id);
    updateVariantStateUI();
}

function setReviewMessage(text, type) {
    const el = document.getElementById("review-message");
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

function renderReviewSection(productId, summary, reviews) {
    const holder = document.getElementById("product-reviews-section");
    if (!holder) {
        return;
    }

    const safeSummary = summary || emptyReviewSummary(productId);
    const list = Array.isArray(reviews) ? reviews : [];
    const total = Number(safeSummary.totalReviews || 0);
    const average = Number(safeSummary.averageRating || 0);
    const myReview = list.find((item) => item && item.mine) || null;

    const bars = [
        { star: 5, count: Number(safeSummary.fiveStar || 0) },
        { star: 4, count: Number(safeSummary.fourStar || 0) },
        { star: 3, count: Number(safeSummary.threeStar || 0) },
        { star: 2, count: Number(safeSummary.twoStar || 0) },
        { star: 1, count: Number(safeSummary.oneStar || 0) }
    ];

    const isLoggedIn = !!TechStore.getToken();
    const canReview = !!safeSummary.canReview;
    const reviewHint = (isLoggedIn && !canReview && !myReview)
        ? "Bạn cần mua và nhận hàng thành công trước khi đánh giá."
        : "";

    holder.innerHTML = `
        <div class="product-review-summary">
            <div class="product-review-score">
                <strong>${average.toFixed(1)}</strong>
                <span class="stars">${renderStars(Math.round(average))}</span>
                <span class="muted">${total} đánh giá</span>
            </div>
            <div class="product-review-bars">
                ${bars.map((row) => {
                    const percent = total > 0 ? Math.round((row.count * 100) / total) : 0;
                    return `
                        <div class="review-bar-row">
                            <span class="label">${row.star}★</span>
                            <div class="bar"><span style="width:${percent}%"></span></div>
                            <span class="value">${row.count}</span>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>

        <div class="product-review-form-wrap">
            <h3>Đánh giá sản phẩm</h3>
            ${reviewHint ? `<p class="muted review-form-hint">${escapeHtml(reviewHint)}</p>` : ""}

            ${isLoggedIn && (canReview || myReview) ? `
                <form id="product-review-form" class="product-review-form">
                    <div class="review-form-grid">
                        <label for="review-rating">Số sao</label>
                        <select id="review-rating" class="select">
                            <option value="5" ${myReview && Number(myReview.rating) === 5 ? "selected" : ""}>5 sao</option>
                            <option value="4" ${myReview && Number(myReview.rating) === 4 ? "selected" : ""}>4 sao</option>
                            <option value="3" ${myReview && Number(myReview.rating) === 3 ? "selected" : ""}>3 sao</option>
                            <option value="2" ${myReview && Number(myReview.rating) === 2 ? "selected" : ""}>2 sao</option>
                            <option value="1" ${myReview && Number(myReview.rating) === 1 ? "selected" : ""}>1 sao</option>
                        </select>
                    </div>
                    <div class="review-form-grid">
                        <label for="review-content">Nội dung</label>
                        <textarea id="review-content" class="textarea" rows="4" maxlength="${REVIEW_MAX_CONTENT}" placeholder="Cảm nhận về chất lượng, đóng gói, giao hàng...">${escapeHtml(myReview && myReview.content ? myReview.content : "")}</textarea>
                    </div>
                    <div class="product-review-actions">
                        <button type="submit" class="btn btn-primary btn-sm review-submit-btn" id="review-submit-btn">${myReview ? "Cập nhật đánh giá" : "Gửi đánh giá"}</button>
                        ${myReview ? `<button type="button" class="btn btn-outline btn-sm review-delete-btn" id="review-delete-btn">Xóa đánh giá của tôi</button>` : ""}
                    </div>
                    <div id="review-message" class="message" style="display:none; margin-top:8px;"></div>
                </form>
            ` : `
                ${!isLoggedIn ? `<a class="btn btn-sm review-login-btn" href="/login">Đăng nhập để đánh giá</a>` : ""}
            `}
        </div>

        <div class="product-review-list">
            ${list.length ? list.map((review) => {
                const reviewerName = String(
                    (review && review.fullName)
                    || (review && review.username)
                    || "Khách hàng"
                ).trim() || "Khách hàng";

                return `
                    <article class="review-card">
                        <div class="review-head">
                            <div>
                                <strong>${escapeHtml(reviewerName)}</strong>
                                <div class="review-stars">${renderStars(review.rating)}</div>
                            </div>
                            <div class="muted">${escapeHtml(formatDateTime(review.createdAt))}</div>
                        </div>
                        <div class="review-content">${escapeHtml(review.content || "(Không có nhận xét)")}</div>
                    </article>
                `;
            }).join("") : `<div class="muted">Sản phẩm này chưa có đánh giá nào.</div>`}
        </div>
    `;
}

async function reloadReviewSection(productId) {
    const [summary, reviews] = await Promise.all([
        fetchReviewSummary(productId).catch(() => emptyReviewSummary(productId)),
        fetchReviews(productId).catch(() => [])
    ]);

    renderReviewSection(productId, summary, reviews);
    bindReviewActions(productId);
}

function bindReviewActions(productId) {
    const form = document.getElementById("product-review-form");
    if (form) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            setReviewMessage("", "");
            if (!TechStore.ensureLoggedIn()) {
                return;
            }

            const rating = Number(document.getElementById("review-rating")?.value || 0);
            const content = String(document.getElementById("review-content")?.value || "").trim();
            const hadReview = !!document.getElementById("review-delete-btn");
            if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
                setReviewMessage("Điểm đánh giá phải từ 1 đến 5.", "error");
                return;
            }
            if (content.length > REVIEW_MAX_CONTENT) {
                setReviewMessage(`Nội dung tối đa ${REVIEW_MAX_CONTENT} ký tự.`, "error");
                return;
            }

            const submitBtn = document.getElementById("review-submit-btn");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Đang gửi...";
            }

            try {
                const response = await fetch(`/api/customer/products/${encodeURIComponent(productId)}/reviews`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...TechStore.authHeader()
                    },
                    body: JSON.stringify({ rating, content: content || null })
                });
                await readJsonResponse(response, "Không thể gửi đánh giá");
                toast("Đã lưu đánh giá");
                await reloadReviewSection(productId);
            } catch (err) {
                setReviewMessage(err.message || "Không thể gửi đánh giá", "error");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = hadReview ? "Cập nhật đánh giá" : "Gửi đánh giá";
                }
            }
        });
    }

    const deleteBtn = document.getElementById("review-delete-btn");
    if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
            if (!TechStore.ensureLoggedIn()) {
                return;
            }
            if (!confirm("Xóa đánh giá của bạn?")) {
                return;
            }

            try {
                const response = await fetch(`/api/customer/products/${encodeURIComponent(productId)}/reviews/me`, {
                    method: "DELETE",
                    headers: {
                        ...TechStore.authHeader()
                    }
                });
                await readJsonResponse(response, "Không thể xóa đánh giá");
                toast("Đã xóa đánh giá");
                await reloadReviewSection(productId);
            } catch (err) {
                setReviewMessage(err.message || "Không thể xóa đánh giá", "error");
            }
        });
    }
}

function setupRelatedCarousel() {
    const track = document.getElementById("related-products");
    const prevBtn = document.getElementById("related-prev");
    const nextBtn = document.getElementById("related-next");
    if (!track || !prevBtn || !nextBtn) {
        return;
    }

    const calcStep = () => {
        const firstCard = track.querySelector(".related-product-card");
        if (!firstCard) {
            return Math.max(track.clientWidth * 0.9, 220);
        }
        const gap = 14;
        return firstCard.getBoundingClientRect().width + gap;
    };

    const updateNav = () => {
        const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
        const hasOverflow = maxScroll > 4;
        const canPrev = hasOverflow && track.scrollLeft > 4;
        const canNext = hasOverflow && track.scrollLeft < maxScroll - 4;

        prevBtn.disabled = !canPrev;
        nextBtn.disabled = !canNext;
        prevBtn.style.display = hasOverflow ? "inline-flex" : "none";
        nextBtn.style.display = hasOverflow ? "inline-flex" : "none";
    };

    prevBtn.onclick = () => {
        track.scrollBy({ left: -calcStep(), behavior: "smooth" });
    };
    nextBtn.onclick = () => {
        track.scrollBy({ left: calcStep(), behavior: "smooth" });
    };
    track.onscroll = updateNav;

    window.requestAnimationFrame(updateNav);
}

function renderRelated(products) {
    const grid = document.getElementById("related-products");
    if (!grid) {
        return;
    }

    grid.innerHTML = "";
    grid.scrollLeft = 0;

    products.forEach((p, index) => {
        const card = document.createElement("article");
        card.className = "product-card related-product-card";
        card.style.setProperty("--delay", `${Math.min(index, 10) * 55}ms`);

        const images = getGalleryImages(p);
        const thumb = images[0] || "https://placehold.co/600x400/f3f4f6/111827?text=TechParadise";
        const categoryName = p.category ? p.category.name : "Chưa phân loại";
        const stock = Number(p.stock || 0);
        const inStock = stock > 0;
        const quickSpecs = getQuickSpecs(p).slice(0, 2);
        const pricing = TechStore.resolveProductPricing(p);

        card.innerHTML = `
            <a class="product-link" href="/product/${p.id}">
                <img class="product-thumb" src="${thumb}" alt="${escapeHtml(p.name)}">
            </a>
            <div class="product-body">
                <a class="product-link" href="/product/${p.id}">
                    <h3 class="product-title">${escapeHtml(p.name)}</h3>
                </a>
                <div class="product-topline">
                    <div class="product-meta">${escapeHtml(categoryName)}</div>
                    <div class="stock-pill ${inStock ? "in" : "out"}">${inStock ? `Còn ${stock}` : "Hết hàng"}</div>
                </div>
                ${renderProductRating(p, "related-rating")}

                <div class="mini-specs">
                    ${quickSpecs.map((spec) => `<span class="mini-spec-chip">${escapeHtml(spec)}</span>`).join("")}
                </div>

                <div class="product-price">${TechStore.formatVnd(pricing.finalPrice)}</div>
                ${pricing.hasDiscount
            ? `<div class="product-price-sub"><span class="price-old-text">${TechStore.formatVnd(pricing.originalPrice)}</span><span class="price-discount-badge">-${Math.round(pricing.discountPercent)}%</span></div>`
            : ""}
                <div class="product-actions">
                    <button class="btn btn-cart" type="button" data-action="add" data-id="${p.id}" data-name="${encodeURIComponent(p.name)}" data-price="${pricing.finalPrice}" ${inStock ? "" : "disabled"}>
                        ${actionIcon("add")}Thêm vào giỏ
                    </button>
                    <button class="btn btn-buy" type="button" data-action="buy" data-id="${p.id}" ${inStock ? "" : "disabled"}>
                        ${actionIcon("buy")}Mua ngay
                    </button>
                </div>
            </div>
        `;

        card.addEventListener("click", async (event) => {
            const btn = event.target.closest("button[data-action]");
            if (!btn) {
                return;
            }
            event.preventDefault();

            const action = btn.getAttribute("data-action");
            const productId = Number(btn.getAttribute("data-id"));
            if (!productId) {
                return;
            }

            if (!TechStore.ensureLoggedIn()) {
                return;
            }

            if (action === "buy") {
                window.location.href = `/checkout?productId=${encodeURIComponent(productId)}`;
                return;
            }

            const rawName = btn.getAttribute("data-name") || "";
            const productName = rawName ? decodeURIComponent(rawName) : "Sản phẩm";
            const price = Number(btn.getAttribute("data-price")) || 0;

            try {
                await TechStore.addToCart({ productId, productName, price }, 1);
            } catch (err) {
                alert(err.message || "Không thể thêm vào giỏ hàng");
            }
        });

        grid.appendChild(card);
    });

    setupRelatedCarousel();
}

async function loadRelated(product) {
    const grid = document.getElementById("related-products");
    if (!grid) {
        return;
    }

    const currentCategoryId = product && product.category ? Number(product.category.id) : 0;
    const currentBrand = resolveProductBrand(product);
    if (!currentCategoryId || !currentBrand.key) {
        grid.innerHTML = `<div class="related-empty muted">Sản phẩm này chưa đủ thông tin danh mục hoặc thương hiệu.</div>`;
        setupRelatedCarousel();
        return;
    }

    const response = await fetch("/api/public/products");
    const list = response.ok ? await response.json() : [];
    const related = list
        .filter((p) => p.id !== product.id)
        .filter((p) => p && p.category && Number(p.category.id) === currentCategoryId)
        .filter((p) => resolveProductBrand(p).key === currentBrand.key)
        .slice(0, 10);

    const categoryName = product && product.category && product.category.name
        ? String(product.category.name)
        : "danh mục hiện tại";
    const brandLabel = currentBrand.label || "thương hiệu hiện tại";
    const emptyMessage = `Chưa có sản phẩm cùng danh mục ${escapeHtml(categoryName)} và thương hiệu ${escapeHtml(brandLabel)}.`;

    if (!related.length) {
        grid.innerHTML = `<div class="related-empty muted">${emptyMessage}</div>`;
        setupRelatedCarousel();
        return;
    }

    renderRelated(related);
}

window.addEventListener("DOMContentLoaded", async () => {
    TechStore.updateHeader();

    const id = getProductIdFromPath();
    if (!id) {
        window.location.href = "/";
        return;
    }

    renderSkeleton();

    try {
        const response = await fetch(`/api/public/products/${encodeURIComponent(id)}`);
        if (!response.ok) {
            throw new Error("Không tìm thấy sản phẩm");
        }

        const product = await response.json();
        const [variants, reviewSummary, reviews] = await Promise.all([
            fetchVariants(id).catch(() => []),
            fetchReviewSummary(id).catch(() => emptyReviewSummary(id)),
            fetchReviews(id).catch(() => [])
        ]);

        renderProduct(product, { variants, reviewSummary, reviews });
        await loadRelated(product);
    } catch (err) {
        const holder = document.getElementById("product-view");
        if (holder) {
            holder.innerHTML = `
                <section class="empty-state" style="display:block;">
                    <div class="empty-card">
                        <h2>Không tải được sản phẩm</h2>
                        <p class="muted">${escapeHtml(err.message)}</p>
                        <a class="btn btn-solid" href="/">Về trang chủ</a>
                    </div>
                </section>
            `;
        }
    }
});

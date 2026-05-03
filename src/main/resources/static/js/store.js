// store.js
// Trang chủ storefront:
// - Tải danh mục + sản phẩm
// - Lọc theo từ khóa / danh mục
// - Render khu "Phân loại nổi bật" dạng marketplace

let categories = [];
let selectedCategoryId = "";
let keyword = "";
let allProductsCache = [];
const marketZoneAutoTimers = new Map();
let homeBannerTimerId = null;
const DEFAULT_HOME_BANNERS = [
    {
        imageUrl: "https://cdn.hstatic.net/files/200000722513/file/banner_msi.1.jpg",
        targetUrl: "#market-zones-section",
        altText: "Banner MSI"
    },
    {
        imageUrl: "https://cdn.hstatic.net/files/200000722513/file/gigabyte.jpg",
        targetUrl: "#market-zones-section",
        altText: "Banner GIGABYTE"
    }
];
const KNOWN_MARKET_BRANDS = [
    "ASUS", "ACER", "MSI", "LENOVO", "GIGABYTE", "DELL", "HP", "LG",
    "APPLE", "SAMSUNG", "SONY", "XIAOMI", "HUAWEI", "OPPO", "VIVO",
    "REALME", "NOKIA", "HONOR", "RAZER", "LOGITECH", "CORSAIR",
    "HYPERX", "STEELSERIES", "AKKO", "LEOPOLD", "KEYCHRON", "JBL",
    "BOSE", "SENNHEISER", "ANKER", "UGREEN", "BASEUS", "KINGSTON",
    "SANDISK", "WD", "SEAGATE", "INTEL", "AMD", "NVIDIA", "ASROCK",
    "CANON", "NIKON", "FUJIFILM", "TOSHIBA", "PHILIPS", "BROTHER",
    "EPSON", "TP-LINK", "TOTOLINK", "MERCUSYS", "DAREU", "EDRA",
    "ZOWIE", "XPG"
];
const GENERIC_BRAND_TOKENS = new Set([
    "BAN", "TAI", "BO", "CONG", "CAP", "CU", "DAY", "LOA", "MAN",
    "CHUOT", "PHIM", "GHE", "GIA", "THE", "THIET", "BI", "PHU",
    "KIEN", "MAY", "TINH", "DIEN", "THOAI", "LAPTOP", "TABLET",
    "MICROPHONE", "CAMERA", "SAC", "PIN"
]);
const HIDDEN_CATEGORY_TOKENS = ["dien thoai", "smartphone"];
const GEARVN_CATEGORY_ORDER = [
    "laptop",
    "pc",
    "man hinh",
    "ban phim",
    "chuot",
    "tai nghe",
    "linh kien pc",
    "thiet bi mang",
    "phu kien"
];
const ACCESSORY_CATEGORY_TOKENS = ["phu kien", "accessory"];
const ACCESSORY_LAPTOP_TOKENS = [
    "laptop", "notebook", "ultrabook", "macbook", "vivobook", "zenbook",
    "thinkpad", "ideapad", "legion", "victus", "nitro", "inspiron",
    "aspire", "predator", "surface laptop", "rog ", "tuf "
];
const ACCESSORY_COMPONENT_TOKENS = [
    "linh kien", "mainboard", "motherboard", "card man hinh", "vga",
    "gpu", "cpu", "bo vi xu ly", "ram ", "ddr", "ssd", "hdd", "nvme",
    "pcie", "psu", "nguon may tinh", "tan nhiet", "fan case", "vo case"
];
const ACCESSORY_ALLOW_TOKENS = [
    "de laptop", "gia do laptop", "tui laptop", "bao laptop",
    "dock laptop", "hub laptop", "adapter laptop", "sac laptop"
];

function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function containsAnyToken(text, tokens) {
    if (!text || !Array.isArray(tokens) || tokens.length === 0) {
        return false;
    }
    return tokens.some((token) => text.includes(token));
}

function isAccessoryCategoryName(categoryName) {
    const key = normalizeText(categoryName);
    if (!key) {
        return false;
    }
    return ACCESSORY_CATEGORY_TOKENS.some((token) => key.includes(token));
}

function isAccessoryMismatchProduct(product) {
    if (!isAccessoryCategoryName(product?.category?.name)) {
        return false;
    }

    const text = normalizeText([
        product?.name,
        product?.description,
        product?.quickSpecs,
        product?.detailSpecs
    ].filter(Boolean).join(" "));

    if (containsAnyToken(text, ACCESSORY_ALLOW_TOKENS)) {
        return false;
    }

    const hasLaptopTokens = containsAnyToken(text, ACCESSORY_LAPTOP_TOKENS);
    const hasLaptopSpecs = Boolean(String(product?.cpu || "").trim())
        && Boolean(String(product?.screen || "").trim())
        && (Boolean(String(product?.ram || "").trim()) || Boolean(String(product?.gpu || "").trim()));
    if (hasLaptopTokens || hasLaptopSpecs) {
        return true;
    }

    return containsAnyToken(text, ACCESSORY_COMPONENT_TOKENS);
}

function shouldHideCategoryName(name) {
    const key = normalizeText(name);
    if (!key) {
        return false;
    }
    return HIDDEN_CATEGORY_TOKENS.some((token) => key.includes(token));
}

function resolveCategoryRank(name) {
    const key = normalizeText(name);
    const index = GEARVN_CATEGORY_ORDER.findIndex((token) => key.includes(token));
    return index >= 0 ? index : 999;
}

function resolveCategoryVisual(name) {
    const key = normalizeText(name);
    if (!key) {
        return { kind: "all", tone: "tone-all" };
    }
    if (key.includes("laptop") || key.includes("notebook")) {
        return { kind: "laptop", tone: "tone-laptop" };
    }
    if (key.includes("man hinh") || key.includes("monitor")) {
        return { kind: "monitor", tone: "tone-monitor" };
    }
    if (key.includes("ban phim")) {
        return { kind: "keyboard", tone: "tone-keyboard" };
    }
    if (key.includes("chuot")) {
        return { kind: "mouse", tone: "tone-mouse" };
    }
    if (key.includes("tai nghe") || key.includes("headphone")) {
        return { kind: "headphone", tone: "tone-headphone" };
    }
    if (key.includes("linh kien") || key.includes("pc")) {
        return { kind: "chip", tone: "tone-chip" };
    }
    if (key.includes("thiet bi mang") || key.includes("router") || key.includes("wifi")) {
        return { kind: "network", tone: "tone-network" };
    }
    if (key.includes("phu kien")) {
        return { kind: "plug", tone: "tone-accessory" };
    }
    return { kind: "all", tone: "tone-all" };
}

function renderCategoryIcon(kind) {
    switch (kind) {
        case "laptop":
            return `<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19h20"/></svg>`;
        case "monitor":
            return `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6"/><path d="M12 16v4"/></svg>`;
        case "keyboard":
            return `<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 11h.01M11 11h.01M15 11h.01M19 11h.01"/><path d="M6 14h12"/></svg>`;
        case "mouse":
            return `<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 7v3"/></svg>`;
        case "headphone":
            return `<svg viewBox="0 0 24 24"><path d="M4 13a8 8 0 0 1 16 0"/><rect x="4" y="13" width="4" height="7" rx="2"/><rect x="16" y="13" width="4" height="7" rx="2"/></svg>`;
        case "chip":
            return `<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>`;
        case "network":
            return `<svg viewBox="0 0 24 24"><path d="M3 9a15 15 0 0 1 18 0"/><path d="M6 13a10 10 0 0 1 12 0"/><path d="M9 17a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r="1"/></svg>`;
        case "plug":
            return `<svg viewBox="0 0 24 24"><path d="M9 3v5M15 3v5"/><path d="M7 8h10v3a5 5 0 0 1-5 5v5"/></svg>`;
        default:
            return `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>`;
    }
}

function parseMultiline(value) {
    return String(value || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
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
    return images;
}

function readQuery() {
    const params = new URLSearchParams(window.location.search);
    keyword = (params.get("keyword") || "").trim();
    selectedCategoryId = (params.get("categoryId") || "").trim();

    const searchInput = document.getElementById("search");
    if (searchInput) {
        searchInput.value = keyword;
    }
}

function syncQuery() {
    const params = new URLSearchParams();
    if (keyword) {
        params.set("keyword", keyword);
    }
    if (selectedCategoryId) {
        params.set("categoryId", selectedCategoryId);
    }

    const next = params.toString() ? `/?${params.toString()}` : "/";
    window.history.replaceState({}, "", next);
}

function stopHomeBannerAutoplay() {
    if (!homeBannerTimerId) {
        return;
    }
    window.clearInterval(homeBannerTimerId);
    homeBannerTimerId = null;
}

function normalizeHomeBanner(raw, index) {
    const imageUrl = String(raw && raw.imageUrl ? raw.imageUrl : "").trim();
    if (!imageUrl) {
        return null;
    }

    if (!(imageUrl.startsWith("http://")
            || imageUrl.startsWith("https://")
            || imageUrl.startsWith("/uploads/"))) {
        return null;
    }

    const targetUrl = String(raw && raw.targetUrl ? raw.targetUrl : "").trim() || "#market-zones-section";
    const altText = String(raw && raw.altText ? raw.altText : "").trim() || `Banner nổi bật ${index + 1}`;

    return {
        imageUrl,
        targetUrl,
        altText
    };
}

function renderHomeBannerSlides(slider, banners) {
    if (!slider) {
        return;
    }

    const hasRemoteData = Array.isArray(banners);
    const safeBanners = hasRemoteData
        ? banners
            .map((banner, index) => normalizeHomeBanner(banner, index))
            .filter(Boolean)
        : DEFAULT_HOME_BANNERS;
    const source = hasRemoteData ? safeBanners : DEFAULT_HOME_BANNERS;

    slider.innerHTML = `
        ${source.map((banner, index) => `
            <a class="home-banner-slide ${index === 0 ? "active" : ""}" href="${escapeHtml(banner.targetUrl)}" aria-label="${escapeHtml(banner.altText)}">
                <img src="${escapeHtml(banner.imageUrl)}" alt="${escapeHtml(banner.altText)}">
            </a>
        `).join("")}
        <button id="home-banner-prev" class="home-banner-nav prev" type="button" aria-label="Ảnh trước">&#8249;</button>
        <button id="home-banner-next" class="home-banner-nav next" type="button" aria-label="Ảnh sau">&#8250;</button>
    `;
}

async function fetchHomeBanners() {
    try {
        const response = await fetch("/api/public/banners/home");
        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            return null;
        }

        return data
            .map((banner, index) => normalizeHomeBanner(banner, index))
            .filter(Boolean);
    } catch (err) {
        return null;
    }
}

async function initHomeBannerSlider() {
    const slider = document.getElementById("home-banner-slider");
    if (!slider) {
        return;
    }

    const banners = await fetchHomeBanners();
    renderHomeBannerSlides(slider, banners);

    const slides = Array.from(slider.querySelectorAll(".home-banner-slide"));
    const prevBtn = document.getElementById("home-banner-prev");
    const nextBtn = document.getElementById("home-banner-next");
    if (!slides.length) {
        if (prevBtn) {
            prevBtn.hidden = true;
        }
        if (nextBtn) {
            nextBtn.hidden = true;
        }
        return;
    }

    let currentIndex = slides.findIndex((slide) => slide.classList.contains("active"));
    if (currentIndex < 0) {
        currentIndex = 0;
    }

    const setActiveSlide = (nextIndex) => {
        const normalized = ((Number(nextIndex) || 0) % slides.length + slides.length) % slides.length;
        slides.forEach((slide, index) => {
            slide.classList.toggle("active", index === normalized);
        });
        currentIndex = normalized;
    };

    const shiftSlide = (delta) => {
        setActiveSlide(currentIndex + delta);
    };

    const startAutoplay = () => {
        stopHomeBannerAutoplay();
        if (slides.length <= 1) {
            return;
        }

        homeBannerTimerId = window.setInterval(() => {
            if (document.hidden || slider.matches(":hover")) {
                return;
            }
            shiftSlide(1);
        }, 4600);
    };

    prevBtn?.addEventListener("click", () => {
        shiftSlide(-1);
        startAutoplay();
    });

    nextBtn?.addEventListener("click", () => {
        shiftSlide(1);
        startAutoplay();
    });

    slider.addEventListener("mouseenter", stopHomeBannerAutoplay);
    slider.addEventListener("mouseleave", startAutoplay);

    if (prevBtn) {
        prevBtn.hidden = slides.length <= 1;
    }
    if (nextBtn) {
        nextBtn.hidden = slides.length <= 1;
    }

    setActiveSlide(currentIndex);
    startAutoplay();
}

async function fetchCategories() {
    const response = await fetch("/api/public/categories");
    const raw = response.ok ? (await response.json()) : [];

    categories = raw
        .filter((category) => category && !shouldHideCategoryName(category.name))
        .sort((left, right) => {
            const rankDiff = resolveCategoryRank(left.name) - resolveCategoryRank(right.name);
            if (rankDiff !== 0) {
                return rankDiff;
            }
            return String(left.name || "").localeCompare(String(right.name || ""), "vi", { sensitivity: "base" });
        });

    if (selectedCategoryId && !categories.some((category) => String(category.id) === String(selectedCategoryId))) {
        selectedCategoryId = "";
        syncQuery();
    }
}

function renderCategoryList() {
    const list = document.getElementById("category-list");
    if (!list) {
        return;
    }

    const allActive = !selectedCategoryId ? "active" : "";
    list.innerHTML = `
        <li class="category-item">
            <a href="#" class="category-link ${allActive}" data-id="">
                <span class="category-link-start">
                    <span class="category-icon tone-all" aria-hidden="true">${renderCategoryIcon("all")}</span>
                    <span class="category-label">Tất cả sản phẩm</span>
                </span>
                <span class="category-arrow" aria-hidden="true">&#8250;</span>
            </a>
        </li>
        ${categories.map((c) => {
            const active = String(c.id) === String(selectedCategoryId) ? "active" : "";
            const visual = resolveCategoryVisual(c.name);
            const isAccessory = visual.tone === "tone-accessory";
            return `
                <li class="category-item ${isAccessory ? "is-accessory" : ""}">
                    <a href="#" class="category-link ${active}" data-id="${c.id}" data-tone="${visual.tone}">
                        <span class="category-link-start">
                            <span class="category-icon ${visual.tone}" aria-hidden="true">${renderCategoryIcon(visual.kind)}</span>
                            <span class="category-label">${escapeHtml(c.name)}</span>
                        </span>
                        <span class="category-arrow" aria-hidden="true">&#8250;</span>
                    </a>
                </li>
            `;
        }).join("")}
    `;

    // Dùng onclick trực tiếp để tránh gắn trùng listener sau mỗi lần render.
    list.onclick = (event) => {
        const link = event.target.closest(".category-link");
        if (!link) {
            return;
        }

        event.preventDefault();
        setCategory(link.getAttribute("data-id") || "");

        const catalog = document.getElementById("catalog");
        if (catalog) {
            catalog.classList.remove("show");
        }
    };
}

function setCategory(categoryId) {
    selectedCategoryId = categoryId || "";

    document.querySelectorAll(".category-link").forEach((link) => {
        const isActive = (link.getAttribute("data-id") || "") === selectedCategoryId;
        link.classList.toggle("active", isActive);
    });

    syncQuery();
    loadProducts();
}

function updateResultHint(count) {
    const hint = document.getElementById("market-result-hint");
    if (!hint) {
        return;
    }

    if (keyword && selectedCategoryId) {
        hint.textContent = `Tìm thấy ${count} sản phẩm theo từ khóa và danh mục đã chọn.`;
        return;
    }
    if (keyword) {
        hint.textContent = `Tìm thấy ${count} sản phẩm theo từ khóa "${keyword}".`;
        return;
    }
    if (selectedCategoryId) {
        const category = categories.find((c) => String(c.id) === String(selectedCategoryId));
        hint.textContent = `Hiển thị ${count} sản phẩm trong danh mục ${category ? category.name : "đã chọn"}.`;
        return;
    }

    hint.textContent = "Duyệt nhanh theo nhóm sản phẩm, thương hiệu và deal đang có.";
}

function buttonIcon(kind) {
    if (kind === "buy") {
        return `
            <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg>
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

function extractBrand(productName) {
    const normalizeBrandToken = (value) => String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();

    const upper = String(productName || "").trim().toUpperCase();
    if (!upper) {
        return "KHÁC";
    }

    for (const brand of KNOWN_MARKET_BRANDS) {
        if (upper.includes(brand)) {
            return brand;
        }
    }

    const fallback = upper
        .split(/[\s/-]+/)
        .map((token) => token.trim())
        .find((token) => {
            const normalized = normalizeBrandToken(token);
            if (!normalized || normalized.length < 2 || normalized.length > 14) {
                return false;
            }
            if (GENERIC_BRAND_TOKENS.has(normalized)) {
                return false;
            }
            if (/^\d+$/.test(normalized)) {
                return false;
            }
            return /^[A-Z0-9]+$/.test(normalized);
        });

    if (!fallback) {
        return "KHÁC";
    }
    return fallback.length > 14 ? fallback.slice(0, 14) : fallback;
}

function buildSpecs(product) {
    const defaultSpecs = [
        ["CPU", product.cpu],
        ["RAM", product.ram],
        ["Bộ nhớ", product.storage],
        ["Màn hình", product.screen],
        ["Card đồ hoạ", product.gpu],
        ["Pin", product.battery],
        ["Hệ điều hành", product.operatingSystem]
    ].filter((row) => String(row[1] || "").trim());
    if (defaultSpecs.length > 0) {
        return defaultSpecs
            .slice(0, 3)
            .map((row) => `${row[0]}: ${String(row[1] || "").trim()}`);
    }

    // Fallback cho dữ liệu cũ.
    const quickSpecs = parseMultiline(product.quickSpecs);
    if (quickSpecs.length > 0) {
        return quickSpecs.slice(0, 3);
    }

    const out = [];
    if (product.category && product.category.name) {
        out.push(product.category.name);
    }

    const stock = Number(product.stock || 0);
    out.push(stock > 0 ? `Tồn kho: ${stock}` : "Hết hàng");

    const description = String(product.description || "").trim();
    if (description) {
        const head = description.split(/[|,.;]/).map((x) => x.trim()).filter(Boolean)[0];
        if (head) {
            out.push(head);
        }
    }

    return out.slice(0, 3);
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

function formatCompactNumber(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num) || num <= 0) {
        return "0";
    }
    if (num >= 1_000_000) {
        const million = num / 1_000_000;
        return `${million >= 10 ? million.toFixed(0) : million.toFixed(1)}M`;
    }
    if (num >= 1_000) {
        const thousand = num / 1_000;
        return `${thousand >= 10 ? thousand.toFixed(0) : thousand.toFixed(1)}K`;
    }
    return String(Math.round(num));
}

function getTopBrands(products, limit = 8) {
    const brandCounter = new Map();
    (products || []).forEach((product) => {
        const brand = extractBrand(product.name);
        if (!brand || brand === "KHÁC") {
            return;
        }
        brandCounter.set(brand, Number(brandCounter.get(brand) || 0) + 1);
    });

    return Array.from(brandCounter.entries())
        .map(([brand, count]) => ({ brand, count }))
        .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand))
        .slice(0, limit);
}

function renderStorePulse(products) {
    const holder = document.getElementById("store-pulse");
    if (!holder) {
        return;
    }

    const list = products || [];
    const total = list.length;
    const inStock = list.filter((product) => Number(product.stock || 0) > 0).length;
    const inStockRate = total > 0 ? Math.round((inStock / total) * 100) : 0;
    const categoriesCount = new Set(
        list.map((product) => String(product.category?.id || product.category?.name || "").trim()).filter(Boolean)
    ).size;
    const avgPrice = total > 0
        ? Math.round(list.reduce((sum, product) => {
            const pricing = TechStore.resolveProductPricing(product);
            return sum + pricing.finalPrice;
        }, 0) / total)
        : 0;

    const cards = [
        {
            label: "Sản phẩm đang hiển thị",
            value: formatCompactNumber(total),
            note: "Theo bộ lọc hiện tại"
        },
        {
            label: "Tỷ lệ còn hàng",
            value: `${inStockRate}%`,
            note: `${inStock}/${total} sản phẩm còn kho`
        },
        {
            label: "Danh mục hoạt động",
            value: formatCompactNumber(categoriesCount),
            note: "Nhóm sản phẩm đang có"
        },
        {
            label: "Giá trung bình",
            value: TechStore.formatVnd(avgPrice),
            note: "Mức giá tham khảo"
        }
    ];

    holder.innerHTML = cards.map((card) => `
        <article class="pulse-card">
            <p class="pulse-label">${escapeHtml(card.label)}</p>
            <strong class="pulse-value">${escapeHtml(card.value)}</strong>
            <p class="pulse-note">${escapeHtml(card.note)}</p>
        </article>
    `).join("");
}

function renderTrendingBrands(products) {
    const holder = document.getElementById("trending-brands");
    if (!holder) {
        return;
    }

    const topBrands = getTopBrands(products, 10);
    if (topBrands.length === 0) {
        holder.innerHTML = `<div class="muted">Chưa có dữ liệu thương hiệu để gợi ý.</div>`;
        return;
    }

    holder.innerHTML = topBrands.map(({ brand, count }) => `
        <button class="trending-brand-chip" type="button" data-brand-keyword="${escapeHtml(brand)}">
            <span>${escapeHtml(brand)}</span>
            <span class="trending-brand-count">${count}</span>
        </button>
    `).join("");
}

function renderQuickReviews(products) {
    const holder = document.getElementById("quick-reviews");
    if (!holder) {
        return;
    }

    const topBrands = getTopBrands(products, 3).map((item) => item.brand);
    const leadBrand = topBrands[0] || "sản phẩm công nghệ";
    const secondBrand = topBrands[1] || "thiết bị văn phòng";
    const thirdBrand = topBrands[2] || "phụ kiện";

    const reviews = [
        {
            title: "Đóng gói chắc chắn",
            score: "4.9/5",
            text: `Đặt ${leadBrand}, nhận hàng nhanh và hộp còn nguyên vẹn.`
        },
        {
            title: "Tư vấn đúng nhu cầu",
            score: "4.8/5",
            text: `Mình được tư vấn cấu hình ${secondBrand} rất hợp với ngân sách.`
        },
        {
            title: "Hỗ trợ sau mua ổn",
            score: "4.9/5",
            text: `Sau khi mua ${thirdBrand}, team hỗ trợ kỹ thuật phản hồi nhanh.`
        }
    ];

    holder.innerHTML = reviews.map((review) => `
        <article class="quick-review-card">
            <div class="quick-review-head">
                <strong>${escapeHtml(review.title)}</strong>
                <span class="quick-review-score">${escapeHtml(review.score)}</span>
            </div>
            <p class="quick-review-stars" aria-hidden="true">★★★★★</p>
            <p class="quick-review-text">${escapeHtml(review.text)}</p>
        </article>
    `).join("");
}

function bindStoreVibeEvents() {
    const brands = document.getElementById("trending-brands");
    if (!brands || brands.dataset.wired === "1") {
        return;
    }
    brands.dataset.wired = "1";

    brands.addEventListener("click", (event) => {
        const chip = event.target.closest(".trending-brand-chip");
        if (!chip) {
            return;
        }

        const nextKeyword = String(chip.getAttribute("data-brand-keyword") || "").trim();
        keyword = nextKeyword;

        const searchInput = document.getElementById("search");
        if (searchInput) {
            searchInput.value = nextKeyword;
        }

        syncQuery();
        loadProducts().then(() => {
            const marketSection = document.getElementById("market-zones-section");
            if (marketSection) {
                marketSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }).catch((err) => {
            alert(err.message || "Không thể lọc theo thương hiệu.");
        });
    });
}

function renderMarketCard(product) {
    const images = getGalleryImages(product);
    const thumb = images[0] || "https://placehold.co/600x400/f3f4f6/111827?text=TechParadise";
    const stock = Number(product.stock || 0);
    const inStock = stock > 0;
    const brand = extractBrand(product.name);
    const specs = buildSpecs(product);
    const galleryCount = Math.max(0, images.length - 1);
    const pricing = TechStore.resolveProductPricing(product);
    const discountText = pricing.hasDiscount ? `-${Math.round(pricing.discountPercent)}%` : "";

    return `
        <article class="market-card" data-brand="${escapeHtml(brand)}">
            <a class="market-thumb-wrap" href="/product/${product.id}">
                <img class="market-thumb" src="${thumb}" alt="${escapeHtml(product.name)}">
                ${galleryCount > 0 ? `<span class="gallery-count-badge">+${galleryCount} ảnh</span>` : ""}
            </a>
            <div class="market-body">
                <a class="product-link" href="/product/${product.id}">
                    <h4 class="market-title">${escapeHtml(product.name)}</h4>
                </a>
                ${renderProductRating(product, "market-rating")}

                <ul class="market-specs">
                    ${specs.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
                </ul>

                <div class="market-price-row">
                    <div class="market-price-stack">
                        <strong class="market-price">${TechStore.formatVnd(pricing.finalPrice)}</strong>
                        ${pricing.hasDiscount ? `<span class="price-old-text">${TechStore.formatVnd(pricing.originalPrice)}</span>` : ""}
                    </div>
                    <div class="market-price-side">
                        ${pricing.hasDiscount ? `<span class="price-discount-badge">${escapeHtml(discountText)}</span>` : ""}
                        <span class="stock-pill ${inStock ? "in" : "out"}">${inStock ? "Còn hàng" : "Hết hàng"}</span>
                    </div>
                </div>

                <div class="market-actions">
                    <button class="btn btn-cart btn-sm" type="button" data-action="add" data-id="${product.id}" data-name="${encodeURIComponent(product.name)}" data-price="${pricing.finalPrice}" ${inStock ? "" : "disabled"}>
                        ${buttonIcon("add")}Thêm vào giỏ
                    </button>
                    <button class="btn btn-buy btn-sm" type="button" data-action="buy" data-id="${product.id}" ${inStock ? "" : "disabled"}>
                        ${buttonIcon("buy")}Mua ngay
                    </button>
                </div>
            </div>
        </article>
    `;
}

function marketZonePriority(group) {
    const name = normalizeText(group && group.category ? group.category.name : "");
    if (name.includes("laptop") || name.includes("notebook")) {
        return 0;
    }
    return 1;
}

function renderMarketZones(products) {
    const holder = document.getElementById("market-zones");
    if (!holder) {
        return;
    }
    stopMarketZoneAutoplay();

    const groupMap = new Map();
    products.forEach((product) => {
        const category = product.category || { id: "uncategorized", name: "Sản phẩm khác" };
        const key = String(category.id ?? category.name);
        if (!groupMap.has(key)) {
            groupMap.set(key, { category, products: [] });
        }
        groupMap.get(key).products.push(product);
    });

    const groups = Array.from(groupMap.values())
        .map((group) => ({
            ...group,
            products: group.products.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0))
        }))
        .sort((a, b) => {
            const priorityDiff = marketZonePriority(a) - marketZonePriority(b);
            if (priorityDiff !== 0) {
                return priorityDiff;
            }

            const countDiff = b.products.length - a.products.length;
            if (countDiff !== 0) {
                return countDiff;
            }

            const nameA = String(a.category && a.category.name ? a.category.name : "");
            const nameB = String(b.category && b.category.name ? b.category.name : "");
            return nameA.localeCompare(nameB, "vi", { sensitivity: "base" });
        })
        .slice(0, 6);

    if (!groups.length) {
        holder.innerHTML = `
            <article class="market-zone">
                <div class="market-empty" style="display:flex; margin: 14px;">
                    Không có sản phẩm phù hợp với bộ lọc hiện tại.
                </div>
            </article>
        `;
        return;
    }

    holder.innerHTML = groups.map((group, idx) => {
        const zoneId = `zone-track-${idx}`;
        const zoneProducts = group.products.slice(0, 16);
        const brands = Array.from(new Set(zoneProducts.map((p) => extractBrand(p.name)))).slice(0, 8);
        const categoryId = group.category.id ?? "";
        const categoryKey = String(categoryId).trim();
        const allLink = /^\d+$/.test(categoryKey)
            ? `/category/${encodeURIComponent(categoryKey)}`
            : `/?categoryId=${encodeURIComponent(categoryKey)}`;

        return `
            <article class="market-zone" data-zone-wrap="${zoneId}">
                <header class="market-zone-head">
                    <div class="market-zone-title-wrap">
                        <h3>${escapeHtml(group.category.name)} bán chạy</h3>
                        <span class="market-sep">|</span>
                        <span class="shipping-badge">
                            <span class="icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24"><path d="M3 7h12v10H3z"/><path d="M15 10h3l3 3v4h-6z"/><circle cx="8" cy="18" r="1"/><circle cx="18" cy="18" r="1"/></svg>
                            </span>
                            Miễn phí giao hàng
                        </span>
                    </div>

                    <div class="market-brand-row">
                        <button class="brand-chip active" type="button" data-zone="${zoneId}" data-brand="ALL">Tất cả</button>
                        ${brands.map((brand) => `
                            <button class="brand-chip" type="button" data-zone="${zoneId}" data-brand="${escapeHtml(brand)}">${escapeHtml(brand)}</button>
                        `).join("")}
                        <a class="market-link-all" href="${allLink}">Xem tất cả</a>
                    </div>
                </header>

                <div class="market-carousel">
                    <button class="carousel-nav prev" type="button" data-zone-nav="${zoneId}" data-dir="-1" aria-label="Xem trước">
                        <span aria-hidden="true">&#8249;</span>
                    </button>

                    <div class="market-track" id="${zoneId}">
                        ${zoneProducts.map((p) => renderMarketCard(p)).join("")}
                    </div>

                    <button class="carousel-nav next" type="button" data-zone-nav="${zoneId}" data-dir="1" aria-label="Xem tiếp">
                        <span aria-hidden="true">&#8250;</span>
                    </button>
                </div>

                <div class="market-empty" data-zone-empty="${zoneId}" style="display:none;">
                    Không có sản phẩm phù hợp với thương hiệu đã chọn.
                </div>
            </article>
        `;
    }).join("");
}

function getVisibleMarketCards(track) {
    return Array.from(track.querySelectorAll(".market-card"))
        .filter((card) => card.style.display !== "none");
}

function getNearestVisibleCardIndex(track, cards) {
    if (!cards || cards.length === 0) {
        return 0;
    }

    const left = Math.max(0, track.scrollLeft || 0);
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
        const distance = Math.abs(card.offsetLeft - left);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
        }
    });

    return nearestIndex;
}

function markActiveMarketCard(cards, index) {
    if (!cards || cards.length === 0) {
        return;
    }

    const normalized = ((Number(index) || 0) % cards.length + cards.length) % cards.length;
    cards.forEach((card, idx) => {
        card.classList.toggle("is-spotlight", idx === normalized);
    });
}

function scrollMarketTrackToIndex(track, cards, targetIndex) {
    if (!track || !cards || cards.length === 0) {
        return;
    }

    const normalized = ((Number(targetIndex) || 0) % cards.length + cards.length) % cards.length;
    track.dataset.autoIndex = String(normalized);
    markActiveMarketCard(cards, normalized);
    track.scrollTo({ left: cards[normalized].offsetLeft, behavior: "smooth" });
}

function applyBrandFilter(zoneId, brand) {
    const track = document.getElementById(zoneId);
    if (!track) {
        return;
    }

    let visibleCount = 0;
    track.querySelectorAll(".market-card").forEach((card) => {
        const match = brand === "ALL" || card.getAttribute("data-brand") === brand;
        card.style.display = match ? "" : "none";
        if (match) {
            visibleCount += 1;
        }
    });

    const empty = document.querySelector(`[data-zone-empty="${zoneId}"]`);
    if (empty) {
        empty.style.display = visibleCount === 0 ? "flex" : "none";
    }

    track.dataset.autoIndex = "0";
    markActiveMarketCard(getVisibleMarketCards(track), 0);
    track.scrollTo({ left: 0, behavior: "smooth" });
}

function scrollMarketZone(zoneId, direction) {
    const track = document.getElementById(zoneId);
    if (!track) {
        return;
    }

    const cards = getVisibleMarketCards(track);
    if (cards.length === 0) {
        return;
    }

    const current = getNearestVisibleCardIndex(track, cards);
    const next = current + (direction > 0 ? 1 : -1);
    scrollMarketTrackToIndex(track, cards, next);
}

function stopMarketZoneAutoplay() {
    marketZoneAutoTimers.forEach((timerId) => {
        window.clearInterval(timerId);
    });
    marketZoneAutoTimers.clear();
}

function startMarketZoneAutoplay() {
    stopMarketZoneAutoplay();

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    const tracks = Array.from(document.querySelectorAll(".market-track"));
    tracks.forEach((track) => {
        if (!track || !track.id) {
            return;
        }

        const initialCards = getVisibleMarketCards(track);
        track.dataset.autoIndex = "0";
        markActiveMarketCard(initialCards, 0);

        const timerId = window.setInterval(() => {
            const cards = getVisibleMarketCards(track);
            if (cards.length <= 1) {
                return;
            }

            const zone = track.closest(".market-zone");
            if ((zone && zone.matches(":hover")) || track.matches(":hover")) {
                return;
            }

            const current = getNearestVisibleCardIndex(track, cards);
            scrollMarketTrackToIndex(track, cards, current + 1);
        }, 5000);

        marketZoneAutoTimers.set(track.id, timerId);
    });
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
    setTimeout(() => holder.classList.remove("show"), 1200);
}

async function handleProductActions(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
        return;
    }

    const action = button.getAttribute("data-action");
    const productId = Number(button.getAttribute("data-id"));
    if (!productId) {
        return;
    }

    if (action === "buy") {
        if (!TechStore.ensureLoggedIn()) {
            return;
        }
        window.location.href = `/checkout?productId=${encodeURIComponent(productId)}`;
        return;
    }

    if (action === "add") {
        if (!TechStore.ensureLoggedIn()) {
            return;
        }

        const rawName = button.getAttribute("data-name") || "";
        const productName = rawName ? decodeURIComponent(rawName) : "Sản phẩm";
        const price = Number(button.getAttribute("data-price")) || 0;
        try {
            await TechStore.addToCart({ productId, productName, price }, 1);
        } catch (err) {
            alert(err.message || "Không thể thêm vào giỏ hàng");
        }
    }
}

function getFilteredProducts() {
    const key = normalizeText(keyword);
    return allProductsCache.filter((product) => {
        const okCategory = !selectedCategoryId || String(product.category?.id || "") === String(selectedCategoryId);
        const okKeyword = !key || normalizeText(product.name).includes(key);
        const okCategorySemantic = !isAccessoryMismatchProduct(product);
        return okCategory && okKeyword && okCategorySemantic;
    });
}

function bindMarketZonesEvents() {
    const holder = document.getElementById("market-zones");
    if (!holder || holder.dataset.wired === "1") {
        return;
    }
    holder.dataset.wired = "1";

    holder.addEventListener("click", (event) => {
        const chip = event.target.closest(".brand-chip");
        if (chip) {
            const zoneId = chip.getAttribute("data-zone");
            const brand = chip.getAttribute("data-brand") || "ALL";
            if (!zoneId) {
                return;
            }

            const wrap = chip.closest(".market-zone");
            if (wrap) {
                wrap.querySelectorAll(".brand-chip").forEach((item) => item.classList.remove("active"));
            }
            chip.classList.add("active");
            applyBrandFilter(zoneId, brand);
            return;
        }

        const nav = event.target.closest("[data-zone-nav]");
        if (nav) {
            const zoneId = nav.getAttribute("data-zone-nav");
            const dir = Number(nav.getAttribute("data-dir") || 0);
            if (zoneId && dir) {
                scrollMarketZone(zoneId, dir);
            }
            return;
        }

        handleProductActions(event);
    });
}

async function renderMarketZonesIfNeeded() {
    const section = document.getElementById("market-zones-section");
    if (section) {
        section.style.display = "block";
    }

    const filtered = getFilteredProducts();
    renderStorePulse(filtered);
    renderTrendingBrands(filtered);
    renderQuickReviews(filtered);
    bindStoreVibeEvents();
    updateResultHint(filtered.length);
    renderMarketZones(filtered);
    bindMarketZonesEvents();
    startMarketZoneAutoplay();
}

async function loadProducts() {
    // Luôn gọi API theo bộ lọc hiện tại để dữ liệu mới nhất.
    const params = new URLSearchParams();
    if (keyword) {
        params.set("keyword", keyword);
    }
    if (selectedCategoryId) {
        params.set("categoryId", selectedCategoryId);
    }

    const query = params.toString();
    const response = await fetch(query ? `/api/public/products?${query}` : "/api/public/products");
    allProductsCache = response.ok ? (await response.json()) : [];
    allProductsCache = allProductsCache.filter((product) => !shouldHideCategoryName(product?.category?.name));

    await renderMarketZonesIfNeeded();
}

window.addEventListener("DOMContentLoaded", async () => {
    TechStore.updateHeader();
    readQuery();
    await initHomeBannerSlider();

    await fetchCategories();
    renderCategoryList();

    await loadProducts();
});

window.addEventListener("beforeunload", () => {
    stopHomeBannerAutoplay();
    stopMarketZoneAutoplay();
});

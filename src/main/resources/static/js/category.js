// category.js
// Trang danh muc:
// - Hien thi toan bo san pham theo categoryId tren URL
// - Loc theo thuong hieu + tu khoa trong danh muc
// - Sap xep va tai them (client-side)

const CATEGORY_PAGE_SIZE = 15;
const CATEGORY_BANNERS = Object.freeze({
    laptop: {
        alt: "Banner xem tất cả laptop",
        images: [
            "https://file.hstatic.net/200000722513/file/gearvn-laptop-van-phong-t8-header-banner.png"
        ]
    },
    accessory: {
        alt: "Banner xem tất cả phụ kiện",
        images: [
            "https://file.hstatic.net/200000722513/file/thang_06_banner_collections_1920x420_-_web_header.png"
        ]
    },
    phone: {
        alt: "Banner xem tất cả điện thoại",
        images: [
            "https://cdn.hoanghamobile.vn/i/home/Uploads/2026/03/25/iphone-16e-viettel-cat.png",
            "https://cdn.hoanghamobile.vn/i/home/Uploads/2026/04/01/s26-ultra-1200x200-0104.png",
            "https://cdn.hoanghamobile.vn/i/home/Uploads/2025/12/19/redmagic-11-pro-cat.png"
        ]
    }
});

let categoryId = null;
let selectedCategory = null;
let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
const activeFilters = {
    stock: "",
    price: "",
    brand: "",
    cpu: "",
    screen: "",
    usage: "",
    storage: "",
    ram: "",
    gpu: ""
};
const FILTER_QUERY_KEYS = Object.keys(activeFilters);
let sortMode = "featured";
let bannerImages = [];
let bannerAlt = "";
let bannerIndex = 0;
let bannerTimerId = null;
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
        .replaceAll("đ", "d")
        .replaceAll("Đ", "D")
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
    if (!isAccessoryCategoryName(product && product.category && product.category.name)) {
        return false;
    }

    const text = normalizeText([
        product && product.name,
        product && product.description,
        product && product.quickSpecs,
        product && product.detailSpecs
    ].filter(Boolean).join(" "));

    if (containsAnyToken(text, ACCESSORY_ALLOW_TOKENS)) {
        return false;
    }

    const hasLaptopTokens = containsAnyToken(text, ACCESSORY_LAPTOP_TOKENS);
    const hasLaptopSpecs = Boolean(String(product && product.cpu || "").trim())
        && Boolean(String(product && product.screen || "").trim())
        && (Boolean(String(product && product.ram || "").trim()) || Boolean(String(product && product.gpu || "").trim()));
    if (hasLaptopTokens || hasLaptopSpecs) {
        return true;
    }

    return containsAnyToken(text, ACCESSORY_COMPONENT_TOKENS);
}

function resolveBannerForCategoryName(categoryName) {
    const key = normalizeText(categoryName);
    if (!key) {
        return null;
    }
    if (key.includes("laptop")) {
        return CATEGORY_BANNERS.laptop;
    }
    if (key.includes("tai nghe") || key.includes("tainghe") || key.includes("phu kien") || key.includes("phukien")) {
        return CATEGORY_BANNERS.accessory;
    }
    if (key.includes("dien thoai") || key.includes("dienthoai") || key.includes("smartphone") || key.includes("phone")) {
        return CATEGORY_BANNERS.phone;
    }
    return null;
}

function firstNonEmpty(...values) {
    for (const value of values) {
        const clean = String(value || "").trim();
        if (clean) {
            return clean;
        }
    }
    return "";
}

function extractNumber(value) {
    const normalized = String(value || "").replace(",", ".");
    const match = normalized.match(/(\d+(?:\.\d+)?)/);
    if (!match) {
        return null;
    }
    const num = Number(match[1]);
    return Number.isFinite(num) ? num : null;
}

function extractScreenBucket(product) {
    const raw = firstNonEmpty(product && product.screen, "");
    if (!raw) {
        return "";
    }
    const size = extractNumber(raw);
    if (!Number.isFinite(size)) {
        return "";
    }
    if (size < 7) {
        if (size < 6) return "Dưới 6 inch";
        if (size <= 6.7) return "6 - 6.7 inch";
        return "Trên 6.7 inch";
    }
    if (size <= 14) return "14 inch trở xuống";
    if (size <= 16) return "15 - 16 inch";
    return "Trên 16 inch";
}

function extractCpuBucket(product) {
    const raw = normalizeText(firstNonEmpty(product && product.cpu, product && product.name));
    if (!raw) {
        return "";
    }
    if (raw.includes("core i9")) return "Intel Core i9";
    if (raw.includes("core i7")) return "Intel Core i7";
    if (raw.includes("core i5")) return "Intel Core i5";
    if (raw.includes("core i3")) return "Intel Core i3";
    if (raw.includes("ryzen 9")) return "AMD Ryzen 9";
    if (raw.includes("ryzen 7")) return "AMD Ryzen 7";
    if (raw.includes("ryzen 5")) return "AMD Ryzen 5";
    if (raw.includes("ryzen 3")) return "AMD Ryzen 3";
    if (raw.includes("snapdragon")) return "Snapdragon";
    if (raw.includes("apple m4")) return "Apple M4";
    if (raw.includes("apple m3")) return "Apple M3";
    if (raw.includes("apple m2")) return "Apple M2";
    if (raw.includes("apple m1")) return "Apple M1";
    if (raw.includes("mediatek")) return "MediaTek";
    if (raw.includes("exynos")) return "Exynos";
    return "";
}

function extractRamBucket(product) {
    const raw = normalizeText(product && product.ram);
    if (!raw) {
        return "";
    }
    const size = extractNumber(raw);
    if (!Number.isFinite(size)) {
        return "";
    }
    if (size <= 8) return "8GB trở xuống";
    if (size <= 16) return "12 - 16GB";
    if (size <= 32) return "24 - 32GB";
    return "Trên 32GB";
}

function extractStorageBucket(product) {
    const raw = normalizeText(product && product.storage);
    if (!raw) {
        return "";
    }
    const size = extractNumber(raw);
    if (!Number.isFinite(size)) {
        return "";
    }
    const gb = raw.includes("tb") ? size * 1024 : size;
    if (gb <= 256) return "256GB trở xuống";
    if (gb <= 512) return "512GB";
    if (gb <= 1024) return "1TB";
    return "Trên 1TB";
}

function extractGpuBucket(product) {
    const raw = normalizeText(product && product.gpu);
    if (!raw) {
        return "";
    }
    const rtx = raw.match(/rtx\s*\d{3,4}/);
    if (rtx) {
        return rtx[0].toUpperCase().replace(/\s+/g, " ");
    }
    if (raw.includes("gtx")) return "NVIDIA GTX";
    if (raw.includes("radeon") || raw.includes(" rx ")) return "AMD Radeon";
    if (raw.includes("iris")) return "Intel Iris";
    if (raw.includes("uhd")) return "Intel UHD";
    if (raw.includes("apple")) return "Apple GPU";
    return "";
}

function extractUsageBucket(product) {
    const text = normalizeText([
        product && product.name,
        product && product.description,
        product && product.category && product.category.name
    ].filter(Boolean).join(" "));
    if (!text) {
        return "";
    }
    if (text.includes("gaming") || text.includes("choi game")) return "Gaming";
    if (text.includes("van phong") || text.includes("office") || text.includes("doanh nhan")) return "Văn phòng";
    if (text.includes("hoc tap") || text.includes("sinh vien")) return "Học tập";
    if (text.includes("do hoa") || text.includes("creator") || text.includes("thiet ke")) return "Đồ họa - sáng tạo";
    if (text.includes("ultra") || text.includes("flagship") || text.includes("pro max")) return "Cao cấp";
    if (text.includes("camera")) return "Chụp ảnh";
    if (text.includes("pin")) return "Pin tốt";
    return "";
}

function getFilterValueFromProduct(product, key) {
    if (key === "brand") {
        return extractBrand(product && product.name);
    }
    if (key === "cpu") {
        return extractCpuBucket(product);
    }
    if (key === "screen") {
        return extractScreenBucket(product);
    }
    if (key === "usage") {
        return extractUsageBucket(product);
    }
    if (key === "storage") {
        return extractStorageBucket(product);
    }
    if (key === "ram") {
        return extractRamBucket(product);
    }
    if (key === "gpu") {
        return extractGpuBucket(product);
    }
    return "";
}

function collectFilterOptions(products, key) {
    const map = new Map();
    (products || []).forEach((product) => {
        const label = String(getFilterValueFromProduct(product, key) || "").trim();
        if (!label) {
            return;
        }
        map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi", { sensitivity: "base" }))
        .map(([label]) => label);
}

function setFilterSelectOptions(config) {
    const select = document.getElementById(config.selectId);
    const wrap = document.getElementById(config.wrapId);
    if (!select || !wrap) {
        return;
    }

    const options = config.options || [];
    const currentValue = String(activeFilters[config.key] || "");
    const isValidValue = currentValue && options.includes(currentValue);
    if (currentValue && !isValidValue) {
        activeFilters[config.key] = "";
    }

    select.innerHTML = `
        <option value="">${config.placeholder}</option>
        ${options.map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`).join("")}
    `;
    select.value = String(activeFilters[config.key] || "");
    wrap.style.display = options.length > 0 ? "" : "none";
}

function renderFilterControls() {
    setFilterSelectOptions({
        key: "brand",
        selectId: "filter-brand",
        wrapId: "filter-item-brand",
        placeholder: "Hãng",
        options: collectFilterOptions(allProducts, "brand")
    });
    setFilterSelectOptions({
        key: "cpu",
        selectId: "filter-cpu",
        wrapId: "filter-item-cpu",
        placeholder: "CPU",
        options: collectFilterOptions(allProducts, "cpu")
    });
    setFilterSelectOptions({
        key: "screen",
        selectId: "filter-screen",
        wrapId: "filter-item-screen",
        placeholder: "Kích thước màn hình",
        options: collectFilterOptions(allProducts, "screen")
    });
    setFilterSelectOptions({
        key: "usage",
        selectId: "filter-usage",
        wrapId: "filter-item-usage",
        placeholder: "Nhu cầu sử dụng",
        options: collectFilterOptions(allProducts, "usage")
    });
    setFilterSelectOptions({
        key: "storage",
        selectId: "filter-storage",
        wrapId: "filter-item-storage",
        placeholder: "Ổ cứng",
        options: collectFilterOptions(allProducts, "storage")
    });
    setFilterSelectOptions({
        key: "ram",
        selectId: "filter-ram",
        wrapId: "filter-item-ram",
        placeholder: "RAM",
        options: collectFilterOptions(allProducts, "ram")
    });
    setFilterSelectOptions({
        key: "gpu",
        selectId: "filter-gpu",
        wrapId: "filter-item-gpu",
        placeholder: "Card đồ hoạ",
        options: collectFilterOptions(allProducts, "gpu")
    });
}

function parseMultiline(value) {
    return String(value || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

function getGalleryImages(product) {
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

    push(product && product.imageUrl);
    parseMultiline(product && product.galleryImages).forEach(push);
    return images;
}

function extractBrand(productName) {
    const upper = String(productName || "").toUpperCase();
    const knownBrands = ["ASUS", "ACER", "MSI", "LENOVO", "GIGABYTE", "DELL", "HP", "LG", "APPLE", "SAMSUNG", "SONY", "XIAOMI", "RAZER", "LOGITECH", "TP-LINK", "TP"];

    for (const brand of knownBrands) {
        if (upper.includes(brand)) {
            return brand;
        }
    }

    const first = upper.split(/[\s/-]+/).find(Boolean);
    if (!first) {
        return "KHÁC";
    }
    return first.length > 16 ? first.slice(0, 16) : first;
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
            .slice(0, 2)
            .map((row) => `${row[0]}: ${String(row[1] || "").trim()}`);
    }

    const quickSpecs = parseMultiline(product.quickSpecs);
    if (quickSpecs.length > 0) {
        return quickSpecs.slice(0, 2);
    }

    const stock = Number(product.stock || 0);
    return [stock > 0 ? `Tồn kho: ${stock}` : "Hết hàng"];
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

function renderProductRating(product, extraClass = "") {
    const rating = TechStore.resolveProductRating(product);
    const className = extraClass ? `product-rating ${extraClass}` : "product-rating";
    const title = rating.totalReviews > 0
        ? `${rating.averageRating.toFixed(1)}/5 từ ${rating.totalReviews} đánh giá`
        : "Chưa có đánh giá";

    return `
        <div class="${className}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
            <span class="rating-stars" aria-hidden="true">${rating.stars}</span>
            <span class="rating-meta">${escapeHtml(`${rating.averageRating.toFixed(1)} (${rating.totalReviews})`)}</span>
        </div>
    `;
}

function parseCategoryIdFromPath() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length < 2 || parts[0] !== "category") {
        return null;
    }
    const id = Number(parts[1]);
    if (!Number.isFinite(id) || id <= 0) {
        return null;
    }
    return id;
}

function isAllowedSort(value) {
    return ["featured", "newest", "priceAsc", "priceDesc", "nameAsc", "nameDesc"].includes(value);
}

function readQuery() {
    const params = new URLSearchParams(window.location.search);
    FILTER_QUERY_KEYS.forEach((key) => {
        activeFilters[key] = (params.get(key) || "").trim();
    });
    if (!["", "in", "out"].includes(activeFilters.stock)) {
        activeFilters.stock = "";
    }
    if (!["", "under5", "5to10", "10to20", "20to30", "30plus"].includes(activeFilters.price)) {
        activeFilters.price = "";
    }

    sortMode = (params.get("sort") || "featured").trim();
    if (!isAllowedSort(sortMode)) {
        sortMode = "featured";
    }
    const pageValue = Number(params.get("page") || 1);
    currentPage = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;

    const stockSelect = document.getElementById("filter-stock");
    if (stockSelect) stockSelect.value = activeFilters.stock || "";
    const priceSelect = document.getElementById("filter-price");
    if (priceSelect) priceSelect.value = activeFilters.price || "";

    const sortSelect = document.getElementById("category-sort");
    if (sortSelect) {
        sortSelect.value = sortMode;
    }
}

function syncQuery() {
    const params = new URLSearchParams();
    FILTER_QUERY_KEYS.forEach((key) => {
        const value = String(activeFilters[key] || "").trim();
        if (value) {
            params.set(key, value);
        }
    });
    if (sortMode && sortMode !== "featured") {
        params.set("sort", sortMode);
    }
    if (currentPage > 1) {
        params.set("page", String(currentPage));
    }

    const query = params.toString();
    const base = `/category/${encodeURIComponent(categoryId)}`;
    const next = query ? `${base}?${query}` : base;
    window.history.replaceState({}, "", next);
}

function stopBannerAutoplay() {
    if (bannerTimerId) {
        window.clearInterval(bannerTimerId);
        bannerTimerId = null;
    }
}

function hideCategoryTopBanner() {
    stopBannerAutoplay();
    bannerImages = [];
    bannerAlt = "";
    bannerIndex = 0;

    const holder = document.getElementById("category-top-banner");
    const image = document.getElementById("category-top-banner-image");
    const prevBtn = document.getElementById("category-top-banner-prev");
    const nextBtn = document.getElementById("category-top-banner-next");
    const dots = document.getElementById("category-top-banner-dots");
    if (holder) {
        holder.style.display = "none";
    }
    if (image) {
        image.removeAttribute("src");
        image.alt = "Banner danh mục";
    }
    if (prevBtn) {
        prevBtn.style.display = "none";
    }
    if (nextBtn) {
        nextBtn.style.display = "none";
    }
    if (dots) {
        dots.innerHTML = "";
        dots.style.display = "none";
    }
}

function renderCategoryTopBannerDots() {
    const dots = document.getElementById("category-top-banner-dots");
    if (!dots) {
        return;
    }

    if (bannerImages.length <= 1) {
        dots.innerHTML = "";
        dots.style.display = "none";
        return;
    }

    dots.style.display = "flex";
    dots.innerHTML = bannerImages.map((_, idx) => `
        <button
            class="category-top-banner-dot ${idx === bannerIndex ? "active" : ""}"
            type="button"
            data-banner-index="${idx}"
            aria-label="Xem banner ${idx + 1}"
        ></button>
    `).join("");
}

function renderCategoryTopBannerNavButtons() {
    const prevBtn = document.getElementById("category-top-banner-prev");
    const nextBtn = document.getElementById("category-top-banner-next");
    const shouldShow = bannerImages.length > 1;

    if (prevBtn) {
        prevBtn.style.display = shouldShow ? "inline-flex" : "none";
    }
    if (nextBtn) {
        nextBtn.style.display = shouldShow ? "inline-flex" : "none";
    }
}

function showCategoryTopBanner(index) {
    if (!bannerImages.length) {
        hideCategoryTopBanner();
        return;
    }

    const image = document.getElementById("category-top-banner-image");
    if (!image) {
        return;
    }

    const total = bannerImages.length;
    const nextIndex = ((Number(index) || 0) % total + total) % total;
    bannerIndex = nextIndex;
    image.src = bannerImages[nextIndex];
    image.alt = total > 1 ? `${bannerAlt} (${nextIndex + 1}/${total})` : bannerAlt;

    document.querySelectorAll(".category-top-banner-dot").forEach((dot, idx) => {
        dot.classList.toggle("active", idx === nextIndex);
    });
}

function startBannerAutoplayIfNeeded() {
    stopBannerAutoplay();
    if (bannerImages.length <= 1) {
        return;
    }
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    bannerTimerId = window.setInterval(() => {
        showCategoryTopBanner(bannerIndex + 1);
    }, 4500);
}

function setupCategoryTopBanner() {
    const holder = document.getElementById("category-top-banner");
    if (!holder) {
        return;
    }

    const config = resolveBannerForCategoryName(selectedCategory && selectedCategory.name);
    if (!config || !Array.isArray(config.images) || config.images.length === 0) {
        hideCategoryTopBanner();
        return;
    }

    holder.style.display = "block";
    bannerImages = [...config.images];
    bannerAlt = String(config.alt || "Banner danh mục");
    bannerIndex = 0;

    renderCategoryTopBannerNavButtons();
    renderCategoryTopBannerDots();
    showCategoryTopBanner(0);
    startBannerAutoplayIfNeeded();
}

function setHeadText(categoryName) {
    const safeName = String(categoryName || "").trim() || `Danh mục #${categoryId}`;

    document.title = `${safeName} - TechParadise`;

    const breadcrumb = document.getElementById("category-breadcrumb-name");
    if (breadcrumb) {
        breadcrumb.textContent = safeName;
    }
}

function showFatal(message) {
    hideCategoryTopBanner();
    setHeadText("Danh mục không tồn tại");

    const filterHead = document.querySelector(".category-filter-head");
    if (filterHead) {
        filterHead.style.display = "none";
    }

    const grid = document.getElementById("category-products");
    if (grid) {
        grid.innerHTML = "";
    }

    const empty = document.getElementById("category-empty");
    if (empty) {
        empty.textContent = message || "Không tìm thấy dữ liệu.";
        empty.style.display = "flex";
    }

    const pagination = document.getElementById("category-pagination");
    if (pagination) {
        pagination.style.display = "none";
        pagination.innerHTML = "";
    }
}

async function fetchCategory() {
    const response = await fetch("/api/public/categories");
    const categories = response.ok ? (await response.json()) : [];
    selectedCategory = categories.find((category) => String(category.id) === String(categoryId)) || null;
}

async function fetchProductsByCategory() {
    const response = await fetch(`/api/public/products?categoryId=${encodeURIComponent(categoryId)}`);
    allProducts = response.ok ? (await response.json()) : [];
    allProducts = allProducts.filter((product) => !isAccessoryMismatchProduct(product));
}

function matchesPriceFilter(product, priceFilter) {
    if (!priceFilter) {
        return true;
    }

    const finalPrice = Number(TechStore.resolveProductPricing(product).finalPrice || 0);
    if (priceFilter === "under5") return finalPrice < 5_000_000;
    if (priceFilter === "5to10") return finalPrice >= 5_000_000 && finalPrice < 10_000_000;
    if (priceFilter === "10to20") return finalPrice >= 10_000_000 && finalPrice < 20_000_000;
    if (priceFilter === "20to30") return finalPrice >= 20_000_000 && finalPrice < 30_000_000;
    if (priceFilter === "30plus") return finalPrice >= 30_000_000;
    return true;
}

function productTextIndex(product) {
    const chunks = [
        product && product.name,
        product && product.description,
        product && product.category && product.category.name,
        buildSpecs(product).join(" ")
    ].filter(Boolean);
    return normalizeText(chunks.join(" "));
}

function compareByNewest(a, b) {
    const da = Date.parse(a && a.createdAt ? a.createdAt : "");
    const db = Date.parse(b && b.createdAt ? b.createdAt : "");

    if (Number.isFinite(da) || Number.isFinite(db)) {
        return (Number.isFinite(db) ? db : 0) - (Number.isFinite(da) ? da : 0);
    }
    return Number(b && b.id || 0) - Number(a && a.id || 0);
}

function featuredScore(product) {
    const stock = Number(product && product.stock || 0);
    const rating = TechStore.resolveProductRating(product);
    const pricing = TechStore.resolveProductPricing(product);

    const stockPoint = stock > 0 ? 1.5 : 0;
    const ratingPoint = rating.averageRating * 1.6;
    const reviewPoint = Math.min(2, Math.log10((rating.totalReviews || 0) + 1));
    const pricePoint = pricing.finalPrice > 0 ? Math.min(1.2, 20_000_000 / pricing.finalPrice) : 0;

    return stockPoint + ratingPoint + reviewPoint + pricePoint;
}

function applySort(list) {
    if (!Array.isArray(list)) {
        return [];
    }

    const sorted = [...list];
    if (sortMode === "featured") {
        sorted.sort((a, b) => {
            const scoreDiff = featuredScore(b) - featuredScore(a);
            if (Math.abs(scoreDiff) > 0.0001) {
                return scoreDiff;
            }
            return compareByNewest(a, b);
        });
        return sorted;
    }
    if (sortMode === "priceAsc") {
        sorted.sort((a, b) => TechStore.resolveProductPricing(a).finalPrice - TechStore.resolveProductPricing(b).finalPrice);
        return sorted;
    }
    if (sortMode === "priceDesc") {
        sorted.sort((a, b) => TechStore.resolveProductPricing(b).finalPrice - TechStore.resolveProductPricing(a).finalPrice);
        return sorted;
    }
    if (sortMode === "nameAsc") {
        sorted.sort((a, b) => String(a && a.name || "").localeCompare(String(b && b.name || ""), "vi", { sensitivity: "base" }));
        return sorted;
    }
    if (sortMode === "nameDesc") {
        sorted.sort((a, b) => String(b && b.name || "").localeCompare(String(a && a.name || ""), "vi", { sensitivity: "base" }));
        return sorted;
    }
    sorted.sort(compareByNewest);
    return sorted;
}

function applyFilters() {
    const list = allProducts.filter((product) => {
        const stock = Number(product && product.stock || 0);

        if (activeFilters.stock === "in" && stock <= 0) {
            return false;
        }
        if (activeFilters.stock === "out" && stock > 0) {
            return false;
        }
        if (!matchesPriceFilter(product, activeFilters.price)) {
            return false;
        }

        const filterKeys = ["brand", "cpu", "screen", "usage", "storage", "ram", "gpu"];
        for (const key of filterKeys) {
            const selected = String(activeFilters[key] || "").trim();
            if (!selected) {
                continue;
            }
            const current = String(getFilterValueFromProduct(product, key) || "").trim();
            if (current !== selected) {
                return false;
            }
        }
        return true;
    });

    filteredProducts = applySort(list);
}

function renderResultHint() {
    const hint = document.getElementById("category-filter-status");
    if (!hint) {
        return;
    }

    const activeCount = FILTER_QUERY_KEYS.reduce((count, key) => {
        return String(activeFilters[key] || "").trim() ? count + 1 : count;
    }, 0);
    if (activeCount <= 0) {
        hint.textContent = "Chọn một vài tiêu chí chính để lọc nhanh sản phẩm phù hợp.";
        return;
    }
    hint.textContent = `Đang áp dụng ${activeCount} bộ lọc.`;
}

function renderCard(product, index) {
    const images = getGalleryImages(product);
    const thumb = images[0] || "https://placehold.co/600x400/f3f4f6/111827?text=TechParadise";
    const stock = Number(product.stock || 0);
    const inStock = stock > 0;
    const specs = buildSpecs(product);
    const pricing = TechStore.resolveProductPricing(product);
    const categoryName = product && product.category && product.category.name
        ? product.category.name
        : (selectedCategory && selectedCategory.name ? selectedCategory.name : "Sản phẩm");

    return `
        <article class="product-card category-product-card" style="--delay:${Math.min(index, 12) * 45}ms;">
            <a class="product-link" href="/product/${product.id}">
                <img class="product-thumb" src="${thumb}" alt="${escapeHtml(product.name)}">
            </a>
            <div class="product-body">
                <a class="product-link" href="/product/${product.id}">
                    <h3 class="product-title">${escapeHtml(product.name)}</h3>
                </a>
                <div class="product-topline">
                    <div class="product-meta">${escapeHtml(categoryName)}</div>
                    <span class="stock-pill ${inStock ? "in" : "out"}">${inStock ? `Còn ${stock}` : "Hết hàng"}</span>
                </div>
                ${renderProductRating(product, "category-rating")}
                <div class="mini-specs">
                    ${specs.map((spec) => `<span class="mini-spec-chip">${escapeHtml(spec)}</span>`).join("")}
                </div>
                <div class="product-price">${TechStore.formatVnd(pricing.finalPrice)}</div>
                ${pricing.hasDiscount
        ? `<div class="product-price-sub"><span class="price-old-text">${TechStore.formatVnd(pricing.originalPrice)}</span><span class="price-discount-badge">-${Math.round(pricing.discountPercent)}%</span></div>`
        : ""}
                <div class="product-actions">
                    <button class="btn btn-cart" type="button" data-action="add" data-id="${product.id}" data-name="${encodeURIComponent(product.name)}" data-price="${pricing.finalPrice}" ${inStock ? "" : "disabled"}>
                        ${buttonIcon("add")}Thêm vào giỏ
                    </button>
                    <button class="btn btn-buy" type="button" data-action="buy" data-id="${product.id}" ${inStock ? "" : "disabled"}>
                        ${buttonIcon("buy")}Mua ngay
                    </button>
                </div>
            </div>
        </article>
    `;
}

function buildPaginationItems(totalPages, page) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    if (start > 2) {
        pages.push("...");
    }
    for (let num = start; num <= end; num += 1) {
        pages.push(num);
    }
    if (end < totalPages - 1) {
        pages.push("...");
    }
    pages.push(totalPages);
    return pages;
}

function renderPagination(totalPages) {
    const pagination = document.getElementById("category-pagination");
    if (!pagination) {
        return;
    }

    if (totalPages <= 1) {
        pagination.style.display = "none";
        pagination.innerHTML = "";
        return;
    }

    const items = buildPaginationItems(totalPages, currentPage);
    const prevPage = Math.max(1, currentPage - 1);
    const nextPage = Math.min(totalPages, currentPage + 1);

    pagination.innerHTML = `
        <button class="category-page-btn category-page-nav" type="button" data-page="${prevPage}" ${currentPage <= 1 ? "disabled" : ""} aria-label="Trang trước">‹</button>
        ${items.map((item) => {
            if (item === "...") {
                return `<span class="category-page-dots" aria-hidden="true">…</span>`;
            }
            const pageNumber = Number(item);
            const activeClass = pageNumber === currentPage ? "active" : "";
            return `<button class="category-page-btn ${activeClass}" type="button" data-page="${pageNumber}" aria-label="Trang ${pageNumber}" ${pageNumber === currentPage ? "aria-current=\"page\"" : ""}>${pageNumber}</button>`;
        }).join("")}
        <button class="category-page-btn category-page-nav" type="button" data-page="${nextPage}" ${currentPage >= totalPages ? "disabled" : ""} aria-label="Trang sau">›</button>
    `;
    pagination.style.display = "inline-flex";
}

function renderProducts() {
    const grid = document.getElementById("category-products");
    const empty = document.getElementById("category-empty");
    const pagination = document.getElementById("category-pagination");
    if (!grid || !empty || !pagination) {
        return;
    }

    renderResultHint();

    if (!filteredProducts.length) {
        grid.innerHTML = "";
        empty.style.display = "flex";
        pagination.style.display = "none";
        pagination.innerHTML = "";
        currentPage = 1;
        return;
    }

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / CATEGORY_PAGE_SIZE));
    const normalizedPage = Math.min(Math.max(currentPage, 1), totalPages);
    if (normalizedPage !== currentPage) {
        currentPage = normalizedPage;
        syncQuery();
    } else {
        currentPage = normalizedPage;
    }
    const startIndex = (currentPage - 1) * CATEGORY_PAGE_SIZE;
    const visible = filteredProducts.slice(startIndex, startIndex + CATEGORY_PAGE_SIZE);

    grid.innerHTML = visible.map((product, idx) => renderCard(product, startIndex + idx)).join("");
    empty.style.display = "none";
    renderPagination(totalPages);
}

async function handleProductActions(event) {
    return handleProductActionsSafe(event);

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

    if (action !== "add") {
        return;
    }

    if (!TechStore.ensureLoggedIn()) {
        return;
    }

    const rawName = button.getAttribute("data-name") || "";
    const productName = rawName ? decodeURIComponent(rawName) : "Sản phẩm";
    const price = Number(button.getAttribute("data-price")) || 0;
    try {
        await TechStore.addToCart({ productId, productName, price }, 1);
        alert("Đã thêm vào giỏ hàng");
    } catch (err) {
        alert(err.message || "Không thể thêm vào giỏ hàng");
    }
}

async function handleProductActionsSafe(event) {
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

    if (action !== "add") {
        return;
    }

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

function bindEvents() {
    const bannerPrev = document.getElementById("category-top-banner-prev");
    if (bannerPrev && bannerPrev.dataset.wired !== "1") {
        bannerPrev.dataset.wired = "1";
        bannerPrev.addEventListener("click", () => {
            showCategoryTopBanner(bannerIndex - 1);
            startBannerAutoplayIfNeeded();
        });
    }

    const bannerNext = document.getElementById("category-top-banner-next");
    if (bannerNext && bannerNext.dataset.wired !== "1") {
        bannerNext.dataset.wired = "1";
        bannerNext.addEventListener("click", () => {
            showCategoryTopBanner(bannerIndex + 1);
            startBannerAutoplayIfNeeded();
        });
    }

    const bannerDots = document.getElementById("category-top-banner-dots");
    if (bannerDots && bannerDots.dataset.wired !== "1") {
        bannerDots.dataset.wired = "1";
        bannerDots.addEventListener("click", (event) => {
            const dot = event.target.closest("[data-banner-index]");
            if (!dot) {
                return;
            }
            const nextIndex = Number(dot.getAttribute("data-banner-index"));
            if (!Number.isFinite(nextIndex)) {
                return;
            }
            showCategoryTopBanner(nextIndex);
            startBannerAutoplayIfNeeded();
        });
    }

    const selectMappings = [
        { id: "filter-stock", key: "stock" },
        { id: "filter-price", key: "price" },
        { id: "filter-brand", key: "brand" },
        { id: "filter-cpu", key: "cpu" },
        { id: "filter-screen", key: "screen" },
        { id: "filter-usage", key: "usage" },
        { id: "filter-storage", key: "storage" },
        { id: "filter-ram", key: "ram" },
        { id: "filter-gpu", key: "gpu" }
    ];

    selectMappings.forEach(({ id, key }) => {
        const select = document.getElementById(id);
        if (!select || select.dataset.wired === "1") {
            return;
        }
        select.dataset.wired = "1";
        select.addEventListener("change", () => {
            activeFilters[key] = String(select.value || "").trim();
            currentPage = 1;
            syncQuery();
            applyFilters();
            renderProducts();
        });
    });

    const sortSelect = document.getElementById("category-sort");
    if (sortSelect && sortSelect.dataset.wired !== "1") {
        sortSelect.dataset.wired = "1";
        sortSelect.addEventListener("change", () => {
            const next = sortSelect.value;
            sortMode = isAllowedSort(next) ? next : "featured";
            currentPage = 1;
            syncQuery();
            applyFilters();
            renderProducts();
        });
    }

    const grid = document.getElementById("category-products");
    if (grid && grid.dataset.wired !== "1") {
        grid.dataset.wired = "1";
        grid.addEventListener("click", (event) => {
            handleProductActionsSafe(event);
        });
    }

    const pagination = document.getElementById("category-pagination");
    if (pagination && pagination.dataset.wired !== "1") {
        pagination.dataset.wired = "1";
        pagination.addEventListener("click", (event) => {
            const pageBtn = event.target.closest("button[data-page]");
            if (!pageBtn || pageBtn.disabled) {
                return;
            }
            const nextPage = Number(pageBtn.getAttribute("data-page"));
            if (!Number.isInteger(nextPage) || nextPage <= 0 || nextPage === currentPage) {
                return;
            }
            currentPage = nextPage;
            syncQuery();
            renderProducts();
            const grid = document.getElementById("category-products");
            if (grid) {
                const top = grid.getBoundingClientRect().top + window.scrollY - 90;
                window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
            }
        });
    }
}

async function initCategoryPage() {
    categoryId = parseCategoryIdFromPath();
    if (!categoryId) {
        showFatal("URL danh mục không hợp lệ.");
        return;
    }

    readQuery();
    bindEvents();

    await fetchCategory();
    if (!selectedCategory) {
        showFatal("Không tìm thấy danh mục bạn vừa chọn.");
        return;
    }

    setHeadText(selectedCategory.name);
    setupCategoryTopBanner();

    await fetchProductsByCategory();

    renderFilterControls();
    syncQuery();
    applyFilters();
    renderProducts();
}

window.addEventListener("DOMContentLoaded", () => {
    initCategoryPage().catch((err) => {
        showFatal(err && err.message ? err.message : "Không thể tải trang danh mục.");
    });
});

window.addEventListener("beforeunload", () => {
    stopBannerAutoplay();
});

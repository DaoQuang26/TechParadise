
// admin.js
// Điều khiển toàn bộ hành vi của trang /admin/dashboard.
// - Sidebar menu (hash route)
// - Tải dữ liệu theo từng view
// - Tìm kiếm/lọc dữ liệu trong bảng
// - Chuyển panel danh sách <-> chỉnh sửa cho products/categories/promotions
// - CRUD admin, cập nhật trạng thái đơn, cấp role (SUPER_ADMIN)
// tac dung code: quan ly UI dashboard admin va ket noi API backend cho tung module quan tri.

let ordersChart = null; // Chart.js instance (order status)
let revenueChart = null; // Chart.js instance (revenue detail)

// Cache dữ liệu để render/filter/edit không cần gọi API quá nhiều lần.
let ordersCache = [];
let productsCache = [];
let categoriesCache = [];
let promotionsCache = [];
let bannersCache = [];
let usersCache = [];
let supportConversationsCache = [];
let supportConversationDetail = null;
let supportSelectedCustomerId = null;
let supportPollingTimer = null;
let supportPollingPending = false;
let supportReplySending = false;
let userCreateSaving = false;
let localProductPreviewUrl = "";
let productAiPendingUrl = "";
let productAiPendingSourceUrl = "";
let productAiSourceUrl = "";
let productAiProcessing = false;
let productAiAbortController = null;
let productAiRequestSeq = 0;
let editingProductId = null;
let editingBannerId = null;
let productSaving = false;
let productSpecsEditor = null;
let adminImageLightboxPrevOverflow = "";

const PRODUCT_SPEC_FIELD_IDS = [
    "product-cpu",
    "product-ram",
    "product-storage",
    "product-gpu",
    "product-screen",
    "product-battery",
    "product-camera",
    "product-operating-system"
];

const PRODUCT_SPEC_FIELD_MAP = {
    "product-cpu": "cpu",
    "product-ram": "ram",
    "product-storage": "storage",
    "product-gpu": "gpu",
    "product-screen": "screen",
    "product-battery": "battery",
    "product-camera": "camera",
    "product-operating-system": "operatingSystem"
};

const PRODUCT_QUICK_SPEC_PRIORITY = [
    ["cpu", "CPU"],
    ["ram", "RAM"],
    ["storage", "Bộ nhớ"],
    ["gpu", "Card đồ hoạ"],
    ["screen", "Màn hình"],
    ["battery", "Pin"],
    ["operatingSystem", "Hệ điều hành"],
    ["camera", "Camera"]
];

const PRODUCT_DETAIL_SPECS_DEFAULT_PLACEHOLDER = "Mỗi dòng theo định dạng: Tên thông số: Giá trị";

const PRODUCT_SPEC_UI_DEFAULT = {
    fields: {
        cpu: { label: "CPU", placeholder: "VD: Apple A18 Pro / Intel Core i7" },
        ram: { label: "RAM", placeholder: "VD: 8GB / 16GB" },
        storage: { label: "Bộ nhớ (ROM/SSD)", placeholder: "VD: 256GB / 1TB SSD" },
        gpu: { label: "Card đồ họa", placeholder: "VD: RTX 4060 / Apple GPU" },
        screen: { label: "Màn hình", placeholder: "VD: 6.7 inch OLED 120Hz" },
        battery: { label: "Pin", placeholder: "VD: 5000mAh / 18 giờ" },
        camera: { label: "Camera", placeholder: "VD: 50MP + 12MP" },
        operatingSystem: { label: "Hệ điều hành", placeholder: "VD: Android 15 / iOS / Windows 11" }
    },
    detailSpecsPlaceholder: PRODUCT_DETAIL_SPECS_DEFAULT_PLACEHOLDER
};

const PRODUCT_SPEC_UI_BY_CATEGORY = [
    {
        keywords: ["laptop", "notebook", "macbook"],
        fields: {
            storage: { label: "Ổ cứng", placeholder: "VD: 512GB NVMe SSD / 1TB SSD" },
            camera: { label: "Webcam", placeholder: "VD: FHD 1080p / IR Camera" }
        },
        detailSpecsPlaceholder: "VD: CPU: Intel Core i7-13620H"
    },
    {
        keywords: ["ban phim", "keyboard"],
        fields: {
            cpu: { label: "Layout / Kích thước", placeholder: "VD: 75% / TKL / Fullsize" },
            ram: { label: "Switch", placeholder: "VD: Gateron Red / Cherry MX Blue" },
            storage: { label: "Kết nối", placeholder: "VD: USB-C / 2.4G / Bluetooth 5.1" },
            gpu: { label: "Keycap", placeholder: "VD: PBT Doubleshot / ABS" },
            screen: { label: "Đèn nền", placeholder: "VD: RGB 16.8 triệu màu" },
            battery: { label: "Pin", placeholder: "VD: 4000mAh / dùng 120 giờ" },
            camera: { label: "Khối lượng", placeholder: "VD: 750g" },
            operatingSystem: { label: "Tương thích", placeholder: "VD: Windows / macOS / Linux" }
        },
        detailSpecsPlaceholder: "VD: Switch: Gateron Brown"
    },
    {
        keywords: ["chuot", "mouse"],
        fields: {
            cpu: { label: "Cảm biến", placeholder: "VD: PixArt PAW3395" },
            ram: { label: "DPI", placeholder: "VD: 26.000 DPI" },
            storage: { label: "Kết nối", placeholder: "VD: 2.4G / Bluetooth / USB" },
            gpu: { label: "Polling rate", placeholder: "VD: 1000Hz / 4000Hz" },
            screen: { label: "Kiểu cầm", placeholder: "VD: Palm / Claw / Fingertip" },
            battery: { label: "Pin", placeholder: "VD: 70 giờ sử dụng" },
            camera: { label: "Khối lượng", placeholder: "VD: 59g" },
            operatingSystem: { label: "Tương thích", placeholder: "VD: Windows / macOS" }
        },
        detailSpecsPlaceholder: "VD: Cảm biến: PixArt PAW3395"
    },
    {
        keywords: ["tai nghe", "headphone", "headset"],
        fields: {
            cpu: { label: "Driver", placeholder: "VD: Dynamic 40mm" },
            ram: { label: "Microphone", placeholder: "VD: Mic rời chống ồn ENC" },
            storage: { label: "Kết nối", placeholder: "VD: 3.5mm / USB / Bluetooth 5.3" },
            gpu: { label: "Độ trễ", placeholder: "VD: 20ms (chế độ game)" },
            screen: { label: "Chống ồn", placeholder: "VD: ANC / ENC / Passive" },
            battery: { label: "Pin", placeholder: "VD: 35 giờ phát nhạc" },
            camera: { label: "Trọng lượng", placeholder: "VD: 280g" },
            operatingSystem: { label: "Tương thích", placeholder: "VD: PC / PS5 / Mobile" }
        },
        detailSpecsPlaceholder: "VD: Driver: 50mm Titanium"
    },
    {
        keywords: ["man hinh", "monitor", "display"],
        fields: {
            cpu: { label: "Kích thước", placeholder: "VD: 27 inch" },
            ram: { label: "Độ phân giải", placeholder: "VD: 2560x1440 (2K)" },
            storage: { label: "Tần số quét", placeholder: "VD: 165Hz" },
            gpu: { label: "Tấm nền", placeholder: "VD: IPS / VA / OLED" },
            screen: { label: "Độ sáng", placeholder: "VD: 350 nits" },
            battery: { label: "Cổng kết nối", placeholder: "VD: HDMI 2.1 / DP 1.4 / USB-C" },
            camera: { label: "Thời gian phản hồi", placeholder: "VD: 1ms MPRT" },
            operatingSystem: { label: "Chuẩn VESA", placeholder: "VD: 100x100mm" }
        },
        detailSpecsPlaceholder: "VD: Tấm nền: Fast IPS"
    },
    {
        keywords: ["linh kien", "component", "vga", "cpu", "mainboard", "ram pc", "ssd"],
        fields: {
            cpu: { label: "Model linh kiện", placeholder: "VD: Intel Core i5-14400F / RTX 4060 Ti" },
            ram: { label: "Chuẩn hỗ trợ", placeholder: "VD: DDR5 / PCIe 4.0" },
            storage: { label: "Dung lượng / Băng thông", placeholder: "VD: 1TB / 7000MB/s" },
            gpu: { label: "Socket / Giao tiếp", placeholder: "VD: LGA1700 / PCIe x16" },
            screen: { label: "Tản nhiệt", placeholder: "VD: 2 quạt / heatsink nhôm" },
            battery: { label: "Công suất đề xuất", placeholder: "VD: PSU 650W" },
            camera: { label: "Bảo hành", placeholder: "VD: 36 tháng" },
            operatingSystem: { label: "Tương thích", placeholder: "VD: Intel 12/13/14th Gen" }
        },
        detailSpecsPlaceholder: "VD: Giao tiếp: PCIe Gen4 x4"
    },
    {
        keywords: ["thiet bi mang", "router", "mesh", "wifi", "network"],
        fields: {
            cpu: { label: "Chuẩn mạng", placeholder: "VD: Wi-Fi 6 / AX3000" },
            ram: { label: "Tốc độ tối đa", placeholder: "VD: 3000Mbps" },
            storage: { label: "Băng tần", placeholder: "VD: 2.4GHz + 5GHz" },
            gpu: { label: "Số cổng LAN/WAN", placeholder: "VD: 1 WAN + 4 LAN Gigabit" },
            screen: { label: "Phạm vi phủ sóng", placeholder: "VD: 200m²" },
            battery: { label: "Nguồn cấp", placeholder: "VD: Adapter 12V-1.5A" },
            camera: { label: "Ăng-ten", placeholder: "VD: 4 ăng-ten ngoài" },
            operatingSystem: { label: "Quản lý", placeholder: "VD: App Tether / Web UI" }
        },
        detailSpecsPlaceholder: "VD: Chuẩn Wi-Fi: 802.11ax"
    },
    {
        keywords: ["phu kien", "accessory", "hub", "dock", "cap", "adapter"],
        fields: {
            cpu: { label: "Loại phụ kiện", placeholder: "VD: Dock USB-C / Cáp sạc" },
            ram: { label: "Chất liệu", placeholder: "VD: Hợp kim nhôm / Nhựa ABS" },
            storage: { label: "Kết nối", placeholder: "VD: USB-C / Lightning / 3.5mm" },
            gpu: { label: "Tương thích thiết bị", placeholder: "VD: Laptop / Điện thoại / Tablet" },
            screen: { label: "Màu sắc", placeholder: "VD: Đen / Xám" },
            battery: { label: "Công suất / Dung lượng", placeholder: "VD: PD 65W / 10.000mAh" },
            camera: { label: "Kích thước", placeholder: "VD: 120 x 55 x 12 mm" },
            operatingSystem: { label: "Bảo hành", placeholder: "VD: 12 tháng" }
        },
        detailSpecsPlaceholder: "VD: Công suất sạc: 65W PD"
    },
    {
        keywords: ["dien thoai", "smartphone", "phone"],
        fields: {
            cpu: { label: "Chip xử lý", placeholder: "VD: Snapdragon 8 Gen 3 / Apple A18" },
            ram: { label: "RAM", placeholder: "VD: 8GB / 12GB" },
            storage: { label: "Bộ nhớ trong", placeholder: "VD: 256GB / 512GB" },
            gpu: { label: "GPU", placeholder: "VD: Adreno / Apple GPU" },
            screen: { label: "Màn hình", placeholder: "VD: AMOLED 120Hz" },
            battery: { label: "Pin", placeholder: "VD: 5000mAh, sạc nhanh 67W" },
            camera: { label: "Camera", placeholder: "VD: 50MP + 12MP + 10MP" },
            operatingSystem: { label: "Hệ điều hành", placeholder: "VD: Android 15 / iOS" }
        },
        detailSpecsPlaceholder: "VD: Camera chính: 50MP OIS"
    }
];

// Server-side paging states for large admin datasets.
const DEFAULT_ADMIN_PAGE_SIZE = 10;
const ordersPageState = { page: 0, size: DEFAULT_ADMIN_PAGE_SIZE, totalPages: 0, totalElements: 0, sortDir: "asc" };
const productsPageState = { page: 0, size: DEFAULT_ADMIN_PAGE_SIZE, totalPages: 0, totalElements: 0, sortDir: "asc", categoryId: "" };
const usersPageState = { page: 0, size: DEFAULT_ADMIN_PAGE_SIZE, totalPages: 0, totalElements: 0, sortDir: "asc" };

const SUPPORT_MESSAGES_POLL_MS = 8000;

const VIEWS = ["dashboard", "orders", "products", "categories", "promotions", "banners", "messages", "users"];
const ORDER_STATUS_FLOW = ["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCEL_REQUESTED", "CANCELLED"];
// tác dụng code: các view quản trị dùng chung cấu hình này để điều hướng và render trạng thái đơn hàng.

function token() {
    return localStorage.getItem("techstore_token");
}

function role() {
    return localStorage.getItem("techstore_role");
}

function username() {
    return localStorage.getItem("techstore_user");
}

function isSuperAdmin() {
    return role() === "SUPER_ADMIN";
}

function authHeaders() {
    const t = token();
    return t ? { Authorization: `Bearer ${t}` } : {};
}

function ensureAdmin() {
    // Chỉ cho phép ADMIN hoặc SUPER_ADMIN vào dashboard.
    const r = role();
    if (!(r === "ADMIN" || r === "SUPER_ADMIN")) {
        window.location.href = "/login";
        return false;
    }
    return true;
}

function formatVnd(value) {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND"
    }).format(value || 0);
}

function formatVndAxisLabel(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) {
        return "0 đ";
    }

    const abs = Math.abs(num);
    const formatCompact = (divisor, unit) => {
        const compact = num / divisor;
        const maxDigits = abs >= divisor * 10 ? 0 : 1;
        return `${compact.toLocaleString("vi-VN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: maxDigits
        })} ${unit}`;
    };

    if (abs >= 1_000_000_000) {
        return formatCompact(1_000_000_000, "tỷ");
    }
    if (abs >= 1_000_000) {
        return formatCompact(1_000_000, "triệu");
    }
    if (abs >= 1_000) {
        return formatCompact(1_000, "nghìn");
    }
    return `${Math.round(num).toLocaleString("vi-VN")} đ`;
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

function resolveProductPricing(product) {
    const source = product || {};
    const originalPrice = Math.max(0, Number(source.price || 0));
    const discountPercent = normalizeDiscountPercent(source.discountPercent);

    const backendFinal = Number(source.finalPrice);
    const finalPrice = Number.isFinite(backendFinal)
        ? Math.max(0, backendFinal)
        : calculateDiscountedPrice(originalPrice, discountPercent);

    const hasDiscount = discountPercent > 0 && finalPrice < originalPrice;
    return {
        originalPrice,
        discountPercent,
        finalPrice: hasDiscount ? finalPrice : originalPrice,
        hasDiscount
    };
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
    setTimeout(() => holder.classList.remove("show"), 1400);
}

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

async function fetchJson(url, options = {}) {
    // Wrapper fetch an toàn cho cả JSON và response rỗng.
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
        // Token hết hạn/không hợp lệ: dọn session và chuyển về trang đăng nhập.
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

function normalizeText(value) {
    // Bỏ dấu tiếng Việt để tìm kiếm linh hoạt hơn.
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function parseMultiline(value) {
    // Tách chuỗi nhiều dòng thành mảng sạch để xử lý danh sách URL/spec.
    return String(value || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

function getVietnameseConstraintMessage(field) {
    if (!field || !field.validity) {
        return "Thông tin không hợp lệ.";
    }

    const validity = field.validity;
    const customRequiredMessage = String(field.getAttribute("data-required-message") || "").trim();

    if (validity.valueMissing) {
        return customRequiredMessage || "Vui lòng điền vào trường này.";
    }

    if (validity.typeMismatch) {
        if (field.type === "email") {
            return "Vui lòng nhập địa chỉ email hợp lệ.";
        }
        if (field.type === "url") {
            return "Vui lòng nhập đường dẫn hợp lệ.";
        }
        return "Vui lòng nhập đúng định dạng.";
    }

    if (validity.patternMismatch) {
        return "Vui lòng nhập đúng định dạng yêu cầu.";
    }

    if (validity.tooShort) {
        const minLength = Number(field.getAttribute("minlength")) || field.minLength;
        return minLength > 0
            ? `Vui lòng nhập ít nhất ${minLength} ký tự.`
            : "Dữ liệu nhập vào quá ngắn.";
    }

    if (validity.tooLong) {
        const maxLength = Number(field.getAttribute("maxlength")) || field.maxLength;
        return maxLength > 0
            ? `Vui lòng không nhập quá ${maxLength} ký tự.`
            : "Dữ liệu nhập vào quá dài.";
    }

    if (validity.rangeUnderflow) {
        const minValue = field.getAttribute("min");
        return minValue ? `Giá trị phải lớn hơn hoặc bằng ${minValue}.` : "Giá trị nhập vào quá nhỏ.";
    }

    if (validity.rangeOverflow) {
        const maxValue = field.getAttribute("max");
        return maxValue ? `Giá trị phải nhỏ hơn hoặc bằng ${maxValue}.` : "Giá trị nhập vào quá lớn.";
    }

    if (validity.stepMismatch || validity.badInput) {
        return "Vui lòng nhập giá trị hợp lệ.";
    }

    return "Thông tin không hợp lệ.";
}

function bindVietnameseConstraintValidation(root = document) {
    if (!root) {
        return;
    }

    const fields = root.querySelectorAll("input, select, textarea");
    fields.forEach((field) => {
        if (field.dataset.vnValidationBound === "1") {
            return;
        }
        field.dataset.vnValidationBound = "1";

        field.addEventListener("invalid", () => {
            field.setCustomValidity(getVietnameseConstraintMessage(field));
        });

        const clearCustomValidity = () => {
            field.setCustomValidity("");
        };

        field.addEventListener("input", clearCustomValidity);
        field.addEventListener("change", clearCustomValidity);
    });
}

function normalizeSpecsText(value) {
    return String(value || "")
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");
}

function getProductDetailSpecsTextarea() {
    return document.getElementById("product-detail-specs");
}

function readProductDetailSpecs() {
    if (productSpecsEditor) {
        return normalizeSpecsText(productSpecsEditor.getText());
    }

    const textarea = getProductDetailSpecsTextarea();
    return normalizeSpecsText(textarea ? textarea.value : "");
}

function syncProductDetailSpecsTextarea() {
    const textarea = getProductDetailSpecsTextarea();
    if (!textarea) {
        return;
    }

    textarea.value = readProductDetailSpecs();
}

function writeProductDetailSpecs(value) {
    const normalized = normalizeSpecsText(value);
    const textarea = getProductDetailSpecsTextarea();
    if (textarea) {
        textarea.value = normalized;
    }

    if (!productSpecsEditor) {
        return;
    }

    const current = normalizeSpecsText(productSpecsEditor.getText());
    if (current !== normalized) {
        productSpecsEditor.setText(normalized);
    }
    syncProductDetailSpecsTextarea();
}

function initProductSpecsEditor() {
    const editorRoot = document.getElementById("product-detail-specs-editor");
    const textarea = getProductDetailSpecsTextarea();
    if (!editorRoot || !textarea) {
        return;
    }

    if (typeof Quill === "undefined") {
        editorRoot.hidden = true;
        textarea.hidden = false;
        return;
    }

    editorRoot.hidden = false;
    textarea.hidden = true;

    if (!productSpecsEditor) {
        productSpecsEditor = new Quill(editorRoot, {
            theme: "snow",
            placeholder: "Mỗi dòng 1 thông số, ví dụ: RAM: 16GB",
            modules: {
                toolbar: [
                    ["bold", "italic", "underline"],
                    [{ list: "ordered" }, { list: "bullet" }],
                    ["clean"]
                ]
            }
        });
        productSpecsEditor.on("text-change", syncProductDetailSpecsTextarea);
    }

    writeProductDetailSpecs(textarea.value || "");
}

function clearProductSpecFields() {
    PRODUCT_SPEC_FIELD_IDS.forEach((id) => {
        const input = document.getElementById(id);
        if (input) {
            input.value = "";
        }
    });
    refreshProductQuickSpecsFromDefaultFields();
}

function fillProductSpecFields(product) {
    const source = product || {};
    Object.keys(PRODUCT_SPEC_FIELD_MAP).forEach((fieldId) => {
        const input = document.getElementById(fieldId);
        if (!input) {
            return;
        }

        const productKey = PRODUCT_SPEC_FIELD_MAP[fieldId];
        input.value = source[productKey] || "";
    });
    refreshProductQuickSpecsFromDefaultFields({ keepCurrent: true });
}

function readProductSpecFields() {
    const payload = {};
    Object.keys(PRODUCT_SPEC_FIELD_MAP).forEach((fieldId) => {
        const productKey = PRODUCT_SPEC_FIELD_MAP[fieldId];
        const input = document.getElementById(fieldId);
        payload[productKey] = String(input ? input.value : "").trim();
    });
    return payload;
}

function resolveProductCategoryNameById(categoryId) {
    const id = Number(categoryId || 0);
    if (!Number.isFinite(id) || id <= 0) {
        return "";
    }
    const found = categoriesCache.find((category) => Number(category && category.id ? category.id : 0) === id);
    return found && found.name ? String(found.name) : "";
}

function getSelectedProductCategoryName() {
    const categoryEl = document.getElementById("product-category");
    if (!categoryEl) {
        return "";
    }
    return resolveProductCategoryNameById(categoryEl.value);
}

function resolveProductSpecUiProfile(categoryName) {
    const normalizedCategory = normalizeText(categoryName);
    const matchedProfile = PRODUCT_SPEC_UI_BY_CATEGORY.find((profile) =>
        Array.isArray(profile.keywords)
        && profile.keywords.some((keyword) => {
            const normalizedKeyword = normalizeText(keyword);
            return normalizedKeyword && normalizedCategory.includes(normalizedKeyword);
        })
    ) || null;

    const mergedFields = {};
    Object.keys(PRODUCT_SPEC_UI_DEFAULT.fields).forEach((specKey) => {
        const defaultField = PRODUCT_SPEC_UI_DEFAULT.fields[specKey] || {};
        const overrideField = matchedProfile && matchedProfile.fields ? (matchedProfile.fields[specKey] || {}) : {};
        mergedFields[specKey] = {
            label: overrideField.label || defaultField.label || specKey,
            placeholder: overrideField.placeholder || defaultField.placeholder || ""
        };
    });

    const quickSpecPriority = PRODUCT_QUICK_SPEC_PRIORITY.map(([specKey, defaultLabel]) => {
        const merged = mergedFields[specKey];
        return [specKey, merged && merged.label ? merged.label : defaultLabel];
    });

    return {
        fields: mergedFields,
        detailSpecsPlaceholder: matchedProfile && matchedProfile.detailSpecsPlaceholder
            ? matchedProfile.detailSpecsPlaceholder
            : PRODUCT_SPEC_UI_DEFAULT.detailSpecsPlaceholder,
        quickSpecPriority
    };
}

function applyProductSpecUiByCategoryName(categoryName) {
    const uiProfile = resolveProductSpecUiProfile(categoryName);

    Object.keys(PRODUCT_SPEC_FIELD_MAP).forEach((fieldId) => {
        const specKey = PRODUCT_SPEC_FIELD_MAP[fieldId];
        const fieldUi = uiProfile.fields[specKey];
        if (!fieldUi) {
            return;
        }

        const labelEl = document.querySelector(`label[for="${fieldId}"]`);
        if (labelEl) {
            labelEl.textContent = fieldUi.label;
        }

        const inputEl = document.getElementById(fieldId);
        if (inputEl) {
            inputEl.placeholder = fieldUi.placeholder || "";
        }
    });

    const detailSpecsTextarea = getProductDetailSpecsTextarea();
    if (detailSpecsTextarea) {
        detailSpecsTextarea.placeholder = uiProfile.detailSpecsPlaceholder || PRODUCT_DETAIL_SPECS_DEFAULT_PLACEHOLDER;
    }

    const editorRoot = document.getElementById("product-detail-specs-editor");
    if (editorRoot) {
        const qlEditor = editorRoot.querySelector(".ql-editor");
        if (qlEditor) {
            qlEditor.setAttribute(
                "data-placeholder",
                uiProfile.detailSpecsPlaceholder || PRODUCT_DETAIL_SPECS_DEFAULT_PLACEHOLDER
            );
        }
    }

    return uiProfile;
}

function applyProductSpecUiFromSelectedCategory() {
    return applyProductSpecUiByCategoryName(getSelectedProductCategoryName());
}

function buildQuickSpecsFromDefaultFields(specPayload, quickSpecPriority = PRODUCT_QUICK_SPEC_PRIORITY) {
    const source = specPayload || {};
    const out = [];

    (quickSpecPriority || PRODUCT_QUICK_SPEC_PRIORITY).forEach(([key, label]) => {
        const value = String(source[key] || "").trim();
        if (!value) {
            return;
        }
        out.push(`${label}: ${value}`);
    });

    return out.slice(0, 6);
}

function refreshProductQuickSpecsFromDefaultFields(options = {}) {
    const quickSpecsEl = document.getElementById("product-quick-specs");
    if (!quickSpecsEl) {
        return;
    }

    const currentUiProfile = resolveProductSpecUiProfile(getSelectedProductCategoryName());
    const generated = buildQuickSpecsFromDefaultFields(
        readProductSpecFields(),
        currentUiProfile.quickSpecPriority
    );
    if (generated.length > 0) {
        quickSpecsEl.value = generated.join("\n");
        return;
    }

    if (options.keepCurrent === true) {
        return;
    }

    quickSpecsEl.value = options.fallback || "";
}

function includesKeyword(haystack, keyword) {
    if (!keyword) {
        return true;
    }
    return normalizeText(haystack).includes(keyword);
}

function getKeywordFromInput(id) {
    const el = document.getElementById(id);
    return normalizeText(el ? el.value : "");
}

function getRawInputValue(id) {
    const el = document.getElementById(id);
    return String(el ? el.value : "").trim();
}

function isValidBannerImageUrl(url) {
    const value = String(url || "").trim();
    if (!value) {
        return false;
    }
    return value.startsWith("http://")
        || value.startsWith("https://")
        || value.startsWith("/uploads/");
}

function isValidBannerTargetUrl(url) {
    const value = String(url || "").trim();
    if (!value) {
        return true;
    }
    return value.startsWith("http://")
        || value.startsWith("https://")
        || value.startsWith("/")
        || value.startsWith("#");
}

function normalizeProductSortDir(value) {
    return String(value || "").toLowerCase() === "desc" ? "desc" : "asc";
}

function normalizeUserSortDir(value) {
    return String(value || "").toLowerCase() === "desc" ? "desc" : "asc";
}

function normalizeOrderSortDir(value) {
    return String(value || "").toLowerCase() === "desc" ? "desc" : "asc";
}

function normalizeIdSortDir(value) {
    return String(value || "").toLowerCase() === "desc" ? "desc" : "asc";
}

function applyPageState(state, payload) {
    // Keep pagination metadata in one place so all views (orders/products/users) behave consistently.
    state.totalPages = Number(payload && payload.totalPages ? payload.totalPages : 0);
    state.totalElements = Number(payload && payload.totalElements ? payload.totalElements : 0);

    // Normalize page index when result set becomes empty after filtering/deleting.
    if (state.totalPages <= 0) {
        state.page = 0;
    }
}

function renderPagination(prefix, state) {
    const infoEl = document.getElementById(`${prefix}-page-info`);
    const prevBtn = document.getElementById(`${prefix}-page-prev`);
    const nextBtn = document.getElementById(`${prefix}-page-next`);

    if (!infoEl || !prevBtn || !nextBtn) {
        return;
    }

    const hasData = state.totalElements > 0;
    const currentPage = hasData ? state.page + 1 : 0;
    const totalPages = hasData ? state.totalPages : 0;

    infoEl.textContent = hasData
        ? `Trang ${currentPage}/${totalPages} • ${state.totalElements} bản ghi`
        : "Không có dữ liệu";

    prevBtn.disabled = state.page <= 0;
    nextBtn.disabled = !hasData || state.page >= state.totalPages - 1;
}

function bindPaginationButtons(prefix, state, loadFn) {
    const prevBtn = document.getElementById(`${prefix}-page-prev`);
    const nextBtn = document.getElementById(`${prefix}-page-next`);
    if (!prevBtn || !nextBtn) {
        return;
    }

    prevBtn.addEventListener("click", async () => {
        if (state.page <= 0) {
            return;
        }

        state.page -= 1;
        await loadFn();
    });

    nextBtn.addEventListener("click", async () => {
        if (state.page >= state.totalPages - 1) {
            return;
        }

        state.page += 1;
        await loadFn();
    });
}

function bindRemoteSearchInput(id, onKeywordChange) {
    const input = document.getElementById(id);
    if (!input) {
        return;
    }

    let timer = null;
    input.addEventListener("input", () => {
        if (timer) {
            clearTimeout(timer);
        }

        // Debounce to avoid firing an API request on every keystroke.
        timer = setTimeout(async () => {
            try {
                await onKeywordChange();
            } catch (err) {
                alert(err.message);
            }
        }, 320);
    });
}

function renderEmptyRow(tbody, colSpan, message) {
    if (!tbody) {
        return;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="${colSpan}" class="muted" style="text-align:center;">${escapeHtml(message)}</td>`;
    tbody.appendChild(tr);
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
            return "Khách yêu cầu hủy";
        case "CANCELLED":
            return "Đã hủy";
        default:
            return status || "";
    }
}

function statusPillClass(status) {
    switch (status) {
        case "DELIVERED":
            return "success";
        case "SHIPPING":
            return "info";
        case "CONFIRMED":
            return "warn";
        case "CANCEL_REQUESTED":
            return "warn";
        case "CANCELLED":
            return "danger";
        default:
            return "neutral";
    }
}

function paymentLabel(method) {
    switch (method) {
        case "ONLINE_GATEWAY":
            return "Thanh toán online";
        case "BANK_TRANSFER":
            return "Chuyển khoản";
        case "COD":
        default:
            return "COD";
    }
}

function paymentProviderLabel(provider) {
    if (!provider) {
        return "N/A";
    }
    if (provider === "MOCK_GATEWAY" || provider === "MOCK") {
        return "Không còn hỗ trợ";
    }
    if (provider === "VNPAY") {
        return "VNPay";
    }
    if (provider === "MOMO") {
        return "MoMo";
    }
    return provider;
}

function onlinePaymentStatusLabel(status) {
    switch (status) {
        case "NOT_REQUIRED":
            return "Chưa thanh toán";
        case "PENDING":
            return "Chưa thanh toán";
        case "PAID":
            return "Đã thanh toán";
        case "FAILED":
            return "Thất bại";
        default:
            return status || "";
    }
}

function resolveOrderPaymentStatus(order) {
    if (!order) {
        return "PENDING";
    }

    const rawStatus = String(order.onlinePaymentStatus || "").trim().toUpperCase();
    if (rawStatus === "NOT_REQUIRED") {
        return "PENDING";
    }
    if (rawStatus === "PENDING" || rawStatus === "PAID" || rawStatus === "FAILED") {
        return rawStatus;
    }

    if (order.status === "DELIVERED") {
        return "PAID";
    }

    return "PENDING";
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

function normalizeOrderHistoryNote(note) {
    const raw = typeof note === "string" ? note.trim() : "";
    if (!raw) {
        return "";
    }

    const normalizedMap = {
        "Don hang duoc tao": "\u0110\u01a1n h\u00e0ng \u0111\u01b0\u1ee3c t\u1ea1o",
        "Admin cap nhat trang thai don": "Admin c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i \u0111\u01a1n",
        "Admin da duyet huy don": "Admin \u0111\u00e3 duy\u1ec7t h\u1ee7y \u0111\u01a1n",
        "He thong tu dong huy don vi het han thanh toan online": "H\u1ec7 th\u1ed1ng t\u1ef1 \u0111\u1ed9ng h\u1ee7y \u0111\u01a1n v\u00ec h\u1ebft h\u1ea1n thanh to\u00e1n online",
        "He thong dong bo don online that bai ve trang thai da huy": "H\u1ec7 th\u1ed1ng \u0111\u1ed3ng b\u1ed9 \u0111\u01a1n online th\u1ea5t b\u1ea1i v\u1ec1 tr\u1ea1ng th\u00e1i \u0111\u00e3 h\u1ee7y",
        "Khach gui yeu cau huy don": "Kh\u00e1ch g\u1eedi y\u00eau c\u1ea7u h\u1ee7y \u0111\u01a1n",
        "Khach gui yeu cau huy": "Kh\u00e1ch g\u1eedi y\u00eau c\u1ea7u h\u1ee7y",
        "VNPay return sai so tien": "VNPay tr\u1ea3 v\u1ec1 sai s\u1ed1 ti\u1ec1n.",
        "VNPay return sai so tien.": "VNPay tr\u1ea3 v\u1ec1 sai s\u1ed1 ti\u1ec1n.",
        "VNPay return thanh cong": "VNPay tr\u1ea3 v\u1ec1 th\u00e0nh c\u00f4ng.",
        "VNPay return thanh cong.": "VNPay tr\u1ea3 v\u1ec1 th\u00e0nh c\u00f4ng.",
        "VNPay return that bai": "VNPay tr\u1ea3 v\u1ec1 th\u1ea5t b\u1ea1i.",
        "VNPay return that bai.": "VNPay tr\u1ea3 v\u1ec1 th\u1ea5t b\u1ea1i.",
        "VNPay IPN thanh cong": "VNPay IPN x\u00e1c nh\u1eadn th\u00e0nh c\u00f4ng.",
        "VNPay IPN thanh cong.": "VNPay IPN x\u00e1c nh\u1eadn th\u00e0nh c\u00f4ng.",
        "VNPay IPN that bai": "VNPay IPN x\u00e1c nh\u1eadn th\u1ea5t b\u1ea1i.",
        "VNPay IPN that bai.": "VNPay IPN x\u00e1c nh\u1eadn th\u1ea5t b\u1ea1i."
    };

    if (Object.prototype.hasOwnProperty.call(normalizedMap, raw)) {
        return normalizedMap[raw];
    }

    const cancelPrefix = "Khach gui yeu cau huy:";
    if (raw.startsWith(cancelPrefix)) {
        const reason = raw.slice(cancelPrefix.length).trim();
        return reason
            ? `Kh\u00e1ch g\u1eedi y\u00eau c\u1ea7u h\u1ee7y: ${reason}`
            : normalizedMap["Khach gui yeu cau huy"];
    }

    return raw;
}

function buildOrderHistoryTimeline(history) {
    if (!Array.isArray(history) || history.length === 0) {
        return `
            <div class="timeline">
                <div class="t-step active">
                    <div class="t-dot"></div>
                    <div>
                        <div class="t-title">Chưa có lịch sử cập nhật</div>
                        <div class="muted">Dữ liệu timeline chưa được ghi nhận cho đơn này.</div>
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="timeline">
            ${history.map((entry, index) => {
                const isLatest = index === history.length - 1;
                const cls = isLatest ? "active" : "done";

                const fromLabel = entry.fromStatus ? orderStatusLabel(entry.fromStatus) : "Khởi tạo";
                const toLabel = orderStatusLabel(entry.toStatus);
                const title = `${fromLabel} -> ${toLabel}`;

                const normalizedNote = normalizeOrderHistoryNote(entry.note);
                const note = normalizedNote ? `<div class="muted">${escapeHtml(normalizedNote)}</div>` : "";
                const actor = entry.changedBy ? `Bởi: ${escapeHtml(entry.changedBy)}` : "";
                const at = entry.createdAt ? `Lúc: ${escapeHtml(formatDateTime(entry.createdAt))}` : "";
                const meta = [actor, at].filter(Boolean).join(" · ");
                const metaHtml = meta ? `<div class="muted">${meta}</div>` : "";

                return `
                    <div class="t-step ${cls}">
                        <div class="t-dot"></div>
                        <div>
                            <div class="t-title">${escapeHtml(title)}</div>
                            ${note}
                            ${metaHtml}
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function currentViewFromHash() {
    const raw = (window.location.hash || "").replace("#", "").trim();
    return VIEWS.includes(raw) ? raw : "dashboard";
}

function showView(view) {
    VIEWS.forEach((v) => {
        const section = document.getElementById(`view-${v}`);
        if (section) {
            section.hidden = v !== view;
        }
    });

    const menu = document.getElementById("admin-menu");
    if (!menu) {
        return;
    }

    menu.querySelectorAll(".admin-menu-item").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-view") === view);
    });
}

function showListPanel(viewKey) {
    const listPanel = document.getElementById(`${viewKey}-list-panel`);
    const editPanel = document.getElementById(`${viewKey}-edit-panel`);
    if (!listPanel || !editPanel) {
        return;
    }

    listPanel.hidden = false;
    editPanel.hidden = true;
}

function showEditPanel(viewKey) {
    const listPanel = document.getElementById(`${viewKey}-list-panel`);
    const editPanel = document.getElementById(`${viewKey}-edit-panel`);
    if (!listPanel || !editPanel) {
        return;
    }

    listPanel.hidden = true;
    editPanel.hidden = false;
}

function findById(cache, id) {
    return cache.find((item) => Number(item.id) === Number(id));
}

function actionIcon(pathA, pathB = "") {
    // Helper để tạo icon SVG thống nhất cho các nút thao tác trong bảng.
    const extra = pathB ? `<path d="${pathB}"></path>` : "";
    return `
        <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="${pathA}"></path>${extra}</svg>
        </span>
    `;
}

async function loadStats() {
    const stats = await fetchJson("/api/admin/dashboard/stats", {
        headers: {
            ...authHeaders()
        }
    });

    const totalOrders = document.getElementById("total-orders");
    const totalCustomers = document.getElementById("total-customers");
    const deliveredOrders = document.getElementById("delivered-orders");
    const pendingOrders = document.getElementById("pending-orders");
    const revenue = document.getElementById("revenue");

    if (totalOrders) totalOrders.textContent = stats.totalOrders;
    if (totalCustomers) totalCustomers.textContent = stats.totalCustomers;
    if (deliveredOrders) deliveredOrders.textContent = stats.deliveredOrders;
    if (pendingOrders) pendingOrders.textContent = stats.pendingOrders;
    if (revenue) revenue.textContent = formatVnd(stats.deliveredRevenue);

    renderOrderStatusChart(stats);
    await loadRevenueDetail();
}

function renderOrderStatusChart(stats) {
    const canvas = document.getElementById("ordersChart");
    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
        return;
    }

    if (ordersChart) {
        ordersChart.destroy();
    }

    ordersChart = new Chart(context, {
        type: "doughnut",
        data: {
            labels: ["\u0110\u00e3 giao", "\u0110ang ch\u1edd"],
            datasets: [{
                data: [stats.deliveredOrders, stats.pendingOrders],
                backgroundColor: ["#0f9d58", "#ff7a18"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "58%",
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

function readRevenueDaysFilter() {
    const el = document.getElementById("revenue-range-days");
    const days = Number(el ? el.value : 30);
    if (!Number.isFinite(days)) {
        return 30;
    }
    return Math.max(7, Math.min(365, Math.round(days)));
}

function readRevenueGroupByFilter() {
    const el = document.getElementById("revenue-group-by");
    const value = String(el ? el.value : "day").trim().toLowerCase();
    if (value === "week" || value === "month") {
        return value;
    }
    return "day";
}

function readRevenueChartType() {
    // tac dung code: chon kieu bieu do de doi giao dien nhanh (line/area/bar) ma khong doi du lieu backend.
    const el = document.getElementById("revenue-chart-type");
    const value = String(el ? el.value : "line").trim().toLowerCase();
    if (value === "bar" || value === "area") {
        return value;
    }
    return "line";
}

function setRevenueSummary(detail) {
    const totalEl = document.getElementById("revenue-period-total");
    const ordersEl = document.getElementById("revenue-period-orders");
    const ordersLabelEl = document.getElementById("revenue-period-orders-label");
    const avgEl = document.getElementById("revenue-period-aov");
    const growthEl = document.getElementById("revenue-period-growth");
    const peakEl = document.getElementById("revenue-period-peak");

    if (totalEl) totalEl.textContent = formatVnd(detail.totalRevenue || 0);
    if (ordersEl) ordersEl.textContent = String(detail.deliveredOrders || 0);
    if (ordersLabelEl) {
        const days = Number(detail.days);
        if (Number.isFinite(days) && days > 0) {
            ordersLabelEl.textContent = `Số đơn đã giao (${Math.round(days)} ngày)`;
        } else {
            ordersLabelEl.textContent = "Số đơn đã giao trong kỳ chọn";
        }
    }
    if (avgEl) avgEl.textContent = formatVnd(detail.averageOrderValue || 0);

    if (growthEl) {
        const growth = Number(detail.growthPercent || 0);
        const sign = growth > 0 ? "+" : "";
        growthEl.textContent = `${sign}${growth.toFixed(1)}%`;
        growthEl.classList.remove("growth-up", "growth-down");
        if (growth > 0.05) {
            growthEl.classList.add("growth-up");
        } else if (growth < -0.05) {
            growthEl.classList.add("growth-down");
        }
    }

    if (peakEl) {
        const peakLabel = detail.peakLabel || "-";
        const peakRevenue = Number(detail.peakRevenue || 0);
        peakEl.textContent = peakRevenue > 0 ? `${peakLabel} - ${formatVnd(peakRevenue)}` : "-";
    }
}

function renderRevenueChart(detail) {
    const canvas = document.getElementById("revenueChart");
    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
        return;
    }

    const points = Array.isArray(detail.points) ? detail.points : [];
    const labels = points.map((point) => point.label || "-");
    const revenues = points.map((point) => Number(point.revenue || 0));
    const chartType = readRevenueChartType();

    if (revenueChart) {
        revenueChart.destroy();
        revenueChart = null;
    }

    if (!points.length) {
        setMessage("revenue-chart-msg", "Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u doanh thu trong kho\u1ea3ng \u0111\u00e3 ch\u1ecdn.", "warn");
        return;
    }

    const useBar = chartType === "bar";
    const useArea = chartType === "area";

    try {
        // tac dung code: dung 1 dataset duy nhat tranh loi mixed chart va giu do thi on dinh tren moi kich thuoc man hinh.
        revenueChart = new Chart(context, {
            type: useBar ? "bar" : "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Doanh thu",
                        data: revenues,
                        borderColor: "#0ea5e9",
                        backgroundColor: useBar ? "rgba(14, 165, 233, 0.55)" : "rgba(14, 165, 233, 0.20)",
                        borderWidth: 2,
                        fill: useArea,
                        tension: useBar ? 0 : 0.3,
                        borderRadius: useBar ? 8 : 0,
                        maxBarThickness: useBar ? 26 : undefined,
                        pointRadius: useBar ? 0 : 2.8,
                        pointHoverRadius: useBar ? 0 : 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 8,
                        right: 8,
                        bottom: 2
                    }
                },
                interaction: {
                    mode: "index",
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            color: "#0f172a",
                            boxWidth: 14,
                            boxHeight: 14,
                            font: {
                                size: 12,
                                weight: "600"
                            }
                        }
                    },
                    tooltip: {
                        titleFont: {
                            size: 12,
                            weight: "700"
                        },
                        bodyFont: {
                            size: 12,
                            weight: "600"
                        },
                        callbacks: {
                            label(context) {
                                const label = context.dataset.label || "Doanh thu";
                                const rawValue = context.parsed && typeof context.parsed === "object"
                                    ? context.parsed.y
                                    : context.parsed;
                                return `${label}: ${formatVnd(Number(rawValue || 0))}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: "#0f172a",
                            font: {
                                size: 12,
                                weight: "600"
                            },
                            maxTicksLimit: 7,
                            padding: 8,
                            callback(value) {
                                return formatVndAxisLabel(Number(value || 0));
                            }
                        },
                        grid: {
                            color: "rgba(148, 163, 184, 0.24)"
                        }
                    },
                    x: {
                        grid: {
                            color: "rgba(148, 163, 184, 0.12)"
                        },
                        ticks: {
                            color: "#334155",
                            font: {
                                size: 11,
                                weight: "600"
                            },
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    }
                }
            }
        });
    } catch (err) {
        console.error("Revenue chart render failed", err);
        setMessage("revenue-chart-msg", "Kh\u00f4ng th\u1ec3 v\u1ebd bi\u1ec3u \u0111\u1ed3 doanh thu. Vui l\u00f2ng t\u1ea3i l\u1ea1i trang.", "error");
    }
}

async function loadRevenueDetail() {
    setMessage("revenue-chart-msg", "", "");
    const days = readRevenueDaysFilter();
    const groupBy = readRevenueGroupByFilter();

    try {
        const detail = await fetchJson(`/api/admin/dashboard/revenue-detail?days=${days}&groupBy=${encodeURIComponent(groupBy)}`, {
            headers: {
                ...authHeaders()
            }
        });

        setRevenueSummary(detail || {});
        renderRevenueChart(detail || {});
    } catch (err) {
        setMessage("revenue-chart-msg", err.message, "error");
    }
}

function buildStatusOptions(selected) {
    return ORDER_STATUS_FLOW
        .map((status) => `<option value="${status}" ${status === selected ? "selected" : ""}>${orderStatusLabel(status)}</option>`)
        .join("");
}

// -----------------------------
// Orders (Đơn hàng)
// -----------------------------

function renderOrdersTable() {
    const tbody = document.getElementById("orders-body");
    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";
    if (!ordersCache.length) {
        renderEmptyRow(tbody, 10, "Không có đơn hàng phù hợp");
        return;
    }

    ordersCache.forEach((order) => {
        const effectivePaymentStatus = resolveOrderPaymentStatus(order);
        const isPaid = effectivePaymentStatus === "PAID";
        const cannotDeleteByShippingState = order.status === "SHIPPING" || order.status === "DELIVERED";
        const cannotDelete = cannotDeleteByShippingState || isPaid;
        const deleteTitle = cannotDelete
            ? (cannotDeleteByShippingState
                ? "Đơn đang giao hoặc đã giao không thể xóa."
                : "Đơn đã thanh toán không thể xóa.")
            : "Xóa đơn hàng";
        const paymentMethodText = paymentLabel(order.paymentMethod);
        const providerText = order.paymentProvider ? paymentProviderLabel(order.paymentProvider) : "N/A";
        const paymentStatusText = onlinePaymentStatusLabel(effectivePaymentStatus);
        const paymentReferenceText = order.paymentReference ? order.paymentReference : "-";
        const createdAtText = order.createdAt ? formatDateTime(order.createdAt) : "";
        const paidAtText = order.paidAt
            ? escapeHtml(formatDateTime(order.paidAt))
            : "<span class=\"muted\">Chưa thanh toán</span>";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>#${order.id}</td>
            <td>${order.customerUsername ? escapeHtml(order.customerUsername) : "N/A"}</td>
            <td>${formatVnd(order.totalPrice)}</td>
            <td>
                <div><strong>${escapeHtml(paymentMethodText)}</strong></div>
                <div class="muted">${escapeHtml(providerText)}</div>
            </td>
            <td><code>${escapeHtml(paymentReferenceText)}</code></td>
            <td>
                <span class="status-pill ${paymentStatusPillClass(effectivePaymentStatus)}">${escapeHtml(paymentStatusText)}</span>
            </td>
            <td>
                <select class="select orders-status-select" data-order-status="${escapeHtml(order.status)}" onchange="handleOrderStatusChange(${order.id}, this)">
                    ${buildStatusOptions(order.status)}
                </select>
            </td>
            <td>${escapeHtml(createdAtText)}</td>
            <td>${paidAtText}</td>
            <td class="col-center">
                <div class="table-actions">
                    <a class="btn btn-outline btn-sm action-btn action-btn-view" href="/admin/orders/${order.id}">
                        ${actionIcon("M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6")}
                        <span>Xem</span>
                    </a>
                    <button class="btn btn-danger btn-sm action-btn action-btn-delete" type="button" data-action="order-delete" data-id="${order.id}" title="${escapeHtml(deleteTitle)}" ${cannotDelete ? "disabled" : ""}>
                        ${actionIcon("M3 6h18", "M8 6V4h8v2M6 6l1 14h10l1-14")}
                        <span>Xóa</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadOrders() {
    setMessage("orders-msg", "", "");
    const keyword = getRawInputValue("orders-search");
    const orderStatus = getRawInputValue("orders-status-filter");
    const paymentStatus = getRawInputValue("orders-payment-status-filter");
    const paymentProvider = getRawInputValue("orders-payment-provider-filter");
    const sortDir = normalizeOrderSortDir(getRawInputValue("orders-sort-id") || ordersPageState.sortDir);
    ordersPageState.sortDir = sortDir;

    const params = new URLSearchParams({
        page: String(ordersPageState.page),
        size: String(ordersPageState.size),
        sortDir
    });
    if (keyword) {
        params.set("keyword", keyword);
    }
    if (orderStatus) {
        params.set("status", orderStatus);
    }
    if (paymentStatus) {
        params.set("paymentStatus", paymentStatus);
    }
    if (paymentProvider) {
        params.set("paymentProvider", paymentProvider);
    }

    // Load only one page from backend to keep dashboard fast when order volume grows.
    let payload = await fetchJson(`/api/admin/orders/paged?${params.toString()}`, {
        headers: {
            ...authHeaders()
        }
    }) || {};

    applyPageState(ordersPageState, payload);

    // If current page becomes invalid (e.g. after delete/cancel), move to last available page and reload.
    if (ordersPageState.totalPages > 0 && ordersPageState.page > ordersPageState.totalPages - 1) {
        ordersPageState.page = ordersPageState.totalPages - 1;
        params.set("page", String(ordersPageState.page));
        payload = await fetchJson(`/api/admin/orders/paged?${params.toString()}`, {
            headers: {
                ...authHeaders()
            }
        }) || {};
        applyPageState(ordersPageState, payload);
    }

    ordersCache = Array.isArray(payload.items) ? payload.items : [];

    renderOrdersTable();
    renderPagination("orders", ordersPageState);
}

async function updateOrderStatus(orderId, status) {
    try {
        await fetchJson(`/api/admin/orders/${orderId}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders()
            },
            body: JSON.stringify({ status })
        });

        toast("Đã cập nhật trạng thái đơn hàng");
        await loadOrders();
        await loadStats(); // Refresh KPI/doanh thu sau khi cập nhật trạng thái.
    } catch (err) {
        setMessage("orders-msg", err.message, "error");
    }
}

async function deleteOrderById(orderId) {
    setMessage("orders-msg", "", "");

    try {
        const response = await fetchJson(`/api/admin/orders/${orderId}`, {
            method: "DELETE",
            headers: {
                ...authHeaders()
            }
        });

        toast(response && response.message ? response.message : "Đã xóa đơn hàng");
        await loadOrders();
        await loadStats(); // Refresh KPI/doanh thu sau khi xóa đơn.
    } catch (err) {
        setMessage("orders-msg", err.message, "error");
    }
}

function handleOrderStatusChange(orderId, selectEl) {
    if (!selectEl) {
        return;
    }

    const nextStatus = String(selectEl.value || "").trim();
    if (nextStatus) {
        selectEl.setAttribute("data-order-status", nextStatus);
    }
    updateOrderStatus(orderId, nextStatus);
}

async function openOrderModal(orderId) {
    const modal = document.getElementById("order-modal");
    const body = document.getElementById("order-modal-body");
    if (!modal || !body) {
        return;
    }

    body.innerHTML = `
        <div class="skeleton skeleton-line" style="height: 20px; width: 58%;"></div>
        <div class="skeleton skeleton-line" style="height: 16px; width: 72%; margin-top: 10px;"></div>
        <div class="skeleton skeleton-line" style="height: 16px; width: 68%; margin-top: 10px;"></div>
        <div class="skeleton skeleton-line" style="height: 16px; width: 74%; margin-top: 10px;"></div>
    `;

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    modal.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
        const detail = await fetchJson(`/api/admin/orders/${orderId}`, {
            headers: {
                ...authHeaders()
            }
        });

        const createdAt = detail.createdAt ? escapeHtml(formatDateTime(detail.createdAt)) : "";
        const shippingAddress = escapeHtml(detail.shippingAddress || "");
        const payment = escapeHtml(paymentLabel(detail.paymentMethod));
        const detailPaymentStatus = resolveOrderPaymentStatus(detail);
        const statusText = escapeHtml(orderStatusLabel(detail.status));
        const statusClass = statusPillClass(detail.status);
        const cancelReason = escapeHtml(detail.cancelRequestReason || "");
        const cancelRequestedAt = detail.cancelRequestedAt ? escapeHtml(formatDateTime(detail.cancelRequestedAt)) : "";
        const discount = Number(detail.discountAmount || 0);
        const subtotal = Number(detail.subtotalPrice || detail.totalPrice || 0);
        const historyHtml = buildOrderHistoryTimeline(detail.statusHistory || []);

        const rows = (detail.items || []).map((item) => `
            <tr>
                <td>
                    <div class="line-item">
                        <img class="line-thumb" src="${escapeHtml(item.imageUrl || "https://placehold.co/120x90/f3f4f6/111827?text=TP")}" alt="${escapeHtml(item.productName || "Sản phẩm")}">
                        <div>
                            <div class="cell-title">${escapeHtml(item.productName || "Sản phẩm")}</div>
                            <div class="muted">ID: ${item.productId ?? ""}</div>
                        </div>
                    </div>
                </td>
                <td class="col-right"><strong>${formatVnd(item.unitPrice)}</strong></td>
                <td class="col-center">${item.quantity ?? 0}</td>
                <td class="col-right"><strong>${formatVnd(item.lineTotal)}</strong></td>
            </tr>
        `).join("");

        body.innerHTML = `
            <section class="admin-detail-hero">
                <div class="admin-detail-hero-main">
                    <h4 class="admin-detail-order-id">Đơn hàng #${detail.id}</h4>
                    <p class="admin-detail-sub">
                        Khách: <strong>${escapeHtml(detail.customerUsername || "N/A")}</strong>
                        <span class="admin-detail-dot">•</span>
                        Tạo lúc: <strong>${createdAt || "N/A"}</strong>
                    </p>
                </div>
                <div class="admin-detail-chip-group">
                    <span class="admin-detail-chip admin-detail-chip-payment">${payment}</span>
                    <span class="status-pill ${statusClass} admin-detail-status">${statusText}</span>
                </div>
            </section>

            <div class="grid-2 admin-detail-grid" style="margin-bottom: 14px;">
                <section class="card admin-detail-card admin-detail-info">
                    <div class="card-head admin-detail-head"><h2 style="margin:0;">Thông tin giao hàng</h2></div>
                    <div class="card-body">
                        <div class="kv admin-kv"><span class="muted">Khách hàng</span><strong>${escapeHtml(detail.customerUsername || "N/A")}</strong></div>
                        <div class="kv admin-kv"><span class="muted">Thanh toán</span><strong>${payment}</strong></div>
                        <div class="kv admin-kv" style="${(detail.paymentMethod === "ONLINE_GATEWAY" || detail.paymentMethod === "BANK_TRANSFER") ? "" : "display:none;"}">
                            <span class="muted">Trạng thái online</span>
                            <strong>${escapeHtml(onlinePaymentStatusLabel(detailPaymentStatus))}</strong>
                        </div>
                        <div class="kv admin-kv" style="${(detail.paymentMethod === "ONLINE_GATEWAY" || detail.paymentMethod === "BANK_TRANSFER") && detail.paymentReference ? "" : "display:none;"}">
                            <span class="muted">Mã tham chiếu</span>
                            <strong>${escapeHtml(detail.paymentReference || "")}</strong>
                        </div>
                        <div class="kv admin-kv">
                            <span class="muted">Trạng thái</span>
                            <span class="status-pill ${statusClass}">${statusText}</span>
                        </div>
                        <div class="kv admin-kv admin-cancel-kv" style="${cancelReason || cancelRequestedAt ? "" : "display:none;"}">
                            <span class="muted">Yêu cầu hủy</span>
                            <strong style="text-align:right;">
                                ${cancelReason || "Khách chưa ghi lý do"}
                                ${cancelRequestedAt ? `<br><span class="muted">${cancelRequestedAt}</span>` : ""}
                            </strong>
                        </div>
                        <div class="kv admin-kv" style="align-items:flex-start;">
                            <span class="muted">Địa chỉ giao hàng</span>
                            <strong style="text-align:right;">${shippingAddress}</strong>
                        </div>
                    </div>
                </section>

                <aside class="card summary admin-detail-card admin-detail-summary">
                    <div class="card-head admin-detail-head"><h2 style="margin:0;">Giá trị đơn</h2></div>
                    <div class="card-body">
                        <div class="kv admin-kv"><span class="muted">Tạm tính</span><strong>${formatVnd(subtotal)}</strong></div>
                        <div class="kv admin-kv" style="${discount > 0 ? "" : "display:none;"}">
                            <span class="muted">Giảm giá ${detail.promotionCode ? `(${escapeHtml(detail.promotionCode)} - ${detail.discountPercent || 0}%)` : ""}</span>
                            <strong>- ${formatVnd(discount)}</strong>
                        </div>
                        <div class="kv total admin-detail-total"><span>Tổng cộng</span><strong>${formatVnd(detail.totalPrice)}</strong></div>
                    </div>
                </aside>
            </div>

            <section class="card admin-detail-card admin-detail-products">
                <div class="card-head admin-detail-head"><h2 style="margin:0;">Sản phẩm trong đơn</h2></div>
                <div class="card-body">
                    <div class="table-wrap">
                        <table class="table admin-detail-table" aria-label="Chi tiết sản phẩm của đơn">
                            <thead>
                            <tr>
                                <th>Sản phẩm</th>
                                <th class="col-right">Đơn giá</th>
                                <th class="col-center">Số lượng</th>
                                <th class="col-right">Thành tiền</th>
                            </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section class="card admin-detail-card" style="margin-bottom:14px;">
                <div class="card-head admin-detail-head"><h2 style="margin:0;">Lịch sử trạng thái</h2></div>
                <div class="card-body">
                    ${historyHtml}
                </div>
            </section>
        `;
    } catch (err) {
        body.innerHTML = `<div class="message message-error">${escapeHtml(err.message)}</div>`;
    }
}

function closeOrderModal() {
    const modal = document.getElementById("order-modal");
    if (!modal) {
        return;
    }

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
}

// -----------------------------
// Payment helpers
// -----------------------------

function paymentStatusPillClass(status) {
    if (status === "PAID") {
        return "success";
    }
    if (status === "FAILED") {
        return "danger";
    }
    return "warn";
}

// -----------------------------
// Categories (Danh mục)
// -----------------------------

async function loadCategories() {
    categoriesCache = await fetchJson("/api/public/categories") || [];
    return categoriesCache;
}

function fillCategorySelect() {
    // Select này nằm trong form sản phẩm.
    const select = document.getElementById("product-category");
    if (!select) {
        return;
    }

    const currentValue = String(select.value || "").trim();
    select.innerHTML = `
        <option value="">Chọn danh mục</option>
        ${categoriesCache.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
    `;

    if (currentValue && categoriesCache.some((c) => String(c.id) === currentValue)) {
        select.value = currentValue;
    }

    applyProductSpecUiFromSelectedCategory();
}

function fillProductsCategoryFilterSelect() {
    const select = document.getElementById("products-category-filter");
    if (!select) {
        return;
    }

    const current = String(productsPageState.categoryId || select.value || "");
    select.innerHTML = `
        <option value="">Tất cả danh mục</option>
        ${categoriesCache.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
    `;

    const hasCurrent = categoriesCache.some((category) => String(category.id) === current);
    select.value = hasCurrent ? current : "";
    productsPageState.categoryId = select.value || "";
}

function getSelectedProductsCategoryId() {
    const select = document.getElementById("products-category-filter");
    if (!select) {
        return null;
    }

    const raw = String(select.value || "").trim();
    if (!raw) {
        return null;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return Math.trunc(parsed);
}

function renderCategoriesTable() {
    const tbody = document.getElementById("categories-body");
    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";

    const keyword = getKeywordFromInput("categories-search");
    const filtered = categoriesCache.filter((category) => {
        return includesKeyword(category.name, keyword)
            || includesKeyword(category.description || "", keyword)
            || includesKeyword(String(category.id), keyword);
    });
    const sortDir = normalizeIdSortDir(getRawInputValue("categories-sort-id"));
    filtered.sort((left, right) => {
        const leftId = Number(left && left.id ? left.id : 0);
        const rightId = Number(right && right.id ? right.id : 0);
        return sortDir === "desc" ? (rightId - leftId) : (leftId - rightId);
    });

    if (!filtered.length) {
        renderEmptyRow(tbody, 4, "Không có danh mục phù hợp");
        return;
    }

    filtered.forEach((category) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${category.id}</td>
            <td><strong>${escapeHtml(category.name)}</strong></td>
            <td class="muted">${escapeHtml(category.description || "")}</td>
            <td class="col-center">
                <div class="row-actions">
                    <button class="btn btn-outline btn-sm action-btn action-btn-edit" type="button" data-action="category-edit" data-id="${category.id}">
                        ${actionIcon("M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z")}
                        <span>Sửa</span>
                    </button>
                    <button class="btn btn-danger btn-sm action-btn action-btn-delete" type="button" data-action="category-delete" data-id="${category.id}">
                        ${actionIcon("M3 6h18", "M8 6V4h8v2M6 6l1 14h10l1-14")}
                        <span>Xóa</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function resetCategoryForm() {
    const idEl = document.getElementById("category-id");
    const nameEl = document.getElementById("category-name");
    const descriptionEl = document.getElementById("category-description");

    if (idEl) idEl.value = "";
    if (nameEl) nameEl.value = "";
    if (descriptionEl) descriptionEl.value = "";

    const modeEl = document.getElementById("category-form-mode");
    if (modeEl) modeEl.textContent = "Tạo mới danh mục";

    setMessage("categories-msg", "", "");
}

function openCreateCategoryPanel() {
    resetCategoryForm();
    showEditPanel("categories");
}

function openEditCategoryPanel(id) {
    const category = findById(categoriesCache, id);
    if (!category) {
        return;
    }

    document.getElementById("category-id").value = String(category.id);
    document.getElementById("category-name").value = category.name || "";
    document.getElementById("category-description").value = category.description || "";

    const modeEl = document.getElementById("category-form-mode");
    if (modeEl) modeEl.textContent = `Chỉnh sửa danh mục #${category.id}`;

    showEditPanel("categories");
    toast("Đang chỉnh sửa danh mục");
}

function closeCategoryPanel() {
    showListPanel("categories");
    resetCategoryForm();
}

async function saveCategory(event) {
    event.preventDefault();
    setMessage("categories-msg", "", "");

    const id = Number(document.getElementById("category-id").value || 0) || null;
    const name = document.getElementById("category-name").value.trim();
    const description = document.getElementById("category-description").value.trim();

    if (!name) {
        setMessage("categories-msg", "Vui lòng nhập tên danh mục.", "error");
        return;
    }

    const payload = { name, description };

    try {
        if (id) {
            await fetchJson(`/api/admin/categories/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders()
                },
                body: JSON.stringify(payload)
            });
            toast("Đã cập nhật danh mục");
        } else {
            await fetchJson("/api/admin/categories", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders()
                },
                body: JSON.stringify(payload)
            });
            toast("Đã tạo danh mục mới");
        }

        await initCategoriesView();
        await loadCategories();
        fillCategorySelect();
    } catch (err) {
        setMessage("categories-msg", err.message, "error");
    }
}

async function deleteCategoryById(id) {
    setMessage("categories-msg", "", "");

    try {
        await fetchJson(`/api/admin/categories/${id}`, {
            method: "DELETE",
            headers: {
                ...authHeaders()
            }
        });

        toast("Đã xóa danh mục");
        await initCategoriesView();
        await loadCategories();
        fillCategorySelect();
    } catch (err) {
        setMessage("categories-msg", err.message, "error");
    }
}

async function initCategoriesView() {
    setMessage("categories-msg", "", "");
    await loadCategories();
    renderCategoriesTable();
    showListPanel("categories");
    resetCategoryForm();
}

// -----------------------------
// Products (Sản phẩm)
// -----------------------------

function parseProductVariantsInput(rawText) {
    // tac dung code: parse chuoi textarea bien the (moi dong 1 bien the) thanh payload JSON cho API admin.
    const lines = String(rawText || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const variants = [];
    lines.forEach((line, index) => {
        const parts = line.split("|").map((part) => String(part || "").trim());
        if (parts.length < 3) {
            throw new Error(`Dòng biến thể ${index + 1} chưa đủ dữ liệu (cần: Tên | Giá | Tồn kho).`);
        }

        const name = parts[0];
        const price = Number(parts[1]);
        const stock = Number(parts[2]);
        const imageUrl = parts[3] || "";
        const sku = parts[4] || "";

        if (!name) {
            throw new Error(`Dòng biến thể ${index + 1} chưa có tên biến thể.`);
        }
        if (!Number.isFinite(price) || price < 0) {
            throw new Error(`Giá biến thể ở dòng ${index + 1} không hợp lệ.`);
        }
        if (!Number.isFinite(stock) || stock < 0) {
            throw new Error(`Tồn kho biến thể ở dòng ${index + 1} không hợp lệ.`);
        }

        variants.push({
            name,
            price,
            stock: Math.round(stock),
            imageUrl: imageUrl || null,
            sku: sku || null,
            sortOrder: index
        });
    });

    return variants;
}

function formatProductVariantsEditor(variants) {
    // tac dung code: format JSON bien the tu API thanh chuoi de admin sua nhanh trong textarea.
    if (!Array.isArray(variants) || !variants.length) {
        return "";
    }

    return variants.map((variant) => {
        const fields = [
            variant.name || "",
            Number(variant.price || 0),
            Number(variant.stock || 0),
            variant.imageUrl || "",
            variant.sku || ""
        ];
        return fields.join(" | ");
    }).join("\n");
}

async function loadProductVariantsEditor(productId) {
    const variantsEl = document.getElementById("product-variants");
    if (!variantsEl) {
        return;
    }

    variantsEl.value = "Đang tải biến thể...";
    variantsEl.disabled = true;
    try {
        const variants = await fetchJson(`/api/admin/products/${productId}/variants`, {
            headers: {
                ...authHeaders()
            }
        }) || [];
        variantsEl.value = formatProductVariantsEditor(variants);
    } catch (err) {
        variantsEl.value = "";
        setMessage("products-msg", `Không tải được biến thể: ${err.message}`, "error");
    } finally {
        variantsEl.disabled = false;
    }
}

async function saveProductVariants(productId, variants) {
    await fetchJson(`/api/admin/products/${productId}/variants`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders()
        },
        body: JSON.stringify(variants || [])
    });
}

async function loadProducts() {
    const keyword = getRawInputValue("products-search");
    const sortDir = normalizeProductSortDir(productsPageState.sortDir);
    const categoryId = getSelectedProductsCategoryId();
    productsPageState.sortDir = sortDir;
    productsPageState.categoryId = categoryId ? String(categoryId) : "";

    const params = new URLSearchParams({
        page: String(productsPageState.page),
        size: String(productsPageState.size)
    });
    if (keyword) {
        params.set("keyword", keyword);
    }
    params.set("sortDir", sortDir);
    if (categoryId) {
        params.set("categoryId", String(categoryId));
    }

    // Use admin paged endpoint instead of loading all products at once.
    let payload = await fetchJson(`/api/admin/products/paged?${params.toString()}`, {
        headers: {
            ...authHeaders()
        }
    }) || {};

    applyPageState(productsPageState, payload);

    if (productsPageState.totalPages > 0 && productsPageState.page > productsPageState.totalPages - 1) {
        productsPageState.page = productsPageState.totalPages - 1;
        params.set("page", String(productsPageState.page));
        payload = await fetchJson(`/api/admin/products/paged?${params.toString()}`, {
            headers: {
                ...authHeaders()
            }
        }) || {};
        applyPageState(productsPageState, payload);
    }

    productsCache = Array.isArray(payload.items) ? payload.items : [];
    renderPagination("products", productsPageState);
    return productsCache;
}

function renderProductsTable() {
    const tbody = document.getElementById("products-body");
    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";
    if (!productsCache.length) {
        renderEmptyRow(tbody, 7, "Không có sản phẩm phù hợp");
        return;
    }

    productsCache.forEach((product) => {
        const tr = document.createElement("tr");
        const categoryName = product.category ? product.category.name : "N/A";
        const pricing = resolveProductPricing(product);
        const thumbUrl = String(product.imageUrl || parseMultiline(product.galleryImages)[0] || "").trim();
        const thumbHtml = thumbUrl
            ? `<img class="admin-product-thumb" src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(product.name || "Product")}">`
            : `<div class="admin-product-thumb admin-product-thumb-placeholder">N/A</div>`;
        const priceCell = pricing.hasDiscount
            ? `
                <div class="admin-price-block">
                    <strong class="admin-price-final">${formatVnd(pricing.finalPrice)}</strong>
                    <div class="admin-price-sub">
                        <span class="admin-price-old">${formatVnd(pricing.originalPrice)}</span>
                        <span class="price-discount-badge">-${Math.round(pricing.discountPercent)}%</span>
                    </div>
                </div>
            `
            : `<strong class="admin-price-final">${formatVnd(pricing.finalPrice)}</strong>`;

        tr.innerHTML = `
            <td>${product.id}</td>
            <td class="col-center">${thumbHtml}</td>
            <td><strong>${escapeHtml(product.name)}</strong></td>
            <td>${escapeHtml(categoryName)}</td>
            <td class="col-right">${priceCell}</td>
            <td class="col-center">${product.stock ?? 0}</td>
            <td class="col-center">
                <div class="row-actions">
                    <button class="btn btn-outline btn-sm action-btn action-btn-edit" type="button" data-action="product-edit" data-id="${product.id}">
                        ${actionIcon("M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z")}
                        <span>Sửa</span>
                    </button>
                    <button class="btn btn-danger btn-sm action-btn action-btn-delete" type="button" data-action="product-delete" data-id="${product.id}">
                        ${actionIcon("M3 6h18", "M8 6V4h8v2M6 6l1 14h10l1-14")}
                        <span>Xóa</span>
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function clearLocalProductPreviewUrl() {
    if (localProductPreviewUrl) {
        URL.revokeObjectURL(localProductPreviewUrl);
        localProductPreviewUrl = "";
    }
}

function setProductImagePreview(url, options = {}) {
    const previewEl = document.getElementById("product-ai-source-preview");
    const emptyEl = document.getElementById("product-ai-source-empty");
    if (!previewEl) {
        return;
    }

    const imageUrl = String(url || "").trim();
    if (!imageUrl) {
        clearLocalProductPreviewUrl();
        previewEl.hidden = true;
        previewEl.removeAttribute("src");
        if (emptyEl) {
            emptyEl.hidden = false;
        }
        return;
    }

    if (options.localFile) {
        clearLocalProductPreviewUrl();
        localProductPreviewUrl = imageUrl;
    } else {
        clearLocalProductPreviewUrl();
    }

    previewEl.src = imageUrl;
    previewEl.hidden = false;
    if (emptyEl) {
        emptyEl.hidden = true;
    }
}

function isLocalProductFileSelected() {
    const fileInput = document.getElementById("product-media-files");
    return !!(fileInput && fileInput.files && fileInput.files.length > 0);
}

function collectCurrentProductMediaUrls() {
    const imageEl = document.getElementById("product-image");
    const galleryEl = document.getElementById("product-gallery");
    const coverUrl = imageEl ? String(imageEl.value || "").trim() : "";
    const galleryText = galleryEl ? String(galleryEl.value || "") : "";
    const urls = normalizeProductGalleryUrls(coverUrl, galleryText);
    return prioritizeCoverInGallery(urls, coverUrl);
}

function isProductAiSourceSelectable(url) {
    const target = String(url || "").trim();
    if (!target) {
        return false;
    }
    return collectCurrentProductMediaUrls().some((item) => isSameUrl(item, target));
}

function getProductAiEffectiveSourceUrl() {
    if (isLocalProductFileSelected()) {
        return "";
    }

    const selected = String(productAiSourceUrl || "").trim();
    if (selected && isProductAiSourceSelectable(selected)) {
        return selected;
    }

    const imageInput = document.getElementById("product-image");
    return imageInput ? String(imageInput.value || "").trim() : "";
}

function extensionFromMimeType(mimeType) {
    const mime = String(mimeType || "").toLowerCase();
    if (mime.includes("jpeg") || mime.includes("jpg")) {
        return ".jpg";
    }
    if (mime.includes("webp")) {
        return ".webp";
    }
    if (mime.includes("gif")) {
        return ".gif";
    }
    return ".png";
}

function sanitizeFilename(value) {
    return String(value || "")
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function buildUploadFileNameFromUrl(url, mimeType) {
    const fallback = "techstore-ai-source";
    const path = String(url || "").split("?")[0].split("#")[0];
    const rawName = path.includes("/") ? path.substring(path.lastIndexOf("/") + 1) : path;
    const safeName = sanitizeFilename(rawName) || fallback;
    if (/\.(png|jpe?g|webp|gif)$/i.test(safeName)) {
        return safeName;
    }
    return `${safeName}${extensionFromMimeType(mimeType)}`;
}

async function resolveProductAiSourceInput() {
    const fileInput = document.getElementById("product-media-files");
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        return {
            fileValue: file,
            fileName: file.name || "techstore-ai-source.png",
            sourceUrl: ""
        };
    }

    const sourceUrl = getProductAiEffectiveSourceUrl();
    if (!sourceUrl) {
        throw new Error("Vui lòng chọn ảnh nguồn để sửa AI.");
    }

    const response = await fetch(sourceUrl, { credentials: "same-origin" });
    if (!response.ok) {
        throw new Error("Không thể đọc ảnh đã chọn để gửi sang ComfyUI.");
    }

    const blob = await response.blob();
    const mimeType = String(blob.type || "").startsWith("image/") ? blob.type : "image/png";
    return {
        fileValue: blob.slice(0, blob.size, mimeType),
        fileName: buildUploadFileNameFromUrl(sourceUrl, mimeType),
        sourceUrl
    };
}

function setProductAiResultPreview(url) {
    const imageEl = document.getElementById("product-ai-result-preview");
    const emptyEl = document.getElementById("product-ai-result-empty");
    if (!imageEl) {
        return;
    }

    if (emptyEl) {
        emptyEl.hidden = true;
        emptyEl.textContent = "";
        emptyEl.classList.remove("is-error");
    }

    const imageUrl = String(url || "").trim();
    if (!imageUrl) {
        imageEl.hidden = true;
        imageEl.removeAttribute("src");
        return;
    }

    imageEl.onerror = () => {
        imageEl.hidden = true;
        imageEl.removeAttribute("src");
        if (emptyEl) {
            emptyEl.textContent = "Không thể hiển thị ảnh kết quả. Vui lòng thử lại.";
            emptyEl.classList.add("is-error");
            emptyEl.hidden = false;
        }
    };

    imageEl.src = imageUrl;
    imageEl.hidden = false;
}

function openAdminImageLightbox(imageUrl, altText = "") {
    const src = String(imageUrl || "").trim();
    if (!src) {
        return;
    }

    const lightbox = document.getElementById("admin-image-lightbox");
    const imageEl = document.getElementById("admin-image-lightbox-img");
    if (!lightbox || !imageEl) {
        return;
    }

    imageEl.src = src;
    imageEl.alt = String(altText || "").trim() || "Ảnh phóng to";
    lightbox.classList.add("show");
    lightbox.setAttribute("aria-hidden", "false");
    adminImageLightboxPrevOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
}

function closeAdminImageLightbox() {
    const lightbox = document.getElementById("admin-image-lightbox");
    const imageEl = document.getElementById("admin-image-lightbox-img");
    if (!lightbox) {
        return;
    }

    lightbox.classList.remove("show");
    lightbox.setAttribute("aria-hidden", "true");
    if (imageEl) {
        imageEl.removeAttribute("src");
        imageEl.alt = "Ảnh phóng to";
    }
    document.body.style.overflow = adminImageLightboxPrevOverflow;
}

function syncAiActionButtons() {
    const enhanceBtn = document.getElementById("product-image-ai-enhance");
    const acceptBtn = document.getElementById("product-image-ai-accept");
    const cancelBtn = document.getElementById("product-image-ai-cancel");
    const hasSource = isLocalProductFileSelected() || !!getProductAiEffectiveSourceUrl();

    if (enhanceBtn) {
        enhanceBtn.disabled = productAiProcessing || !hasSource;
        enhanceBtn.textContent = productAiProcessing ? "Đang sửa ảnh..." : "Sửa ảnh bằng ComfyUI";
    }
    if (acceptBtn) {
        acceptBtn.disabled = productAiProcessing || !productAiPendingUrl;
    }
    if (cancelBtn) {
        cancelBtn.disabled = !productAiProcessing && !productAiPendingUrl;
    }
}

function syncProductAiSourcePreview() {
    if (isLocalProductFileSelected()) {
        const fileInput = document.getElementById("product-media-files");
        const localUrl = fileInput && fileInput.files ? URL.createObjectURL(fileInput.files[0]) : "";
        setProductImagePreview(localUrl, { localFile: true });
        syncAiActionButtons();
        return;
    }

    if (productAiSourceUrl && !isProductAiSourceSelectable(productAiSourceUrl)) {
        productAiSourceUrl = "";
    }

    setProductImagePreview(getProductAiEffectiveSourceUrl());
    syncAiActionButtons();
}

function clearProductAiCompare() {
    productAiPendingUrl = "";
    productAiPendingSourceUrl = "";
    setProductAiResultPreview("");
    syncAiActionButtons();
}

function setProductAiCompare(afterUrl) {
    const after = String(afterUrl || "").trim();
    if (!after) {
        clearProductAiCompare();
        return;
    }

    productAiPendingUrl = after;
    setProductAiResultPreview(after);
    syncAiActionButtons();
}

async function cancelProductImageEnhancement(options = {}) {
    const silent = options.silent === true;
    const skipInterrupt = options.skipInterrupt === true;
    const hadProcessing = productAiProcessing;
    const hadPending = !!productAiPendingUrl;

    productAiRequestSeq += 1;
    if (productAiAbortController) {
        productAiAbortController.abort();
        productAiAbortController = null;
    }

    productAiProcessing = false;
    clearProductAiCompare();
    syncProductAiSourcePreview();

    if (hadProcessing && !skipInterrupt) {
        try {
            await fetchJson("/api/admin/uploads/product-image/ai-enhance/cancel", {
                method: "POST",
                headers: {
                    ...authHeaders()
                }
            });
        } catch (err) {
            // Ignore cancel errors: local abort still guarantees UI state reset.
        }
    }

    if (!silent && (hadProcessing || hadPending)) {
        toast("Đã hủy quá trình sửa ảnh");
    }
}

function acceptProductAiImage() {
    setMessage("products-msg", "", "");
    if (!productAiPendingUrl) {
        setMessage("products-msg", "Chưa có ảnh đã sửa để chấp nhận.", "error");
        return;
    }

    const imageEl = document.getElementById("product-image");
    const galleryEl = document.getElementById("product-gallery");
    const fileInput = document.getElementById("product-media-files");
    const acceptedUrl = String(productAiPendingUrl || "").trim();
    const sourceUrl = String(productAiPendingSourceUrl || "").trim();

    const currentCover = imageEl ? String(imageEl.value || "").trim() : "";
    const currentGallery = galleryEl ? String(galleryEl.value || "") : "";
    const currentUrls = normalizeProductGalleryUrls(currentCover, currentGallery);

    let nextCover = acceptedUrl;
    let nextUrls;
    const shouldReplaceExisting = !!sourceUrl && currentUrls.some((url) => isSameUrl(url, sourceUrl));
    if (shouldReplaceExisting) {
        nextUrls = currentUrls.map((url) => (isSameUrl(url, sourceUrl) ? acceptedUrl : url));
        nextCover = isSameUrl(currentCover, sourceUrl) ? acceptedUrl : currentCover;
        nextUrls = normalizeProductGalleryUrls(nextCover || acceptedUrl, nextUrls.join("\n"));
    } else {
        nextUrls = normalizeProductGalleryUrls(
            acceptedUrl,
            [currentGallery, acceptedUrl].join("\n")
        );
    }

    if (imageEl) {
        imageEl.value = nextCover || acceptedUrl;
    }
    updateGalleryTextFromUrls(nextUrls);
    productAiSourceUrl = acceptedUrl;

    if (fileInput) {
        fileInput.value = "";
    }

    clearProductAiCompare();
    refreshProductMediaPreview();
    toast(shouldReplaceExisting ? "Đã thay ảnh đã chọn bằng ảnh AI" : "Đã chấp nhận ảnh đã sửa");
}

function normalizeProductGalleryUrls(coverUrl, galleryText) {
    // Chuẩn hóa danh sách ảnh: bỏ trùng, đưa ảnh đại diện lên đầu.
    const unique = [];
    const seen = new Set();
    const pushUnique = (url) => {
        const clean = String(url || "").trim();
        if (!clean) {
            return;
        }
        const key = clean.toLowerCase();
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        unique.push(clean);
    };

    pushUnique(coverUrl);
    parseMultiline(galleryText).forEach(pushUnique);
    return unique.slice(0, 12);
}

function prioritizeCoverInGallery(urls, coverUrl) {
    const cover = String(coverUrl || "").trim();
    const list = (urls || []).map((url) => String(url || "").trim()).filter(Boolean).slice(0, 12);
    if (!cover || !list.length) {
        return list;
    }

    const foundIndex = list.findIndex((url) => isSameUrl(url, cover));
    if (foundIndex === 0) {
        return list;
    }
    if (foundIndex > 0) {
        const [picked] = list.splice(foundIndex, 1);
        list.unshift(picked);
        return list;
    }

    // Cover exists but is missing in gallery list -> prepend it.
    return [cover, ...list].slice(0, 12);
}

function updateGalleryTextFromUrls(urls) {
    const galleryEl = document.getElementById("product-gallery");
    if (!galleryEl) {
        return;
    }
    galleryEl.value = (urls || []).join("\n");
}

function isSameUrl(a, b) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function setProductCoverImage(targetUrl) {
    const imageEl = document.getElementById("product-image");
    const galleryEl = document.getElementById("product-gallery");
    const nextCover = String(targetUrl || "").trim();
    if (!imageEl || !galleryEl || !nextCover) {
        return;
    }

    imageEl.value = nextCover;
    const galleryUrls = normalizeProductGalleryUrls(nextCover, galleryEl.value || "");
    updateGalleryTextFromUrls(galleryUrls);
    clearProductAiCompare();
    refreshProductMediaPreview();
}

function removeProductGalleryImage(targetUrl) {
    const imageEl = document.getElementById("product-image");
    const galleryEl = document.getElementById("product-gallery");
    const removeUrl = String(targetUrl || "").trim();
    if (!imageEl || !galleryEl || !removeUrl) {
        return;
    }

    const currentCover = String(imageEl.value || "").trim();
    const currentUrls = normalizeProductGalleryUrls(currentCover, galleryEl.value || "");
    const remaining = currentUrls.filter((url) => !isSameUrl(url, removeUrl));
    if (isSameUrl(productAiSourceUrl, removeUrl)) {
        productAiSourceUrl = "";
    }

    if (!remaining.length) {
        imageEl.value = "";
        updateGalleryTextFromUrls([]);
        clearProductAiCompare();
        refreshProductMediaPreview();
        return;
    }

    const nextCover = isSameUrl(currentCover, removeUrl) ? remaining[0] : currentCover;
    imageEl.value = nextCover;
    const normalized = normalizeProductGalleryUrls(nextCover, remaining.join("\n"));
    updateGalleryTextFromUrls(normalized);
    clearProductAiCompare();
    refreshProductMediaPreview();
}

function setProductGalleryPreview(urls) {
    const holder = document.getElementById("product-gallery-preview");
    if (!holder) {
        return;
    }

    const imageEl = document.getElementById("product-image");
    const currentCover = imageEl ? String(imageEl.value || "").trim() : "";
    const gallery = prioritizeCoverInGallery((urls || []).slice(0, 12), currentCover);
    const hasLocalFile = isLocalProductFileSelected();
    const effectiveAiSourceUrl = hasLocalFile ? "" : getProductAiEffectiveSourceUrl();
    if (!gallery.length) {
        holder.innerHTML = "";
        return;
    }

    holder.innerHTML = gallery.map((url, index) => {
        const isCover = isSameUrl(url, currentCover);
        const isAiSource = !!effectiveAiSourceUrl && isSameUrl(url, effectiveAiSourceUrl);
        return `
            <div class="admin-gallery-card ${isCover ? "is-cover" : ""} ${isAiSource ? "is-ai-source" : ""}">
                <div class="admin-gallery-thumb">
                    <img src="${escapeHtml(url)}" alt="Ảnh sản phẩm ${index + 1}">
                    <span class="admin-gallery-thumb-index">#${index + 1}</span>
                    ${isCover ? `<span class="admin-gallery-cover-badge">Ảnh chính</span>` : ""}
                </div>

                <div class="admin-gallery-thumb-actions">
                    <button
                        class="btn btn-outline btn-sm admin-gallery-action admin-gallery-action-ai"
                        type="button"
                        data-gallery-action="pick-ai-source"
                        data-url="${escapeHtml(url)}"
                        ${isAiSource ? "disabled" : ""}
                    >
                        ${isAiSource ? "Đang chọn sửa AI" : "Sửa ảnh này bằng AI"}
                    </button>
                    <button
                        class="btn btn-outline btn-sm admin-gallery-action admin-gallery-action-primary"
                        type="button"
                        data-gallery-action="set-cover"
                        data-url="${escapeHtml(url)}"
                        ${isCover ? "disabled" : ""}
                    >
                        ${isCover ? "Đang là ảnh chính" : "Đặt làm ảnh chính"}
                    </button>
                    <button
                        class="btn btn-danger btn-sm admin-gallery-action"
                        type="button"
                        data-gallery-action="remove"
                        data-url="${escapeHtml(url)}"
                    >
                        Xóa ảnh
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

function bindProductGalleryActions() {
    const holder = document.getElementById("product-gallery-preview");
    if (!holder || holder.dataset.wiredGallery === "1") {
        return;
    }
    holder.dataset.wiredGallery = "1";

    holder.addEventListener("click", async (event) => {
        const image = event.target.closest(".admin-gallery-thumb img");
        if (image) {
            openAdminImageLightbox(image.currentSrc || image.src, image.alt);
            return;
        }

        const button = event.target.closest("button[data-gallery-action][data-url]");
        if (!button) {
            return;
        }

        const action = button.getAttribute("data-gallery-action");
        const url = String(button.getAttribute("data-url") || "").trim();
        if (!action || !url) {
            return;
        }

        if (action === "pick-ai-source") {
            productAiSourceUrl = url;
            await cancelProductImageEnhancement({ silent: true });
            refreshProductMediaPreview();
            toast("Đã chọn ảnh nguồn để sửa AI");
            return;
        }

        if (action === "set-cover") {
            setProductCoverImage(url);
            toast("Đã chọn ảnh chính");
            return;
        }

        if (action === "remove") {
            removeProductGalleryImage(url);
            toast("Đã xóa ảnh khỏi gallery");
        }
    });
}

function refreshProductMediaPreview() {
    const imageEl = document.getElementById("product-image");
    const galleryEl = document.getElementById("product-gallery");

    const coverUrl = imageEl ? imageEl.value.trim() : "";
    let galleryUrls = normalizeProductGalleryUrls(coverUrl, galleryEl ? galleryEl.value : "");

    // Tự đồng bộ textarea gallery để tránh trùng URL hoặc quá nhiều ảnh.
    galleryUrls = prioritizeCoverInGallery(galleryUrls, coverUrl);
    updateGalleryTextFromUrls(galleryUrls);

    // Nếu có gallery mà chưa có cover thì lấy ảnh đầu làm cover.
    if (imageEl && !coverUrl && galleryUrls.length > 0) {
        imageEl.value = galleryUrls[0];
    }

    const effectiveCover = imageEl ? imageEl.value.trim() : "";
    const orderedGallery = prioritizeCoverInGallery(galleryUrls, effectiveCover);
    updateGalleryTextFromUrls(orderedGallery);
    syncProductAiSourcePreview();
    setProductGalleryPreview(orderedGallery);
}

function setProductFormState(mode, productId = null) {
    const form = document.getElementById("product-form");
    if (form) {
        form.dataset.mode = mode || "create";
    }
    editingProductId = Number(productId || 0) || null;
}

function getCurrentEditingProductId() {
    if (editingProductId) {
        return editingProductId;
    }

    const idEl = document.getElementById("product-id");
    if (!idEl) {
        return null;
    }

    const value = Number(idEl.value || 0);
    return value > 0 ? value : null;
}

function resetProductForm() {
    const idEl = document.getElementById("product-id");
    const nameEl = document.getElementById("product-name");
    const categoryEl = document.getElementById("product-category");
    const priceEl = document.getElementById("product-price");
    const discountEl = document.getElementById("product-discount");
    const stockEl = document.getElementById("product-stock");
    const imageEl = document.getElementById("product-image");
    const mediaFilesEl = document.getElementById("product-media-files");
    const aiPromptEl = document.getElementById("product-image-ai-prompt");
    const galleryEl = document.getElementById("product-gallery");
    const quickSpecsEl = document.getElementById("product-quick-specs");
    const variantsEl = document.getElementById("product-variants");
    const descriptionEl = document.getElementById("product-description");

    if (idEl) idEl.value = "";
    if (nameEl) nameEl.value = "";
    if (categoryEl) categoryEl.value = "";
    applyProductSpecUiByCategoryName("");
    if (priceEl) priceEl.value = "";
    if (discountEl) discountEl.value = "0";
    if (stockEl) stockEl.value = "";
    if (imageEl) imageEl.value = "";
    if (mediaFilesEl) mediaFilesEl.value = "";
    if (aiPromptEl) aiPromptEl.value = "";
    if (galleryEl) galleryEl.value = "";
    if (quickSpecsEl) quickSpecsEl.value = "";
    clearProductSpecFields();
    writeProductDetailSpecs("");
    if (variantsEl) {
        variantsEl.value = "";
        variantsEl.disabled = false;
    }
    if (descriptionEl) descriptionEl.value = "";
    productAiSourceUrl = "";
    void cancelProductImageEnhancement({ silent: true }).catch(() => {
        clearProductAiCompare();
        syncProductAiSourcePreview();
    });
    refreshProductMediaPreview();
    setProductFormState("create", null);

    const modeEl = document.getElementById("product-form-mode");
    if (modeEl) modeEl.textContent = "Tạo mới sản phẩm";

    setMessage("products-msg", "", "");
}

function openCreateProductPanel() {
    resetProductForm();
    showEditPanel("products");
}

function openEditProductPanel(id) {
    const product = findById(productsCache, id);
    if (!product) {
        return;
    }

    document.getElementById("product-id").value = String(product.id);
    document.getElementById("product-name").value = product.name || "";
    document.getElementById("product-category").value = product.category ? String(product.category.id) : "";
    applyProductSpecUiByCategoryName(product.category ? product.category.name : "");
    document.getElementById("product-price").value = String(product.price || 0);
    document.getElementById("product-discount").value = String(normalizeDiscountPercent(product.discountPercent || 0));
    document.getElementById("product-stock").value = String(product.stock || 0);
    document.getElementById("product-image").value = product.imageUrl || "";
    document.getElementById("product-media-files").value = "";
    document.getElementById("product-gallery").value = product.galleryImages || "";
    document.getElementById("product-quick-specs").value = product.quickSpecs || "";
    writeProductDetailSpecs(product.detailSpecs || "");
    fillProductSpecFields(product);
    const variantsEl = document.getElementById("product-variants");
    if (variantsEl) {
        variantsEl.value = "";
        variantsEl.disabled = false;
    }
    document.getElementById("product-description").value = product.description || "";
    productAiSourceUrl = "";
    void cancelProductImageEnhancement({ silent: true }).catch(() => {
        clearProductAiCompare();
        syncProductAiSourcePreview();
    });
    refreshProductMediaPreview();
    setProductFormState("edit", product.id);

    const modeEl = document.getElementById("product-form-mode");
    if (modeEl) modeEl.textContent = `Chỉnh sửa sản phẩm #${product.id}`;

    showEditPanel("products");
    toast("Đang chỉnh sửa sản phẩm");
    loadProductVariantsEditor(product.id);
}

async function uploadProductImageFile(file) {
    const formData = new FormData();
    formData.append("file", file);

    const data = await fetchJson("/api/admin/uploads/product-image", {
        method: "POST",
        headers: {
            ...authHeaders()
        },
        body: formData
    });

    const imageUrl = data && data.url ? String(data.url).trim() : "";
    if (!imageUrl) {
        throw new Error("Tải ảnh thành công nhưng không nhận được URL ảnh.");
    }

    return imageUrl;
}

async function uploadProductMediaFiles() {
    setMessage("products-msg", "", "");

    const fileInput = document.getElementById("product-media-files");
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        setMessage("products-msg", "Vui lòng chọn ít nhất một ảnh trước khi tải lên.", "error");
        return;
    }

    const uploadBtn = document.getElementById("product-media-upload");
    const oldBtnText = uploadBtn ? uploadBtn.innerHTML : "";
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = "Đang tải ảnh...";
    }

    try {
        const selectedFiles = Array.from(fileInput.files);
        const uploadedUrls = [];
        for (const file of selectedFiles) {
            const url = await uploadProductImageFile(file);
            uploadedUrls.push(url);
        }

        const imageEl = document.getElementById("product-image");
        const galleryEl = document.getElementById("product-gallery");

        let coverUrl = imageEl ? String(imageEl.value || "").trim() : "";
        if (!coverUrl && uploadedUrls.length > 0) {
            coverUrl = uploadedUrls[0];
            if (imageEl) {
                imageEl.value = coverUrl;
            }
        }

        const currentGallery = galleryEl ? galleryEl.value : "";
        const merged = normalizeProductGalleryUrls(
            coverUrl,
            [currentGallery, ...uploadedUrls].filter(Boolean).join("\n")
        );
        updateGalleryTextFromUrls(merged);

        fileInput.value = "";
        clearProductAiCompare();
        refreshProductMediaPreview();
        if (uploadedUrls.length > 1) {
            toast(`Đã tải ${uploadedUrls.length} ảnh sản phẩm`);
        } else {
            toast("Đã tải ảnh sản phẩm");
        }
    } catch (err) {
        setMessage("products-msg", err.message, "error");
    } finally {
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = oldBtnText;
        }
    }
}

async function enhanceProductImageWithAi() {
    setMessage("products-msg", "", "");

    const promptEl = document.getElementById("product-image-ai-prompt");
    const prompt = promptEl ? promptEl.value.trim() : "";
    if (!prompt) {
        setMessage("products-msg", "Vui lòng nhập prompt để chạy đúng như ComfyUI.", "error");
        return;
    }

    const requestSeq = productAiRequestSeq + 1;
    productAiRequestSeq = requestSeq;
    productAiProcessing = true;
    clearProductAiCompare();
    syncAiActionButtons();

    const abortController = new AbortController();
    productAiAbortController = abortController;

    try {
        const sourceInput = await resolveProductAiSourceInput();
        const formData = new FormData();
        formData.append("file", sourceInput.fileValue, sourceInput.fileName);
        if (prompt) {
            formData.append("prompt", prompt);
        }

        const data = await fetchJson("/api/admin/uploads/product-image/ai-enhance", {
            method: "POST",
            headers: {
                ...authHeaders()
            },
            body: formData,
            signal: abortController.signal
        });

        if (requestSeq !== productAiRequestSeq) {
            return;
        }

        const imageUrl = data && data.url ? String(data.url).trim() : "";
        if (!imageUrl) {
            throw new Error("AI xử lý xong nhưng không nhận được URL ảnh.");
        }

        productAiPendingSourceUrl = String(sourceInput.sourceUrl || "").trim();
        setProductAiCompare(imageUrl);
        toast("Đã sửa ảnh xong, bấm Chấp nhận để áp dụng");
    } catch (err) {
        if (requestSeq !== productAiRequestSeq) {
            return;
        }
        if (err && err.name === "AbortError") {
            return;
        }
        setMessage("products-msg", err.message, "error");
    } finally {
        if (requestSeq === productAiRequestSeq) {
            productAiProcessing = false;
            if (productAiAbortController === abortController) {
                productAiAbortController = null;
            }
            syncAiActionButtons();
        }
    }
}

function closeProductPanel() {
    showListPanel("products");
    resetProductForm();
}

async function saveProduct(event) {
    event.preventDefault();
    if (productSaving) {
        return;
    }

    setMessage("products-msg", "", "");
    productSaving = true;

    const form = document.getElementById("product-form");
    const mode = form && form.dataset.mode ? form.dataset.mode : "create";
    const id = getCurrentEditingProductId();

    const saveBtn = document.getElementById("product-save");
    const oldSaveText = saveBtn ? saveBtn.innerHTML : "";
    const scrollTopBeforeSave = window.scrollY || window.pageYOffset || 0;
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Đang lưu...";
    }

    const restoreSaveButton = () => {
        productSaving = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = oldSaveText;
        }
    };

    const focusElement = (element) => {
        if (!element) {
            return;
        }
        try {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (_) {
            // Ignore browser scroll API differences.
        }
        try {
            element.focus({ preventScroll: true });
        } catch (_) {
            element.focus();
        }
    };

    const focusDetailSpecsField = () => {
        const editorRoot = document.getElementById("product-detail-specs-editor");
        if (productSpecsEditor && editorRoot && !editorRoot.hidden) {
            try {
                editorRoot.scrollIntoView({ behavior: "smooth", block: "center" });
            } catch (_) {
                // Ignore browser scroll API differences.
            }
            productSpecsEditor.focus();
            return;
        }

        focusElement(getProductDetailSpecsTextarea());
    };

    const failSave = (message, focusTarget = null) => {
        setMessage("products-msg", message, "error");
        restoreSaveButton();

        if (typeof focusTarget === "function") {
            focusTarget();
            return;
        }
        if (focusTarget) {
            focusElement(focusTarget);
        }
    };

    const name = document.getElementById("product-name").value.trim();
    const categoryId = Number(document.getElementById("product-category").value || 0);
    const price = Number(document.getElementById("product-price").value || 0);
    const discountPercent = Number(document.getElementById("product-discount").value || 0);
    const stock = Number(document.getElementById("product-stock").value || 0);
    const imageEl = document.getElementById("product-image");
    const galleryEl = document.getElementById("product-gallery");
    const mediaFilesEl = document.getElementById("product-media-files");
    const quickSpecsEl = document.getElementById("product-quick-specs");
    const variantsEl = document.getElementById("product-variants");
    const selectedMediaFiles = mediaFilesEl && mediaFilesEl.files
        ? Array.from(mediaFilesEl.files)
        : [];
    let imageUrl = imageEl ? imageEl.value.trim() : "";
    let galleryImages = galleryEl ? galleryEl.value : "";
    const detailSpecs = readProductDetailSpecs();
    const defaultSpecPayload = readProductSpecFields();
    const generatedQuickSpecs = buildQuickSpecsFromDefaultFields(defaultSpecPayload);
    const quickSpecs = generatedQuickSpecs.length > 0
        ? generatedQuickSpecs.join("\n")
        : (quickSpecsEl ? quickSpecsEl.value.trim() : "");
    const description = document.getElementById("product-description").value.trim();
    const variantsText = variantsEl ? variantsEl.value : "";

    let variantPayload = [];
    try {
        variantPayload = parseProductVariantsInput(variantsText);
    } catch (err) {
        failSave(err.message);
        return;
    }

    if (!name) {
        failSave("Vui lòng nhập tên sản phẩm.", document.getElementById("product-name"));
        return;
    }

    if (!categoryId) {
        failSave("Vui lòng chọn danh mục.", document.getElementById("product-category"));
        return;
    }

    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
        failSave("Phần trăm khuyến mãi phải trong khoảng 0-100.", document.getElementById("product-discount"));
        return;
    }

    const missingSpecFieldId = PRODUCT_SPEC_FIELD_IDS.find((fieldId) => {
        const specKey = PRODUCT_SPEC_FIELD_MAP[fieldId];
        return specKey && !String(defaultSpecPayload[specKey] || "").trim();
    });
    if (missingSpecFieldId) {
        const missingSpecInput = document.getElementById(missingSpecFieldId);
        const missingSpecLabel = document.querySelector(`label[for="${missingSpecFieldId}"]`);
        const missingSpecName = missingSpecLabel ? String(missingSpecLabel.textContent || "").trim() : "Thông số";
        failSave(`${missingSpecName} không được để trống.`, missingSpecInput);
        return;
    }

    if (!detailSpecs) {
        failSave("Thông số chi tiết không được để trống.", focusDetailSpecsField);
        return;
    }

    if (!description) {
        failSave("Mô tả sản phẩm không được để trống.", document.getElementById("product-description"));
        return;
    }

    if (collectCurrentProductMediaUrls().length === 0 && selectedMediaFiles.length === 0) {
        failSave("Sản phẩm cần ít nhất 1 ảnh", mediaFilesEl);
        return;
    }

    if (mode === "edit" && !id) {
        // Tránh lỗi đang ở chế độ sửa nhưng lại tạo mới ngoài ý muốn.
        failSave("Không xác định được sản phẩm cần sửa. Vui lòng bấm Sửa lại từ danh sách.");
        return;
    }

    const payload = {
        name,
        description,
        price,
        discountPercent,
        stock,
        imageUrl,
        galleryImages,
        quickSpecs,
        detailSpecs,
        ...defaultSpecPayload,
        category: { id: categoryId }
    };

    try {
        if (selectedMediaFiles.length > 0) {
            const uploadedGalleryUrls = [];
            for (const file of selectedMediaFiles) {
                const url = await uploadProductImageFile(file);
                uploadedGalleryUrls.push(url);
            }

            let currentCover = imageEl ? imageEl.value.trim() : payload.imageUrl;
            if (!currentCover && uploadedGalleryUrls.length > 0) {
                currentCover = uploadedGalleryUrls[0];
                if (imageEl) {
                    imageEl.value = currentCover;
                }
            }

            const mergedGallery = normalizeProductGalleryUrls(
                currentCover,
                [galleryImages, ...uploadedGalleryUrls].filter(Boolean).join("\n")
            );

            galleryImages = mergedGallery.join("\n");
            if (galleryEl) {
                galleryEl.value = galleryImages;
            }
            if (mediaFilesEl) {
                mediaFilesEl.value = "";
            }

            payload.imageUrl = imageEl ? imageEl.value.trim() : payload.imageUrl;
            payload.galleryImages = galleryImages;
            refreshProductMediaPreview();
        }

        let savedProduct = null;
        if (id) {
            savedProduct = await fetchJson(`/api/admin/products/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders()
                },
                body: JSON.stringify(payload)
            });
            toast("Đã cập nhật sản phẩm");
        } else {
            savedProduct = await fetchJson("/api/admin/products", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders()
                },
                body: JSON.stringify(payload)
            });
            toast("Đã tạo sản phẩm mới");
        }

        const targetProductId = savedProduct && savedProduct.id ? Number(savedProduct.id) : Number(id || 0);
        if (!targetProductId) {
            throw new Error("Không xác định được sản phẩm để lưu biến thể.");
        }
        await saveProductVariants(targetProductId, variantPayload);

        if (id) {
            // Keep editing panel and scroll position stable after update to avoid "jump to top".
            await loadProducts();
            renderProductsTable();
            await loadProductVariantsEditor(targetProductId);
            setMessage("products-msg", "Đã lưu thay đổi sản phẩm.", "success");
            requestAnimationFrame(() => {
                window.scrollTo({ top: scrollTopBeforeSave, behavior: "auto" });
            });
        } else {
            // Create flow returns to list panel.
            await initProductsView({ resetPage: true });
        }
    } catch (err) {
        setMessage("products-msg", err.message, "error");
        requestAnimationFrame(() => {
            window.scrollTo({ top: scrollTopBeforeSave, behavior: "auto" });
        });
    } finally {
        productSaving = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = oldSaveText;
        }
    }
}

async function deleteProductById(id) {
    setMessage("products-msg", "", "");

    try {
        await fetchJson(`/api/admin/products/${id}`, {
            method: "DELETE",
            headers: {
                ...authHeaders()
            }
        });

        toast("Đã xóa sản phẩm");
        await initProductsView({ resetPage: false });
    } catch (err) {
        setMessage("products-msg", err.message, "error");
    }
}

async function initProductsView(options = {}) {
    const resetPage = options.resetPage !== false;
    if (resetPage) {
        productsPageState.page = 0;
    }
    productsPageState.sortDir = normalizeProductSortDir(productsPageState.sortDir);

    const sortSelect = document.getElementById("products-sort-id");
    if (sortSelect) {
        sortSelect.value = productsPageState.sortDir;
    }

    setMessage("products-msg", "", "");

    await loadCategories();
    fillCategorySelect();
    fillProductsCategoryFilterSelect();

    await loadProducts();
    renderProductsTable();

    showListPanel("products");
    resetProductForm();
}

// -----------------------------
// Promotions (Khuyến mãi)
// -----------------------------

async function loadPromotions() {
    promotionsCache = await fetchJson("/api/admin/promotions", {
        headers: {
            ...authHeaders()
        }
    }) || [];

    return promotionsCache;
}

function renderPromotionsTable() {
    const tbody = document.getElementById("promotions-body");
    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";

    const keyword = getKeywordFromInput("promotions-search");
    const filtered = promotionsCache.filter((promotion) => {
        const period = `${promotion.startDate || "-"} ${promotion.endDate || "-"}`;
        const status = promotion.active ? "Bật" : "Tắt";

        return includesKeyword(promotion.code, keyword)
            || includesKeyword(String(promotion.id), keyword)
            || includesKeyword(period, keyword)
            || includesKeyword(status, keyword)
            || includesKeyword(String(promotion.discountPercent), keyword);
    });
    const sortDir = normalizeIdSortDir(getRawInputValue("promotions-sort-id"));
    filtered.sort((left, right) => {
        const leftId = Number(left && left.id ? left.id : 0);
        const rightId = Number(right && right.id ? right.id : 0);
        return sortDir === "desc" ? (rightId - leftId) : (leftId - rightId);
    });

    if (!filtered.length) {
        renderEmptyRow(tbody, 6, "Không có khuyến mãi phù hợp");
        return;
    }

    filtered.forEach((promotion) => {
        const period = `${promotion.startDate || "-"} → ${promotion.endDate || "-"}`;
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${promotion.id}</td>
            <td><strong>${escapeHtml(promotion.code)}</strong></td>
            <td class="col-center">${promotion.discountPercent}%</td>
            <td class="muted">${escapeHtml(period)}</td>
            <td class="col-center">${promotion.active ? "Bật" : "Tắt"}</td>
            <td class="col-center">
                <div class="row-actions">
                    <button class="btn btn-outline btn-sm action-btn action-btn-edit" type="button" data-action="promotion-edit" data-id="${promotion.id}">
                        ${actionIcon("M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z")}
                        <span>Sửa</span>
                    </button>
                    <button class="btn btn-danger btn-sm action-btn action-btn-delete" type="button" data-action="promotion-delete" data-id="${promotion.id}">
                        ${actionIcon("M3 6h18", "M8 6V4h8v2M6 6l1 14h10l1-14")}
                        <span>Xóa</span>
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function resetPromotionForm() {
    const idEl = document.getElementById("promotion-id");
    const codeEl = document.getElementById("promotion-code");
    const discountEl = document.getElementById("promotion-discount");
    const startEl = document.getElementById("promotion-start");
    const endEl = document.getElementById("promotion-end");
    const activeEl = document.getElementById("promotion-active");

    if (idEl) idEl.value = "";
    if (codeEl) codeEl.value = "";
    if (discountEl) discountEl.value = "";
    if (startEl) startEl.value = "";
    if (endEl) endEl.value = "";
    if (activeEl) activeEl.checked = true;

    const modeEl = document.getElementById("promotion-form-mode");
    if (modeEl) modeEl.textContent = "Tạo mới khuyến mãi";

    setMessage("promotions-msg", "", "");
}

function openCreatePromotionPanel() {
    resetPromotionForm();
    showEditPanel("promotions");
}

function openEditPromotionPanel(id) {
    const promotion = findById(promotionsCache, id);
    if (!promotion) {
        return;
    }

    document.getElementById("promotion-id").value = String(promotion.id);
    document.getElementById("promotion-code").value = promotion.code || "";
    document.getElementById("promotion-discount").value = String(promotion.discountPercent || 0);
    document.getElementById("promotion-start").value = promotion.startDate || "";
    document.getElementById("promotion-end").value = promotion.endDate || "";
    document.getElementById("promotion-active").checked = Boolean(promotion.active);

    const modeEl = document.getElementById("promotion-form-mode");
    if (modeEl) modeEl.textContent = `Chỉnh sửa khuyến mãi #${promotion.id}`;

    showEditPanel("promotions");
    toast("Đang chỉnh sửa khuyến mãi");
}

function closePromotionPanel() {
    showListPanel("promotions");
    resetPromotionForm();
}

async function savePromotion(event) {
    event.preventDefault();
    setMessage("promotions-msg", "", "");

    const id = Number(document.getElementById("promotion-id").value || 0) || null;
    const code = document.getElementById("promotion-code").value.trim();
    const discountPercent = Number(document.getElementById("promotion-discount").value || 0);
    const startDate = document.getElementById("promotion-start").value || null;
    const endDate = document.getElementById("promotion-end").value || null;
    const active = Boolean(document.getElementById("promotion-active").checked);

    if (!code) {
        setMessage("promotions-msg", "Vui lòng nhập mã khuyến mãi.", "error");
        return;
    }

    if (!discountPercent || discountPercent < 1 || discountPercent > 100) {
        setMessage("promotions-msg", "Giảm giá phải từ 1 đến 100.", "error");
        return;
    }

    if (!startDate || !endDate) {
        setMessage("promotions-msg", "Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.", "error");
        return;
    }

    if (endDate < startDate) {
        setMessage("promotions-msg", "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.", "error");
        return;
    }

    const payload = { code, discountPercent, startDate, endDate, active };

    try {
        if (id) {
            await fetchJson(`/api/admin/promotions/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders()
                },
                body: JSON.stringify(payload)
            });
            toast("Đã cập nhật khuyến mãi");
        } else {
            await fetchJson("/api/admin/promotions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders()
                },
                body: JSON.stringify(payload)
            });
            toast("Đã tạo khuyến mãi mới");
        }

        await initPromotionsView();
    } catch (err) {
        setMessage("promotions-msg", err.message, "error");
    }
}

async function deletePromotionById(id) {
    setMessage("promotions-msg", "", "");

    try {
        await fetchJson(`/api/admin/promotions/${id}`, {
            method: "DELETE",
            headers: {
                ...authHeaders()
            }
        });

        toast("Đã xóa khuyến mãi");
        await initPromotionsView();
    } catch (err) {
        setMessage("promotions-msg", err.message, "error");
    }
}

async function initPromotionsView() {
    setMessage("promotions-msg", "", "");
    await loadPromotions();
    renderPromotionsTable();

    showListPanel("promotions");
    resetPromotionForm();
}

// -----------------------------
// Banners (Banner trang chủ)
// -----------------------------

async function loadBanners() {
    bannersCache = await fetchJson("/api/admin/banners/home", {
        headers: {
            ...authHeaders()
        }
    }) || [];
    return bannersCache;
}

function resetBannerForm() {
    const idEl = document.getElementById("banners-id");
    const imageUrlEl = document.getElementById("banners-image-url");
    const targetUrlEl = document.getElementById("banners-target-url");
    const altTextEl = document.getElementById("banners-alt-text");
    editingBannerId = null;
    if (idEl) {
        idEl.value = "";
    }
    if (imageUrlEl) {
        imageUrlEl.value = "";
    }
    if (targetUrlEl) {
        targetUrlEl.value = "";
    }
    if (altTextEl) {
        altTextEl.value = "";
    }
    applyBannerFormMode();
}

function applyBannerFormMode() {
    const modeEl = document.getElementById("banners-form-mode");
    const submitTextEl = document.getElementById("banners-submit-text");
    const isEditing = Number.isFinite(editingBannerId) && editingBannerId > 0;

    if (modeEl) {
        modeEl.textContent = isEditing
            ? `Đang chỉnh sửa banner #${editingBannerId}`
            : "Thêm banner mới";
    }
    if (submitTextEl) {
        submitTextEl.textContent = isEditing ? "Cập nhật banner" : "Tạo banner";
    }
}

function openCreateBannerPanel() {
    resetBannerForm();
    showEditPanel("banners");

    const imageUrlEl = document.getElementById("banners-image-url");
    if (imageUrlEl) {
        imageUrlEl.focus();
    }
}

function openEditBannerPanel(id) {
    const banner = findById(bannersCache, id);
    if (!banner) {
        setMessage("banners-msg", "Không tìm thấy banner cần sửa.", "error");
        return;
    }

    const idEl = document.getElementById("banners-id");
    const imageUrlEl = document.getElementById("banners-image-url");
    const targetUrlEl = document.getElementById("banners-target-url");
    const altTextEl = document.getElementById("banners-alt-text");
    editingBannerId = Number(banner.id) || null;

    if (idEl) {
        idEl.value = String(editingBannerId || "");
    }
    if (imageUrlEl) {
        imageUrlEl.value = String(banner.imageUrl || "").trim();
    }
    if (targetUrlEl) {
        targetUrlEl.value = String(banner.targetUrl || "").trim();
    }
    if (altTextEl) {
        altTextEl.value = String(banner.altText || "").trim();
    }

    applyBannerFormMode();
    showEditPanel("banners");
    if (imageUrlEl) {
        imageUrlEl.focus();
    }

    toast(`Đang chỉnh sửa banner #${banner.id}`);
}

function closeBannerPanel() {
    showListPanel("banners");
    resetBannerForm();
    setMessage("banners-msg", "", "");
}

function renderBannersTable() {
    const tbody = document.getElementById("banners-body");
    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";
    if (!bannersCache.length) {
        renderEmptyRow(tbody, 6, "Chưa có banner");
        return;
    }

    bannersCache.forEach((banner) => {
        const imageUrl = String(banner.imageUrl || "").trim();
        const altText = String(banner.altText || "").trim();
        const targetUrl = String(banner.targetUrl || "").trim();
        const thumbHtml = imageUrl
            ? `<img class="admin-product-thumb" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(altText || "Banner")}">`
            : `<div class="admin-product-thumb admin-product-thumb-placeholder">N/A</div>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${banner.id}</td>
            <td class="col-center">${thumbHtml}</td>
            <td class="muted" style="max-width:280px; word-break:break-all;">${escapeHtml(imageUrl || "-")}</td>
            <td class="muted">${escapeHtml(altText || "-")}</td>
            <td class="muted" style="max-width:220px; word-break:break-all;">${escapeHtml(targetUrl || "-")}</td>
            <td class="col-center">
                <div class="row-actions">
                    <button class="btn btn-outline btn-sm action-btn action-btn-edit" type="button" data-action="banner-edit" data-id="${banner.id}">
                        ${actionIcon("M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z")}
                        <span>Sửa</span>
                    </button>
                    <button class="btn btn-danger btn-sm action-btn action-btn-delete" type="button" data-action="banner-delete" data-id="${banner.id}">
                        ${actionIcon("M3 6h18", "M8 6V4h8v2M6 6l1 14h10l1-14")}
                        <span>Xóa</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveBanner(event) {
    event.preventDefault();
    setMessage("banners-msg", "", "");

    const idEl = document.getElementById("banners-id");
    const imageUrl = getRawInputValue("banners-image-url");
    const targetUrl = getRawInputValue("banners-target-url");
    const altText = getRawInputValue("banners-alt-text");
    const formBannerId = Number(idEl && idEl.value ? idEl.value : 0) || null;
    const effectiveEditingId = Number.isFinite(editingBannerId) && editingBannerId > 0
        ? editingBannerId
        : formBannerId;
    const isEditing = Number.isFinite(effectiveEditingId) && effectiveEditingId > 0;

    if (!isValidBannerImageUrl(imageUrl)) {
        setMessage("banners-msg", "URL ảnh banner không hợp lệ.", "error");
        return;
    }

    if (!isValidBannerTargetUrl(targetUrl)) {
        setMessage("banners-msg", "Liên kết banner không hợp lệ.", "error");
        return;
    }

    try {
        await fetchJson(isEditing ? `/api/admin/banners/home/${effectiveEditingId}` : "/api/admin/banners/home", {
            method: isEditing ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders()
            },
            body: JSON.stringify({
                imageUrl,
                targetUrl,
                altText
            })
        });

        toast(isEditing ? "Đã cập nhật banner" : "Đã thêm banner");
        await initBannersView();
    } catch (err) {
        setMessage("banners-msg", err.message, "error");
    }
}

async function deleteBannerById(id) {
    setMessage("banners-msg", "", "");

    try {
        await fetchJson(`/api/admin/banners/home/${id}`, {
            method: "DELETE",
            headers: {
                ...authHeaders()
            }
        });
        toast("Đã xóa banner");
        await initBannersView();
    } catch (err) {
        setMessage("banners-msg", err.message, "error");
    }
}

async function initBannersView() {
    setMessage("banners-msg", "", "");
    await loadBanners();
    renderBannersTable();
    showListPanel("banners");
    resetBannerForm();
}

// -----------------------------
// Messages (Tin nhắn hỗ trợ)
// -----------------------------

function supportConversationTimeValue(value) {
    if (!value) {
        return 0;
    }
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function supportConversationLabel(item) {
    const usernameValue = String(item && item.customerUsername ? item.customerUsername : "").trim();
    if (usernameValue) {
        return usernameValue;
    }
    const id = Number(item && item.customerId ? item.customerId : 0);
    return id > 0 ? `Khách #${id}` : "Khách hàng";
}

function formatSupportMessageTime(value) {
    if (!value) {
        return "";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return formatDateTime(value);
    }

    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    }).format(parsed);
}

function updateSupportUnreadTotal() {
    const unreadEl = document.getElementById("messages-unread-total");
    if (!unreadEl) {
        return;
    }

    const unread = supportConversationsCache.reduce((sum, item) => {
        const count = Number(item && item.unreadForAdmin ? item.unreadForAdmin : 0);
        return sum + (Number.isFinite(count) && count > 0 ? count : 0);
    }, 0);

    unreadEl.textContent = unread > 0 ? `${unread} chưa đọc` : "Đã đọc hết";
}

function sortSupportConversations(list) {
    return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
        const timeDiff = supportConversationTimeValue(b && b.lastMessageAt) - supportConversationTimeValue(a && a.lastMessageAt);
        if (timeDiff !== 0) {
            return timeDiff;
        }
        return Number(b && b.customerId ? b.customerId : 0) - Number(a && a.customerId ? a.customerId : 0);
    });
}

function filterSupportConversationsByKeyword() {
    const keyword = getKeywordFromInput("messages-search");
    const sorted = sortSupportConversations(supportConversationsCache);
    if (!keyword) {
        return sorted;
    }

    return sorted.filter((item) => {
        const haystack = [
            item && item.customerUsername ? item.customerUsername : "",
            item && item.customerEmail ? item.customerEmail : "",
            item && item.lastMessagePreview ? item.lastMessagePreview : "",
            item && item.lastSenderDisplayName ? item.lastSenderDisplayName : "",
            item && item.lastSenderRole ? item.lastSenderRole : "",
            item && item.customerId ? String(item.customerId) : ""
        ].join(" ");
        return includesKeyword(haystack, keyword);
    });
}

function renderSupportConversations() {
    const listEl = document.getElementById("messages-conversations");
    if (!listEl) {
        return;
    }

    updateSupportUnreadTotal();
    const filtered = filterSupportConversationsByKeyword();
    if (!filtered.length) {
        listEl.innerHTML = `
            <div class="admin-messages-empty muted">
                Chưa có hội thoại nào phù hợp.
            </div>
        `;
        return;
    }

    listEl.innerHTML = filtered.map((item) => {
        const customerId = Number(item && item.customerId ? item.customerId : 0);
        const unread = Number(item && item.unreadForAdmin ? item.unreadForAdmin : 0);
        const isActive = customerId > 0 && customerId === supportSelectedCustomerId;
        const preview = String(item && item.lastMessagePreview ? item.lastMessagePreview : "").trim();
        const sender = String(item && item.lastSenderDisplayName ? item.lastSenderDisplayName : "").trim();
        const previewText = sender ? `${sender}: ${preview}` : preview;

        return `
            <button
                class="admin-message-conversation-item ${isActive ? "is-active" : ""} ${unread > 0 ? "is-unread" : ""}"
                type="button"
                data-customer-id="${customerId}"
            >
                <div class="admin-message-conversation-head">
                    <strong>${escapeHtml(supportConversationLabel(item))}</strong>
                    <time>${escapeHtml(formatSupportMessageTime(item && item.lastMessageAt))}</time>
                </div>
                <div class="admin-message-conversation-email muted">${escapeHtml(item && item.customerEmail ? item.customerEmail : "")}</div>
                <div class="admin-message-conversation-preview">${escapeHtml(previewText || "Chưa có nội dung")}</div>
                ${unread > 0 ? `<span class="admin-message-unread-badge">${unread}</span>` : ""}
            </button>
        `;
    }).join("");
}

function setSupportReplyFormEnabled(enabled) {
    const input = document.getElementById("messages-reply-input");
    const submit = document.getElementById("messages-reply-submit");

    if (input) {
        input.disabled = !enabled;
    }
    if (submit) {
        submit.disabled = !enabled || supportReplySending;
    }
}

function renderSupportConversationDetail() {
    const titleEl = document.getElementById("messages-customer-title");
    const emailEl = document.getElementById("messages-customer-email");
    const threadEl = document.getElementById("messages-thread");

    if (!titleEl || !emailEl || !threadEl) {
        return;
    }

    if (!supportConversationDetail || !supportSelectedCustomerId) {
        titleEl.textContent = "Chưa chọn hội thoại";
        emailEl.textContent = "";
        threadEl.innerHTML = `
            <div class="admin-messages-empty muted">
                Chọn một khách hàng bên trái để bắt đầu trả lời.
            </div>
        `;
        setSupportReplyFormEnabled(false);
        return;
    }

    const detail = supportConversationDetail;
    titleEl.textContent = supportConversationLabel(detail);
    emailEl.textContent = detail.customerEmail || "";

    const messages = Array.isArray(detail.messages) ? detail.messages : [];
    if (!messages.length) {
        threadEl.innerHTML = `
            <div class="admin-messages-empty muted">
                Khách hàng này chưa có tin nhắn nào.
            </div>
        `;
    } else {
        threadEl.innerHTML = messages.map((message) => {
            const isAdminReply = !!(message && message.fromCurrentUser);
            const senderLabel = message && message.senderDisplayName
                ? message.senderDisplayName
                : (isAdminReply ? "Admin" : "Khách hàng");

            return `
                <article class="admin-message-bubble ${isAdminReply ? "is-admin" : "is-customer"}">
                    <div class="admin-message-bubble-head">
                        <strong>${escapeHtml(senderLabel)}</strong>
                        <time>${escapeHtml(formatSupportMessageTime(message && message.createdAt))}</time>
                    </div>
                    <p>${escapeHtml(message && message.content ? message.content : "")}</p>
                </article>
            `;
        }).join("");
        threadEl.scrollTop = threadEl.scrollHeight;
    }

    setSupportReplyFormEnabled(true);
}

function mergeSupportConversationSummary(detail) {
    if (!detail || !detail.customerId) {
        return;
    }

    const targetId = Number(detail.customerId);
    const messages = Array.isArray(detail.messages) ? detail.messages : [];
    const latest = messages.length ? messages[messages.length - 1] : null;
    const targetIndex = supportConversationsCache.findIndex((item) => Number(item && item.customerId ? item.customerId : 0) === targetId);
    const summary = {
        customerId: targetId,
        customerUsername: detail.customerUsername || "",
        customerEmail: detail.customerEmail || "",
        unreadForAdmin: Number(detail.unreadForAdmin || 0),
        lastMessagePreview: latest && latest.content ? String(latest.content).trim().slice(0, 120) : "",
        lastMessageAt: latest && latest.createdAt ? latest.createdAt : null,
        lastSenderRole: latest && latest.senderRole ? latest.senderRole : "",
        lastSenderDisplayName: latest && latest.senderDisplayName ? latest.senderDisplayName : ""
    };

    if (targetIndex >= 0) {
        supportConversationsCache[targetIndex] = {
            ...supportConversationsCache[targetIndex],
            ...summary
        };
        return;
    }

    supportConversationsCache.push(summary);
}

async function loadSupportConversations(options = {}) {
    const keepSelection = options.keepSelection !== false;
    const payload = await fetchJson("/api/admin/messages/conversations", {
        headers: {
            ...authHeaders()
        }
    });

    supportConversationsCache = Array.isArray(payload) ? payload : [];
    if (!keepSelection) {
        supportSelectedCustomerId = null;
    }

    const hasCurrentSelection = supportSelectedCustomerId != null
        && supportConversationsCache.some((item) => Number(item && item.customerId ? item.customerId : 0) === supportSelectedCustomerId);
    if (!hasCurrentSelection) {
        const sorted = sortSupportConversations(supportConversationsCache);
        supportSelectedCustomerId = sorted.length ? Number(sorted[0].customerId || 0) : null;
        if (!supportSelectedCustomerId) {
            supportSelectedCustomerId = null;
        }
    }

    renderSupportConversations();
    return supportConversationsCache;
}

async function loadSupportConversationDetail(customerId, markRead = true) {
    const safeCustomerId = Number(customerId || 0);
    if (!safeCustomerId) {
        supportSelectedCustomerId = null;
        supportConversationDetail = null;
        renderSupportConversationDetail();
        renderSupportConversations();
        return null;
    }

    const params = new URLSearchParams();
    params.set("markRead", markRead ? "true" : "false");

    const detail = await fetchJson(`/api/admin/messages/conversations/${encodeURIComponent(safeCustomerId)}?${params.toString()}`, {
        headers: {
            ...authHeaders()
        }
    });

    supportSelectedCustomerId = safeCustomerId;
    supportConversationDetail = detail || null;
    mergeSupportConversationSummary(detail);
    renderSupportConversations();
    renderSupportConversationDetail();
    return detail;
}

async function openSupportConversation(customerId) {
    const safeCustomerId = Number(customerId || 0);
    if (!safeCustomerId) {
        return;
    }

    setMessage("messages-msg", "", "");
    try {
        await loadSupportConversationDetail(safeCustomerId, true);
    } catch (err) {
        setMessage("messages-msg", err.message, "error");
    }
}

async function sendSupportReply(event) {
    if (event) {
        event.preventDefault();
    }

    setMessage("messages-msg", "", "");
    const customerId = Number(supportSelectedCustomerId || 0);
    if (!customerId) {
        setMessage("messages-msg", "Vui lòng chọn hội thoại cần phản hồi.", "error");
        return;
    }

    if (supportReplySending) {
        return;
    }

    const input = document.getElementById("messages-reply-input");
    const submitBtn = document.getElementById("messages-reply-submit");
    const content = String(input ? input.value : "").trim();
    if (!content) {
        setMessage("messages-msg", "Vui lòng nhập nội dung tin nhắn.", "error");
        return;
    }

    supportReplySending = true;
    if (submitBtn) {
        submitBtn.disabled = true;
    }

    try {
        await fetchJson(`/api/admin/messages/conversations/${encodeURIComponent(customerId)}/reply`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders()
            },
            body: JSON.stringify({ content })
        });

        if (input) {
            input.value = "";
            input.focus();
        }

        await loadSupportConversationDetail(customerId, true);
        renderSupportConversations();
        toast("Đã gửi phản hồi");
    } catch (err) {
        setMessage("messages-msg", err.message, "error");
    } finally {
        supportReplySending = false;
        setSupportReplyFormEnabled(true);
    }
}

async function pollSupportMessages() {
    if (supportPollingPending || currentViewFromHash() !== "messages") {
        return;
    }

    supportPollingPending = true;
    try {
        await loadSupportConversations({ keepSelection: true });
        if (supportSelectedCustomerId) {
            await loadSupportConversationDetail(supportSelectedCustomerId, true);
        } else {
            supportConversationDetail = null;
            renderSupportConversationDetail();
        }
    } catch (_) {
        // Polling should be silent; explicit errors are shown on manual actions.
    } finally {
        supportPollingPending = false;
    }
}

function stopSupportMessagePolling() {
    if (supportPollingTimer) {
        clearInterval(supportPollingTimer);
        supportPollingTimer = null;
    }
    supportPollingPending = false;
}

function startSupportMessagePolling() {
    stopSupportMessagePolling();
    supportPollingTimer = setInterval(() => {
        pollSupportMessages();
    }, SUPPORT_MESSAGES_POLL_MS);
}

async function initMessagesView(options = {}) {
    const keepSelection = options.keepSelection !== false;
    setMessage("messages-msg", "", "");

    await loadSupportConversations({ keepSelection });
    if (supportSelectedCustomerId) {
        await loadSupportConversationDetail(supportSelectedCustomerId, true);
    } else {
        supportConversationDetail = null;
        renderSupportConversationDetail();
    }

    startSupportMessagePolling();
}

// -----------------------------
// Users (Tài khoản)
// -----------------------------

function usersCreatePanelElements() {
    return {
        panel: document.getElementById("users-create-panel"),
        form: document.getElementById("users-create-form"),
        fullName: document.getElementById("users-create-full-name"),
        username: document.getElementById("users-create-username"),
        email: document.getElementById("users-create-email"),
        password: document.getElementById("users-create-password"),
        passwordConfirm: document.getElementById("users-create-password-confirm"),
        phone: document.getElementById("users-create-phone"),
        address: document.getElementById("users-create-address"),
        role: document.getElementById("users-create-role"),
        roleHint: document.getElementById("users-create-role-hint"),
        submit: document.getElementById("users-create-submit")
    };
}

function resolvePasswordToggleLabel(button, visible) {
    const defaultShow = "Hi\u1ec3n th\u1ecb m\u1eadt kh\u1ea9u";
    const defaultHide = "\u1ea8n m\u1eadt kh\u1ea9u";
    const rawShow = String(button ? button.getAttribute("data-label-show") : "").trim();
    const rawHide = String(button ? button.getAttribute("data-label-hide") : "").trim();
    if (visible) {
        return rawHide || defaultHide;
    }
    return rawShow || defaultShow;
}

function bindUsersCreatePasswordToggles() {
    const { panel } = usersCreatePanelElements();
    if (!panel) {
        return;
    }

    const toggleButtons = panel.querySelectorAll("[data-password-target]");
    toggleButtons.forEach((button) => {
        if (button.dataset.passwordToggleBound === "1") {
            return;
        }
        button.dataset.passwordToggleBound = "1";

        button.addEventListener("click", () => {
            const targetId = String(button.getAttribute("data-password-target") || "").trim();
            if (!targetId) {
                return;
            }

            const input = document.getElementById(targetId);
            if (!input) {
                return;
            }

            const visible = input.type === "password";
            input.type = visible ? "text" : "password";
            button.setAttribute("aria-label", resolvePasswordToggleLabel(button, visible));
            button.setAttribute("data-password-visible", visible ? "1" : "0");
        });
    });
}

function resetUsersCreatePasswordVisibility() {
    const { panel } = usersCreatePanelElements();
    if (!panel) {
        return;
    }

    const toggleButtons = panel.querySelectorAll("[data-password-target]");
    toggleButtons.forEach((button) => {
        const targetId = String(button.getAttribute("data-password-target") || "").trim();
        if (targetId) {
            const input = document.getElementById(targetId);
            if (input) {
                input.type = "password";
            }
        }
        button.setAttribute("aria-label", resolvePasswordToggleLabel(button, false));
        button.setAttribute("data-password-visible", "0");
    });
}

function syncUsersCreateRoleOptions() {
    const { role, roleHint } = usersCreatePanelElements();
    if (!role) {
        return;
    }

    if (isSuperAdmin()) {
        role.innerHTML = `
            <option value="CUSTOMER" selected>CUSTOMER</option>
            <option value="ADMIN">ADMIN</option>
        `;
        role.disabled = false;
        if (roleHint) {
            roleHint.textContent = "SUPER_ADMIN có thể tạo CUSTOMER hoặc ADMIN.";
        }
        return;
    }

    role.innerHTML = `<option value="CUSTOMER" selected>CUSTOMER</option>`;
    role.disabled = true;
    if (roleHint) {
        roleHint.textContent = "Tài khoản ADMIN chỉ có thể được tạo bởi SUPER_ADMIN.";
    }
}

function resetUsersCreateForm() {
    const { form, passwordConfirm } = usersCreatePanelElements();
    if (form) {
        form.reset();
    }
    if (passwordConfirm) {
        passwordConfirm.setCustomValidity("");
    }
    resetUsersCreatePasswordVisibility();
    syncUsersCreateRoleOptions();
}

function openUsersCreatePanel() {
    const { panel, fullName, username } = usersCreatePanelElements();
    if (!panel) {
        return;
    }
    panel.hidden = false;
    resetUsersCreateForm();
    if (fullName) {
        fullName.focus();
    } else if (username) {
        username.focus();
    }
}

function closeUsersCreatePanel() {
    const { panel } = usersCreatePanelElements();
    if (!panel) {
        return;
    }
    panel.hidden = true;
    resetUsersCreateForm();
}

async function createUserFromAdmin(event) {
    if (event) {
        event.preventDefault();
    }

    if (userCreateSaving) {
        return;
    }

    setMessage("users-msg", "", "");
    const {
        form,
        fullName,
        username,
        email,
        password,
        passwordConfirm,
        phone,
        address,
        role,
        submit
    } = usersCreatePanelElements();

    if (passwordConfirm) {
        passwordConfirm.setCustomValidity("");
    }

    const payload = {
        fullName: String(fullName ? fullName.value : "").trim(),
        username: String(username ? username.value : "").trim(),
        email: String(email ? email.value : "").trim(),
        password: String(password ? password.value : "").trim(),
        passwordConfirm: String(passwordConfirm ? passwordConfirm.value : "").trim(),
        phone: String(phone ? phone.value : "").trim(),
        address: String(address ? address.value : "").trim(),
        role: String(role ? role.value : "CUSTOMER").trim().toUpperCase()
    };

    if (!payload.username) {
        setMessage("users-msg", "T\u00ean \u0111\u0103ng nh\u1eadp kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng.", "error");
        if (username) {
            username.focus();
        }
        return;
    }

    if (!payload.email) {
        setMessage("users-msg", "Email kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng.", "error");
        if (email) {
            email.focus();
        }
        return;
    }

    if (!payload.password) {
        setMessage("users-msg", "M\u1eadt kh\u1ea9u kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng.", "error");
        if (password) {
            password.focus();
        }
        return;
    }

    if (payload.password.length < 6) {
        setMessage("users-msg", "M\u1eadt kh\u1ea9u ph\u1ea3i t\u1eeb 6 k\u00fd t\u1ef1 tr\u1edf l\u00ean.", "error");
        if (password) {
            password.focus();
        }
        return;
    }

    if (!payload.passwordConfirm) {
        setMessage("users-msg", "Vui l\u00f2ng x\u00e1c nh\u1eadn m\u1eadt kh\u1ea9u.", "error");
        if (passwordConfirm) {
            passwordConfirm.focus();
        }
        return;
    }

    if (payload.password !== payload.passwordConfirm) {
        const mismatchMessage = "X\u00e1c nh\u1eadn m\u1eadt kh\u1ea9u kh\u00f4ng kh\u1edbp.";
        setMessage("users-msg", mismatchMessage, "error");
        if (passwordConfirm) {
            passwordConfirm.setCustomValidity(mismatchMessage);
            passwordConfirm.reportValidity();
            passwordConfirm.focus();
        }
        return;
    }

    if (!payload.fullName) {
        setMessage("users-msg", "H\u1ecd v\u00e0 t\u00ean kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng.", "error");
        if (fullName) {
            fullName.focus();
        }
        return;
    }

    if (form && !form.checkValidity()) {
        const invalidField = form.querySelector(":invalid");
        if (invalidField) {
            setMessage("users-msg", getVietnameseConstraintMessage(invalidField), "error");
            invalidField.reportValidity();
            invalidField.focus();
        } else {
            form.reportValidity();
        }
        return;
    }

    const requestPayload = {
        fullName: payload.fullName,
        username: payload.username,
        email: payload.email,
        password: payload.password,
        phone: payload.phone,
        address: payload.address,
        role: payload.role
    };

    userCreateSaving = true;
    if (submit) {
        submit.disabled = true;
    }

    try {
        await fetchJson("/api/admin/users", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders()
            },
            body: JSON.stringify(requestPayload)
        });

        toast("Đã tạo tài khoản");
        closeUsersCreatePanel();
        await initUsersView({ resetPage: false });
    } catch (err) {
        setMessage("users-msg", err.message, "error");
    } finally {
        userCreateSaving = false;
        if (submit) {
            submit.disabled = false;
        }
    }
}

async function loadUsers() {
    const keyword = getRawInputValue("users-search");
    const sortDir = normalizeUserSortDir(usersPageState.sortDir);
    usersPageState.sortDir = sortDir;

    const params = new URLSearchParams({
        page: String(usersPageState.page),
        size: String(usersPageState.size)
    });
    if (keyword) {
        params.set("keyword", keyword);
    }
    params.set("sortDir", sortDir);

    // Server-side paging avoids heavy user table rendering on large datasets.
    let payload = await fetchJson(`/api/admin/users/paged?${params.toString()}`, {
        headers: {
            ...authHeaders()
        }
    }) || {};

    applyPageState(usersPageState, payload);

    if (usersPageState.totalPages > 0 && usersPageState.page > usersPageState.totalPages - 1) {
        usersPageState.page = usersPageState.totalPages - 1;
        params.set("page", String(usersPageState.page));
        payload = await fetchJson(`/api/admin/users/paged?${params.toString()}`, {
            headers: {
                ...authHeaders()
            }
        }) || {};
        applyPageState(usersPageState, payload);
    }

    usersCache = Array.isArray(payload.items) ? payload.items : [];
    renderPagination("users", usersPageState);

    return usersCache;
}

function renderUsersTable() {
    const tbody = document.getElementById("users-body");
    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";

    const canSetRole = isSuperAdmin();
    if (!usersCache.length) {
        renderEmptyRow(tbody, 7, "Không có tài khoản phù hợp");
        return;
    }

    usersCache.forEach((user) => {
        const userUsername = String(user.username || "").trim();
        const created = user.createdAt ? formatDateTime(user.createdAt) : "";
        const canDelete = user.role === "CUSTOMER";
        const isActive = user.active !== false;
        const isLocked = isFutureDateTime(user.lockoutUntil);
        const lockUntilLabel = isLocked ? formatDateTime(user.lockoutUntil) : "";
        const failedAttempts = Number(user.failedLoginAttempts || 0);

        const fullName = String(user.fullName || "").trim();
        const usernameText = userUsername;
        const displayName = fullName || usernameText || "N/A";
        const usernameCaption = fullName && usernameText ? `<div class="muted">@${escapeHtml(usernameText)}</div>` : "";
        const statusActiveLabel = isActive ? "Hoạt động" : "Đã tắt hoạt động";
        const statusLockLabel = isLocked
            ? `Tạm khóa đến ${lockUntilLabel || "N/A"}`
            : `Không khóa (${Math.max(0, failedAttempts)} lần sai gần đây)`;
        const statusCell = `
            <div><strong>${escapeHtml(statusActiveLabel)}</strong></div>
            <div class="muted">${escapeHtml(statusLockLabel)}</div>
        `;

        const roleCell = canSetRole
            ? `
                <select class="select" data-action="user-role" data-id="${user.id}" ${user.role === "SUPER_ADMIN" ? "disabled" : ""}>
                    <option value="CUSTOMER" ${user.role === "CUSTOMER" ? "selected" : ""}>CUSTOMER</option>
                    <option value="ADMIN" ${user.role === "ADMIN" ? "selected" : ""}>ADMIN</option>
                    <option value="SUPER_ADMIN" ${user.role === "SUPER_ADMIN" ? "selected" : ""} disabled>SUPER_ADMIN</option>
                </select>
              `
            : `<strong>${escapeHtml(user.role)}</strong>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${user.id}</td>
            <td><strong>${escapeHtml(displayName)}</strong>${usernameCaption}</td>
            <td class="muted">${escapeHtml(user.email || "")}</td>
            <td>${roleCell}</td>
            <td>${statusCell}</td>
            <td class="muted">${escapeHtml(created)}</td>
            <td class="col-center">
                <div class="table-actions">
                    <button class="btn btn-outline btn-sm action-btn action-btn-view" type="button" data-action="user-view" data-id="${user.id}">
                        ${actionIcon("M1 12s4-7 11-7 11 7-4 7-11 7S1 12 1 12", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6")}
                        <span>Chi tiết</span>
                    </button>
                    <button class="btn btn-danger btn-sm action-btn action-btn-delete" type="button" data-action="user-delete" data-id="${user.id}" ${canDelete ? "" : "disabled"}>
                        ${actionIcon("M3 6h18", "M8 6V4h8v2M6 6l1 14h10l1-14")}
                        <span>Xóa</span>
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

async function deleteUserById(id) {
    setMessage("users-msg", "", "");

    try {
        await fetchJson(`/api/admin/users/${id}`, {
            method: "DELETE",
            headers: {
                ...authHeaders()
            }
        });

        toast("Đã xóa tài khoản");
        await initUsersView({ resetPage: false });
    } catch (err) {
        setMessage("users-msg", err.message, "error");
    }
}

async function updateUserRoleById(id, newRole) {
    setMessage("users-msg", "", "");

    if (!isSuperAdmin()) {
        setMessage("users-msg", "Bạn không có quyền cấp role.", "error");
        return;
    }

    if (!newRole || newRole === "SUPER_ADMIN") {
        setMessage("users-msg", "Role không hợp lệ.", "error");
        return;
    }

    try {
        await fetchJson(`/api/super-admin/users/${id}/role`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders()
            },
            body: JSON.stringify({ role: newRole })
        });

        toast("Đã cập nhật role");
        await initUsersView({ resetPage: false });
    } catch (err) {
        setMessage("users-msg", err.message, "error");
        await initUsersView({ resetPage: false }); // Đồng bộ lại select role theo dữ liệu thật từ server.
    }
}

async function initUsersView(options = {}) {
    const resetPage = options.resetPage !== false;
    if (resetPage) {
        usersPageState.page = 0;
    }
    usersPageState.sortDir = normalizeUserSortDir(usersPageState.sortDir);

    const sortSelect = document.getElementById("users-sort-id");
    if (sortSelect) {
        sortSelect.value = usersPageState.sortDir;
    }

    syncUsersCreateRoleOptions();
    setMessage("users-msg", "", "");
    await loadUsers();
    renderUsersTable();
}

// -----------------------------
// View bootstrap
// -----------------------------

async function initView(view) {
    if (view !== "messages") {
        stopSupportMessagePolling();
    }

    if (view === "dashboard") {
        await loadStats();
        return;
    }

    if (view === "orders") {
        await loadOrders();
        return;
    }

    if (view === "products") {
        await initProductsView({ resetPage: true });
        return;
    }

    if (view === "categories") {
        await initCategoriesView();
        return;
    }

    if (view === "promotions") {
        await initPromotionsView();
        return;
    }

    if (view === "banners") {
        await initBannersView();
        return;
    }

    if (view === "messages") {
        await initMessagesView({ keepSelection: true });
        return;
    }

    if (view === "users") {
        await initUsersView({ resetPage: true });
    }
}

function logout() {
    stopSupportMessagePolling();

    // Clear backend HttpOnly cookie used for server-side protected routes.
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
    window.location.href = "/";
}

function bindSearchInput(id, renderFn) {
    const input = document.getElementById(id);
    if (!input) {
        return;
    }

    input.addEventListener("input", () => {
        renderFn();
    });
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

    bindVietnameseConstraintValidation(document);
    bindUsersCreatePasswordToggles();

    initProductSpecsEditor();
    bindProductGalleryActions();

    // Bind form submit.
    const productForm = document.getElementById("product-form");
    if (productForm) productForm.addEventListener("submit", saveProduct);

    const categoryForm = document.getElementById("category-form");
    if (categoryForm) categoryForm.addEventListener("submit", saveCategory);

    const promotionForm = document.getElementById("promotion-form");
    if (promotionForm) promotionForm.addEventListener("submit", savePromotion);

    const bannerForm = document.getElementById("banner-form");
    if (bannerForm) bannerForm.addEventListener("submit", saveBanner);

    const messagesReplyForm = document.getElementById("messages-reply-form");
    if (messagesReplyForm) {
        messagesReplyForm.addEventListener("submit", sendSupportReply);
    }

    const usersCreateForm = document.getElementById("users-create-form");
    if (usersCreateForm) {
        usersCreateForm.addEventListener("submit", createUserFromAdmin);
    }

    const messagesConversations = document.getElementById("messages-conversations");
    if (messagesConversations) {
        messagesConversations.addEventListener("click", async (event) => {
            const item = event.target.closest("[data-customer-id]");
            if (!item) {
                return;
            }

            const customerId = Number(item.getAttribute("data-customer-id") || 0);
            if (!customerId || customerId === supportSelectedCustomerId) {
                return;
            }

            await openSupportConversation(customerId);
        });
    }

    // Bind nút điều khiển panel list/edit.
    const bindClick = (id, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener("click", handler);
        }
    };

    bindClick("products-create", openCreateProductPanel);
    bindClick("product-back-list", closeProductPanel);
    bindClick("product-cancel", closeProductPanel);
    bindClick("products-filter-apply", async () => {
        productsPageState.page = 0;
        await loadProducts();
        renderProductsTable();
    });
    bindClick("product-media-upload", uploadProductMediaFiles);
    bindClick("product-image-ai-enhance", enhanceProductImageWithAi);
    bindClick("product-image-ai-accept", acceptProductAiImage);
    bindClick("product-image-ai-cancel", () => {
        void cancelProductImageEnhancement().catch(() => {});
    });

    bindClick("categories-create", openCreateCategoryPanel);
    bindClick("category-back-list", closeCategoryPanel);
    bindClick("category-cancel", closeCategoryPanel);

    bindClick("promotions-create", openCreatePromotionPanel);
    bindClick("promotion-back-list", closePromotionPanel);
    bindClick("promotion-cancel", closePromotionPanel);
    bindClick("banners-create-toggle", openCreateBannerPanel);
    bindClick("banner-back-list", closeBannerPanel);
    bindClick("banner-cancel", closeBannerPanel);
    bindClick("users-create-toggle", openUsersCreatePanel);
    bindClick("users-create-cancel", closeUsersCreatePanel);

    // Bind nút làm mới theo view.
    const bindRefresh = (id, fn) => {
        const button = document.getElementById(id);
        if (!button) {
            return;
        }

        button.addEventListener("click", async () => {
            try {
                await fn();
                toast("Đã làm mới dữ liệu");
            } catch (err) {
                alert(err.message);
            }
        });
    };

    bindRefresh("orders-refresh", loadOrders);
    bindRefresh("revenue-chart-refresh", loadRevenueDetail);
    bindRefresh("products-refresh", async () => {
        await initProductsView({ resetPage: false });
    });
    bindRefresh("categories-refresh", initCategoriesView);
    bindRefresh("promotions-refresh", initPromotionsView);
    bindRefresh("banners-refresh", initBannersView);
    bindRefresh("messages-refresh", async () => {
        await initMessagesView({ keepSelection: true });
    });
    bindRefresh("users-refresh", async () => {
        await initUsersView({ resetPage: false });
    });

    // Bind filter/sort cho bảng phân trang server-side.
    bindRemoteSearchInput("orders-search", async () => {
        ordersPageState.page = 0;
        await loadOrders();
    });

    const ordersSortSelect = document.getElementById("orders-sort-id");
    if (ordersSortSelect) {
        ordersSortSelect.value = normalizeOrderSortDir(ordersPageState.sortDir);
        ordersSortSelect.addEventListener("change", async () => {
            ordersPageState.sortDir = normalizeOrderSortDir(ordersSortSelect.value);
            ordersPageState.page = 0;
            await loadOrders();
        });
    }

    const ordersStatusFilter = document.getElementById("orders-status-filter");
    if (ordersStatusFilter) {
        ordersStatusFilter.addEventListener("change", async () => {
            ordersPageState.page = 0;
            await loadOrders();
        });
    }

    const ordersPaymentStatusFilter = document.getElementById("orders-payment-status-filter");
    if (ordersPaymentStatusFilter) {
        ordersPaymentStatusFilter.addEventListener("change", async () => {
            ordersPageState.page = 0;
            await loadOrders();
        });
    }

    const ordersPaymentProviderFilter = document.getElementById("orders-payment-provider-filter");
    if (ordersPaymentProviderFilter) {
        ordersPaymentProviderFilter.addEventListener("change", async () => {
            ordersPageState.page = 0;
            await loadOrders();
        });
    }

    bindRemoteSearchInput("products-search", async () => {
        productsPageState.page = 0;
        await loadProducts();
        renderProductsTable();
    });
    const productsSortSelect = document.getElementById("products-sort-id");
    if (productsSortSelect) {
        productsSortSelect.addEventListener("change", async () => {
            productsPageState.sortDir = normalizeProductSortDir(productsSortSelect.value);
            productsPageState.page = 0;
            await loadProducts();
            renderProductsTable();
        });
    }
    bindRemoteSearchInput("users-search", async () => {
        usersPageState.page = 0;
        await loadUsers();
        renderUsersTable();
    });
    const usersSortSelect = document.getElementById("users-sort-id");
    if (usersSortSelect) {
        usersSortSelect.addEventListener("change", async () => {
            usersPageState.sortDir = normalizeUserSortDir(usersSortSelect.value);
            usersPageState.page = 0;
            await loadUsers();
            renderUsersTable();
        });
    }

    // Bind tìm kiếm realtime (client-side lists).
    bindSearchInput("categories-search", renderCategoriesTable);
    bindSearchInput("promotions-search", renderPromotionsTable);
    bindSearchInput("messages-search", renderSupportConversations);
    const categoriesSortSelect = document.getElementById("categories-sort-id");
    if (categoriesSortSelect) {
        categoriesSortSelect.value = normalizeIdSortDir(categoriesSortSelect.value);
        categoriesSortSelect.addEventListener("change", () => {
            categoriesSortSelect.value = normalizeIdSortDir(categoriesSortSelect.value);
            renderCategoriesTable();
        });
    }
    const promotionsSortSelect = document.getElementById("promotions-sort-id");
    if (promotionsSortSelect) {
        promotionsSortSelect.value = normalizeIdSortDir(promotionsSortSelect.value);
        promotionsSortSelect.addEventListener("change", () => {
            promotionsSortSelect.value = normalizeIdSortDir(promotionsSortSelect.value);
            renderPromotionsTable();
        });
    }

    // Bind pagination buttons for server-side paged tables.
    bindPaginationButtons("orders", ordersPageState, loadOrders);
    bindPaginationButtons("products", productsPageState, async () => {
        await loadProducts();
        renderProductsTable();
    });
    bindPaginationButtons("users", usersPageState, async () => {
        await loadUsers();
        renderUsersTable();
    });

    const revenueRangeDays = document.getElementById("revenue-range-days");
    if (revenueRangeDays) {
        revenueRangeDays.addEventListener("change", async () => {
            await loadRevenueDetail();
        });
    }

    const revenueGroupBy = document.getElementById("revenue-group-by");
    if (revenueGroupBy) {
        revenueGroupBy.addEventListener("change", async () => {
            await loadRevenueDetail();
        });
    }

    const revenueChartType = document.getElementById("revenue-chart-type");
    if (revenueChartType) {
        // tac dung code: luu kieu bieu do nguoi dung chon de giu trai nghiem nhat quan giua cac lan mo trang admin.
        const savedChartType = String(localStorage.getItem("admin_revenue_chart_type") || "").toLowerCase();
        if (savedChartType === "line" || savedChartType === "area" || savedChartType === "bar") {
            revenueChartType.value = savedChartType;
        }

        revenueChartType.addEventListener("change", async () => {
            localStorage.setItem("admin_revenue_chart_type", readRevenueChartType());
            await loadRevenueDetail();
        });
    }

    const productImageInput = document.getElementById("product-image");
    if (productImageInput) {
        productImageInput.addEventListener("input", () => {
            void cancelProductImageEnhancement({ silent: true }).catch(() => {
                clearProductAiCompare();
                syncProductAiSourcePreview();
            });
            refreshProductMediaPreview();
        });
    }

    const productGalleryInput = document.getElementById("product-gallery");
    if (productGalleryInput) {
        productGalleryInput.addEventListener("input", () => {
            refreshProductMediaPreview();
        });
    }

    PRODUCT_SPEC_FIELD_IDS.forEach((fieldId) => {
        const input = document.getElementById(fieldId);
        if (!input) {
            return;
        }

        input.addEventListener("input", () => {
            refreshProductQuickSpecsFromDefaultFields();
        });
    });

    const productCategoryInput = document.getElementById("product-category");
    if (productCategoryInput) {
        productCategoryInput.addEventListener("change", () => {
            applyProductSpecUiFromSelectedCategory();
            refreshProductQuickSpecsFromDefaultFields({ keepCurrent: true });
        });
    }

    const productMediaFileInput = document.getElementById("product-media-files");
    if (productMediaFileInput) {
        productMediaFileInput.addEventListener("change", () => {
            void cancelProductImageEnhancement({ silent: true }).catch(() => {
                clearProductAiCompare();
                syncProductAiSourcePreview();
            });
            syncProductAiSourcePreview();
            syncAiActionButtons();
        });
    }

    const productAiSourcePreview = document.getElementById("product-ai-source-preview");
    if (productAiSourcePreview) {
        productAiSourcePreview.addEventListener("click", () => {
            if (productAiSourcePreview.hidden) {
                return;
            }
            openAdminImageLightbox(
                productAiSourcePreview.currentSrc || productAiSourcePreview.src,
                "Ảnh trước khi sửa"
            );
        });
    }

    const productAiResultPreview = document.getElementById("product-ai-result-preview");
    if (productAiResultPreview) {
        productAiResultPreview.addEventListener("click", () => {
            if (productAiResultPreview.hidden) {
                return;
            }
            openAdminImageLightbox(
                productAiResultPreview.currentSrc || productAiResultPreview.src,
                "Kết quả sau chỉnh sửa"
            );
        });
    }

    syncProductAiSourcePreview();
    syncAiActionButtons();

    // Delegation click cho các nút hành động trong bảng.
    document.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        const action = button.getAttribute("data-action");
        const id = Number(button.getAttribute("data-id") || 0);
        if (!action || !id) {
            return;
        }

        if (action === "order-delete") {
            if (!confirm("Xóa đơn hàng này? Hành động không thể hoàn tác.")) {
                return;
            }
            await deleteOrderById(id);
            return;
        }

        if (action === "product-edit") {
            openEditProductPanel(id);
            return;
        }

        if (action === "product-delete") {
            if (!confirm("Xóa sản phẩm này?")) {
                return;
            }
            await deleteProductById(id);
            return;
        }

        if (action === "category-edit") {
            openEditCategoryPanel(id);
            return;
        }

        if (action === "category-delete") {
            if (!confirm("Xóa danh mục này?")) {
                return;
            }
            await deleteCategoryById(id);
            return;
        }

        if (action === "promotion-edit") {
            openEditPromotionPanel(id);
            return;
        }

        if (action === "promotion-delete") {
            if (!confirm("Xóa khuyến mãi này?")) {
                return;
            }
            await deletePromotionById(id);
            return;
        }

        if (action === "banner-edit") {
            openEditBannerPanel(id);
            return;
        }

        if (action === "banner-delete") {
            if (!confirm("Xóa banner này?")) {
                return;
            }
            await deleteBannerById(id);
            return;
        }

        if (action === "user-view") {
            window.location.href = `/admin/users/${encodeURIComponent(id)}`;
            return;
        }

        if (action === "user-delete") {
            if (!confirm("Xóa tài khoản khách hàng này?")) {
                return;
            }
            await deleteUserById(id);
            return;
        }
    });

    // Delegation change cho dropdown role.
    document.addEventListener("change", async (event) => {
        const target = event.target;
        if (!target || target.getAttribute("data-action") !== "user-role") {
            return;
        }

        const id = Number(target.getAttribute("data-id") || 0);
        const newRole = target.value;
        if (!id || !newRole) {
            return;
        }

        await updateUserRoleById(id, newRole);
    });

    // Đóng modal khi click overlay.
    const orderModal = document.getElementById("order-modal");
    if (orderModal) {
        orderModal.addEventListener("click", (event) => {
            const target = event.target;
            if (target && target.getAttribute("data-close") === "1") {
                closeOrderModal();
            }
        });
    }

    const imageLightbox = document.getElementById("admin-image-lightbox");
    if (imageLightbox) {
        imageLightbox.addEventListener("click", (event) => {
            const target = event.target;
            if (target && target.getAttribute("data-lightbox-close") === "1") {
                closeAdminImageLightbox();
            }
        });
    }

    const imageLightboxCloseBtn = document.getElementById("admin-image-lightbox-close");
    if (imageLightboxCloseBtn) {
        imageLightboxCloseBtn.addEventListener("click", closeAdminImageLightbox);
    }

    // ESC để đóng modal.
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAdminImageLightbox();
            closeOrderModal();
        }
    });

    // Click menu trái => đổi hash để giữ state.
    const menu = document.getElementById("admin-menu");
    if (menu) {
        menu.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-view]");
            if (!button) {
                return;
            }

            const nextView = button.getAttribute("data-view");
            if (!nextView || nextView === currentViewFromHash()) {
                return;
            }

            window.location.hash = nextView;
        });
    }

    const applyView = async () => {
        const view = currentViewFromHash();
        showView(view);

        try {
            await initView(view);
        } catch (err) {
            alert(err.message);
        }
    };

    window.addEventListener("hashchange", applyView);
    await applyView();
});

window.addEventListener("beforeunload", () => {
    stopSupportMessagePolling();
    clearLocalProductPreviewUrl();
});

// Expose để HTML inline handlers gọi được.
window.updateOrderStatus = updateOrderStatus;
window.handleOrderStatusChange = handleOrderStatusChange;
window.logout = logout;
window.AdminUI = {
    closeOrderModal
};



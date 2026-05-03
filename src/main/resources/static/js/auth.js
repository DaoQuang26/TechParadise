// auth.js
// Handle login/register/forgot-password pages and keep JWT/role in localStorage for API calls.
const API_BASE = "";
const VN_ADDRESS_API = "https://provinces.open-api.vn/api";

const registerAddressCache = {
    provinces: null,
    districts: new Map(),
    wards: new Map()
};
const FORGOT_RESET_COOLDOWN_SECONDS = 30;
const forgotResetUiState = {
    cooldownTimerId: null,
    cooldownRemaining: 0,
    tokenVerified: false,
    verifiedToken: ""
};
const registerAddressUiState = {
    districtRequestId: 0,
    wardRequestId: 0
};
const FALLBACK_PROVINCE_CODE_PREFIX = "fallback-province-";
const FALLBACK_PROVINCES = [
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
].map((name, index) => ({
    code: `${FALLBACK_PROVINCE_CODE_PREFIX}${index + 1}`,
    name
}));
const FALLBACK_DISTRICT_OPTION_NAME = "Quận/Huyện (không tải được, vui lòng chọn)";
const FALLBACK_WARD_OPTION_NAME = "Phường/Xã (không tải được, vui lòng chọn)";

function isFallbackAddressCode(code) {
    const value = String(code || "").trim();
    if (!value) {
        return false;
    }
    return value.startsWith(FALLBACK_PROVINCE_CODE_PREFIX)
        || value.endsWith("-district-fallback")
        || value.endsWith("-ward-fallback");
}

function isFallbackAddressName(name) {
    const value = String(name || "").trim();
    if (!value) {
        return false;
    }
    return value === FALLBACK_DISTRICT_OPTION_NAME || value === FALLBACK_WARD_OPTION_NAME;
}

function setButtonLoading(buttonEl, isLoading, loadingText) {
    if (!buttonEl) {
        return;
    }
    const idleText = buttonEl.dataset.idleText || buttonEl.textContent || "";
    if (!buttonEl.dataset.idleText) {
        buttonEl.dataset.idleText = idleText;
    }
    buttonEl.disabled = !!isLoading;
    buttonEl.textContent = isLoading ? String(loadingText || "Đang xử lý...") : buttonEl.dataset.idleText;
}

function clearForgotResetCooldown() {
    if (forgotResetUiState.cooldownTimerId) {
        clearInterval(forgotResetUiState.cooldownTimerId);
        forgotResetUiState.cooldownTimerId = null;
    }
    forgotResetUiState.cooldownRemaining = 0;

    const cooldownEl = document.getElementById("forgot-resend-cooldown");
    if (cooldownEl) {
        cooldownEl.style.display = "none";
        cooldownEl.textContent = "";
    }
}

function startForgotResetCooldown(seconds = FORGOT_RESET_COOLDOWN_SECONDS) {
    clearForgotResetCooldown();
    const cooldownEl = document.getElementById("forgot-resend-cooldown");
    forgotResetUiState.cooldownRemaining = Math.max(0, Number(seconds || 0));

    const render = () => {
        if (!cooldownEl) {
            return;
        }
        if (forgotResetUiState.cooldownRemaining <= 0) {
            cooldownEl.style.display = "none";
            cooldownEl.textContent = "";
            return;
        }
        cooldownEl.style.display = "block";
        cooldownEl.textContent = `Bạn có thể yêu cầu mã mới sau ${forgotResetUiState.cooldownRemaining}s.`;
    };

    render();
    if (forgotResetUiState.cooldownRemaining <= 0) {
        return;
    }

    forgotResetUiState.cooldownTimerId = setInterval(() => {
        forgotResetUiState.cooldownRemaining = Math.max(0, forgotResetUiState.cooldownRemaining - 1);
        render();
        if (forgotResetUiState.cooldownRemaining <= 0) {
            clearForgotResetCooldown();
        }
    }, 1000);
}

function updateForgotResetSteps(step) {
    const requestStep = document.getElementById("reset-step-request");
    const submitStep = document.getElementById("reset-step-submit");
    if (!requestStep || !submitStep) {
        return;
    }

    const isResetStep = step === "reset";
    requestStep.classList.toggle("is-active", !isResetStep);
    requestStep.classList.toggle("is-done", isResetStep);
    submitStep.classList.toggle("is-active", isResetStep);
}

function setForgotIdentifierReadonly(isReadonly) {
    const identifierInput = document.getElementById("forgot-identifier");
    if (!identifierInput) {
        return;
    }
    identifierInput.readOnly = !!isReadonly;
}

function setResetPasswordStage(stage) {
    const tokenStageForm = document.getElementById("reset-token-form");
    const passwordStageForm = document.getElementById("reset-password-form");
    if (tokenStageForm) {
        tokenStageForm.hidden = stage !== "token";
    }
    if (passwordStageForm) {
        passwordStageForm.hidden = stage !== "password";
    }
}

function clearVerifiedResetToken() {
    forgotResetUiState.tokenVerified = false;
    forgotResetUiState.verifiedToken = "";
    const hiddenTokenInput = document.getElementById("reset-token-confirmed");
    if (hiddenTokenInput) {
        hiddenTokenInput.value = "";
    }
}

function markVerifiedResetToken(token) {
    const safeToken = String(token || "").trim();
    forgotResetUiState.tokenVerified = safeToken.length > 0;
    forgotResetUiState.verifiedToken = safeToken;
    const hiddenTokenInput = document.getElementById("reset-token-confirmed");
    if (hiddenTokenInput) {
        hiddenTokenInput.value = safeToken;
    }
}

function passwordStrengthState(password) {
    const value = String(password || "");
    return {
        length: value.length >= 7
    };
}

function renderPasswordRules(password) {
    const state = passwordStrengthState(password);
    const map = [
        ["rule-length", state.length]
    ];

    map.forEach(([id, ok]) => {
        const el = document.getElementById(id);
        if (!el) {
            return;
        }
        el.classList.toggle("is-ok", !!ok);
        el.classList.toggle("is-bad", !ok && String(password || "").length > 0);
    });
}

function saveSession(auth) {
    // Persist login state for API Authorization headers on the client side.
    localStorage.setItem("techstore_token", auth.token);
    localStorage.setItem("techstore_role", auth.role);
    localStorage.setItem("techstore_user", auth.username);
}

function logout() {
    // Clear server-side HttpOnly cookie (best-effort) and localStorage session keys.
    fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "same-origin"
    }).catch(() => {
        // Ignore network errors on logout.
    });

    localStorage.removeItem("techstore_token");
    localStorage.removeItem("techstore_role");
    localStorage.removeItem("techstore_user");
    window.location.href = "/";
}

function popRedirect() {
    const redirect = sessionStorage.getItem("techstore_redirect");
    if (redirect) {
        sessionStorage.removeItem("techstore_redirect");
        return redirect;
    }
    return "";
}

function parseApiError(payload, fallback) {
    if (payload && typeof payload === "object" && payload.message) {
        return payload.message;
    }
    return fallback;
}

function getVietnameseConstraintMessage(field) {
    const validity = field?.validity;
    if (!validity) {
        return "Thông tin không hợp lệ.";
    }

    if (validity.valueMissing) {
        if (field.type === "checkbox") {
            return "Vui lòng chọn mục này.";
        }
        if (field.tagName === "SELECT") {
            return "Vui lòng chọn một giá trị.";
        }
        return "Vui lòng điền vào trường này.";
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

function bindVietnameseConstraintValidation() {
    const fields = document.querySelectorAll("input, select, textarea");
    fields.forEach((field) => {
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

function getAddressElements() {
    return {
        province: document.getElementById("address-province"),
        district: document.getElementById("address-district"),
        ward: document.getElementById("address-ward"),
        detail: document.getElementById("address-detail"),
        hiddenAddress: document.getElementById("address"),
        helper: document.getElementById("address-helper")
    };
}

function setAddressHelperMessage(text, isError = false) {
    const { helper } = getAddressElements();
    if (!helper) {
        return;
    }
    const message = String(text || "").trim();
    const shouldShow = Boolean(isError && message);
    helper.textContent = shouldShow ? message : "";
    helper.classList.toggle("is-error", shouldShow);
    helper.style.display = shouldShow ? "block" : "none";
}

function resetAddressSelect(selectEl, placeholder, disabled = true) {
    if (!selectEl) {
        return;
    }
    selectEl.innerHTML = "";

    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    selectEl.appendChild(placeholderOption);
    selectEl.value = "";
    selectEl.disabled = disabled;
}

function fillAddressSelect(selectEl, items, placeholder) {
    if (!selectEl) {
        return;
    }
    resetAddressSelect(selectEl, placeholder, false);

    items.forEach((item) => {
        const option = document.createElement("option");
        option.value = String(item.code);
        option.textContent = item.name;
        option.dataset.name = item.name;
        selectEl.appendChild(option);
    });
}

async function fetchAddressJson(path) {
    const response = await fetch(`${VN_ADDRESS_API}${path}`);
    if (!response.ok) {
        throw new Error("Không tải được dữ liệu địa chỉ");
    }
    return response.json();
}

async function loadProvinces() {
    if (registerAddressCache.provinces) {
        return registerAddressCache.provinces;
    }

    try {
        const provinces = await fetchAddressJson("/p/");
        registerAddressCache.provinces = Array.isArray(provinces)
            ? provinces.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "vi"))
            : [];
    } catch (_) {
        registerAddressCache.provinces = [];
    }

    if (!registerAddressCache.provinces.length) {
        registerAddressCache.provinces = FALLBACK_PROVINCES.slice();
    }

    return registerAddressCache.provinces;
}

async function loadDistricts(provinceCode) {
    const cacheKey = String(provinceCode);
    if (registerAddressCache.districts.has(cacheKey)) {
        return registerAddressCache.districts.get(cacheKey);
    }

    if (!cacheKey || cacheKey.startsWith(FALLBACK_PROVINCE_CODE_PREFIX)) {
        const fallbackDistricts = [{
            code: `${cacheKey || "manual"}-district-fallback`,
            name: FALLBACK_DISTRICT_OPTION_NAME
        }];
        registerAddressCache.districts.set(cacheKey, fallbackDistricts);
        return fallbackDistricts;
    }

    let districts = [];
    try {
        const province = await fetchAddressJson(`/p/${cacheKey}?depth=2`);
        districts = Array.isArray(province?.districts) ? province.districts : [];
    } catch (_) {
        districts = [];
    }

    if (!districts.length) {
        districts = [{
            code: `${cacheKey}-district-fallback`,
            name: FALLBACK_DISTRICT_OPTION_NAME
        }];
    }

    registerAddressCache.districts.set(cacheKey, districts);
    return districts;
}

async function loadWards(districtCode) {
    const cacheKey = String(districtCode);
    if (registerAddressCache.wards.has(cacheKey)) {
        return registerAddressCache.wards.get(cacheKey);
    }

    if (!cacheKey) {
        const fallbackWards = [{
            code: "manual-ward-fallback",
            name: FALLBACK_WARD_OPTION_NAME
        }];
        registerAddressCache.wards.set(cacheKey, fallbackWards);
        return fallbackWards;
    }

    let wards = [];
    try {
        const district = await fetchAddressJson(`/d/${cacheKey}?depth=2`);
        wards = Array.isArray(district?.wards) ? district.wards : [];
    } catch (_) {
        wards = [];
    }

    if (!wards.length) {
        wards = [{
            code: `${cacheKey}-ward-fallback`,
            name: FALLBACK_WARD_OPTION_NAME
        }];
    }

    registerAddressCache.wards.set(cacheKey, wards);
    return wards;
}

function getSelectedAddressName(selectEl) {
    if (!selectEl || !selectEl.value || !selectEl.selectedOptions?.length) {
        return "";
    }
    if (isFallbackAddressCode(selectEl.value)) {
        return "";
    }
    const selectedName = selectEl.selectedOptions[0].dataset.name || selectEl.selectedOptions[0].textContent || "";
    return isFallbackAddressName(selectedName) ? "" : selectedName;
}

function buildRegisterAddressValue() {
    const {
        province,
        district,
        ward,
        detail,
        hiddenAddress
    } = getAddressElements();

    if (!detail || !hiddenAddress) {
        return { ok: true, value: hiddenAddress ? hiddenAddress.value.trim() : "" };
    }

    const detailValue = detail.value.trim();
    if (!detailValue) {
        return { ok: false, message: "Vui lòng nhập số nhà và tên đường." };
    }

    const pickerAvailable = province && district && ward;
    if (!pickerAvailable) {
        return { ok: true, value: detailValue };
    }

    const pickerRequired = province.required;
    if (pickerRequired) {
        if (!province.value) {
            return { ok: false, message: "Vui lòng chọn Tỉnh/Thành phố." };
        }
        if (district.required && !district.value) {
            return { ok: false, message: "Vui lòng chọn Quận/Huyện." };
        }
        if (ward.required && !ward.value) {
            return { ok: false, message: "Vui lòng chọn Phường/Xã." };
        }
    }

    const composedAddress = [
        detailValue,
        getSelectedAddressName(ward),
        getSelectedAddressName(district),
        getSelectedAddressName(province)
    ].filter(Boolean).join(", ");

    return { ok: true, value: composedAddress || detailValue };
}

function syncRegisterAddressValue() {
    const { hiddenAddress } = getAddressElements();
    if (!hiddenAddress) {
        return;
    }
    const result = buildRegisterAddressValue();
    hiddenAddress.value = result.ok ? result.value : "";
}

function resetRegisterAddressUi() {
    const {
        province,
        district,
        ward,
        detail
    } = getAddressElements();

    if (!province || !district || !ward) {
        return;
    }

    if (registerAddressCache.provinces?.length) {
        fillAddressSelect(province, registerAddressCache.provinces, "Chọn tỉnh/thành phố");
    } else {
        resetAddressSelect(province, "Chọn tỉnh/thành phố", false);
    }

    resetAddressSelect(district, "Chọn quận/huyện", true);
    resetAddressSelect(ward, "Chọn phường/xã", true);

    if (detail) {
        detail.value = "";
    }

    setAddressHelperMessage("Chọn khu vực và nhập địa chỉ chi tiết để hoàn tất đăng ký.");
    syncRegisterAddressValue();
}

async function initRegisterAddressPicker() {
    const {
        province,
        district,
        ward,
        detail
    } = getAddressElements();

    if (!province || !district || !ward || !detail) {
        return;
    }

    const onAnyAddressChange = () => {
        syncRegisterAddressValue();
        setAddressHelperMessage("Chọn khu vực và nhập địa chỉ chi tiết để hoàn tất đăng ký.");
    };

    detail.addEventListener("input", onAnyAddressChange);
    province.addEventListener("change", onAnyAddressChange);
    district.addEventListener("change", onAnyAddressChange);
    ward.addEventListener("change", onAnyAddressChange);

    try {
        const provinces = await loadProvinces();
        if (!provinces.length) {
            throw new Error("address-source-empty");
        }
        province.required = true;
        province.disabled = false;
        district.required = true;
        ward.required = true;
        fillAddressSelect(province, provinces, "Chọn tỉnh/thành phố");
        resetAddressSelect(district, "Chọn quận/huyện", true);
        resetAddressSelect(ward, "Chọn phường/xã", true);
        setAddressHelperMessage("Chọn khu vực và nhập địa chỉ chi tiết để hoàn tất đăng ký.");
    } catch (error) {
        [province, district, ward].forEach((selectEl) => {
            selectEl.required = false;
            selectEl.disabled = true;
        });
        detail.placeholder = "Nhập đầy đủ địa chỉ (số nhà, phường/xã, quận/huyện, tỉnh/thành phố)";
        setAddressHelperMessage("Không tải được danh mục địa chỉ. Hãy nhập đầy đủ địa chỉ ở bên dưới.", true);
    }

    province.addEventListener("change", async () => {
        const selectedProvinceCode = String(province.value || "").trim();
        registerAddressUiState.districtRequestId += 1;
        registerAddressUiState.wardRequestId += 1;
        const districtRequestId = registerAddressUiState.districtRequestId;
        syncRegisterAddressValue();
        resetAddressSelect(district, "Chọn quận/huyện", true);
        resetAddressSelect(ward, "Chọn phường/xã", true);

        if (!selectedProvinceCode) {
            return;
        }

        try {
            const districts = await loadDistricts(selectedProvinceCode);
            if (districtRequestId !== registerAddressUiState.districtRequestId
                    || String(province.value || "").trim() !== selectedProvinceCode) {
                return;
            }
            const hasOnlyFallbackDistrict = districts.length === 1 && isFallbackAddressName(districts[0]?.name);
            if (hasOnlyFallbackDistrict) {
                district.required = false;
                ward.required = false;
            } else {
                district.required = true;
                ward.required = true;
            }
            fillAddressSelect(district, districts, "Chọn quận/huyện");
            if (hasOnlyFallbackDistrict) {
                district.value = String(districts[0]?.code || "");
                district.dispatchEvent(new Event("change"));
            }
        } catch (error) {
            district.required = false;
            ward.required = false;
            setAddressHelperMessage("Không tải được quận/huyện. Vui lòng thử lại.", true);
        }
    });

    district.addEventListener("change", async () => {
        const selectedDistrictCode = String(district.value || "").trim();
        registerAddressUiState.wardRequestId += 1;
        const wardRequestId = registerAddressUiState.wardRequestId;
        syncRegisterAddressValue();
        resetAddressSelect(ward, "Chọn phường/xã", true);

        if (!selectedDistrictCode) {
            return;
        }

        try {
            const wards = await loadWards(selectedDistrictCode);
            if (wardRequestId !== registerAddressUiState.wardRequestId
                    || String(district.value || "").trim() !== selectedDistrictCode) {
                return;
            }
            const hasOnlyFallbackWard = wards.length === 1 && isFallbackAddressName(wards[0]?.name);
            ward.required = !hasOnlyFallbackWard;
            if (hasOnlyFallbackWard) {
                setTimeout(() => {
                    ward.value = String(wards[0]?.code || "");
                    syncRegisterAddressValue();
                }, 0);
            }
            fillAddressSelect(ward, wards, "Chọn phường/xã");
        } catch (error) {
            setAddressHelperMessage("Không tải được phường/xã. Vui lòng thử lại.", true);
        }
    });

    syncRegisterAddressValue();
}

function setBoxMessage(id, text, type) {
    const box = document.getElementById(id);
    if (!box) {
        return;
    }

    if (!text) {
        box.style.display = "none";
        box.className = "message";
        box.textContent = "";
        return;
    }

    box.style.display = "block";
    box.className = `message ${type === "error" ? "message-error" : "message-success"}`;
    box.textContent = text;
}

async function login(event) {
    event.preventDefault();

    const identifier = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const errorEl = document.getElementById("error");
    errorEl.textContent = "";

    try {
        // Login response sets HttpOnly cookie and also returns token for JS API calls.
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username: identifier, password })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(parseApiError(data, "Đăng nhập thất bại"));
        }

        const data = await response.json();
        saveSession(data);

        const redirect = popRedirect();
        if (redirect) {
            window.location.href = redirect;
            return;
        }

        if (data.role === "ADMIN" || data.role === "SUPER_ADMIN") {
            window.location.href = "/admin/dashboard";
            return;
        }

        window.location.href = "/";
    } catch (err) {
        errorEl.textContent = err.message;
    }
}

async function register(event) {
    event.preventDefault();

    const errorEl = document.getElementById("error");
    const successEl = document.getElementById("success");
    const password = document.getElementById("password")?.value || "";
    const confirmPassword = document.getElementById("confirmPassword")?.value || "";
    errorEl.textContent = "";
    successEl.textContent = "";

    if (password !== confirmPassword) {
        errorEl.textContent = "Xác nhận mật khẩu không khớp.";
        return;
    }

    const addressResult = buildRegisterAddressValue();
    if (!addressResult.ok) {
        errorEl.textContent = addressResult.message;
        setAddressHelperMessage(addressResult.message, true);
        return;
    }

    const payload = {
        username: document.getElementById("username").value.trim(),
        fullName: document.getElementById("fullName").value.trim(),
        email: document.getElementById("email").value.trim(),
        password,
        confirmPassword,
        phone: document.getElementById("phone").value.trim(),
        address: addressResult.value
    };

    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(parseApiError(data, "Đăng ký thất bại"));
        }

        successEl.textContent = "Đăng ký thành công. Bạn có thể đăng nhập ngay.";
        document.getElementById("register-form").reset();
        resetRegisterAddressUi();
    } catch (err) {
        errorEl.textContent = err.message;
    }
}

function togglePassword(id) {
    const input = document.getElementById(id);
    if (!input) {
        return;
    }
    input.type = input.type === "password" ? "text" : "password";
}

function openForgotPasswordModal() {
    const modal = document.getElementById("forgot-password-modal");
    if (!modal) {
        return;
    }

    // Reset UI state each time modal is opened.
    document.getElementById("forgot-password-form")?.reset();
    document.getElementById("reset-token-form")?.reset();
    document.getElementById("reset-password-form")?.reset();

    const resetSection = document.getElementById("reset-password-section");
    if (resetSection) {
        resetSection.hidden = true;
    }
    setResetPasswordStage("token");
    updateForgotResetSteps("request");
    setForgotIdentifierReadonly(false);
    clearForgotResetCooldown();
    clearVerifiedResetToken();
    renderPasswordRules("");

    const tokenHint = document.getElementById("reset-token-hint");
    if (tokenHint) {
        tokenHint.style.display = "none";
        tokenHint.textContent = "";
    }

    setBoxMessage("forgot-password-message", "", "");
    setBoxMessage("reset-token-message", "", "");
    setBoxMessage("reset-password-message", "", "");

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    document.getElementById("forgot-identifier")?.focus();
}

function closeForgotPasswordModal() {
    const modal = document.getElementById("forgot-password-modal");
    if (!modal) {
        return;
    }

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    setForgotIdentifierReadonly(false);
    clearForgotResetCooldown();
    clearVerifiedResetToken();
}

function backToForgotStep() {
    const resetSection = document.getElementById("reset-password-section");
    if (resetSection) {
        resetSection.hidden = true;
    }
    document.getElementById("reset-token-form")?.reset();
    document.getElementById("reset-password-form")?.reset();
    setResetPasswordStage("token");
    updateForgotResetSteps("request");
    setForgotIdentifierReadonly(false);
    clearVerifiedResetToken();
    setBoxMessage("reset-token-message", "", "");
    setBoxMessage("reset-password-message", "", "");
    renderPasswordRules("");
    document.getElementById("forgot-identifier")?.focus();
}

async function requestPasswordReset(event) {
    event.preventDefault();

    const identifier = (document.getElementById("forgot-identifier")?.value || "").trim();
    const submitBtn = document.getElementById("forgot-submit-btn");
    const resetSection = document.getElementById("reset-password-section");
    const tokenHint = document.getElementById("reset-token-hint");

    if (!identifier) {
        setBoxMessage("forgot-password-message", "Vui lòng nhập email hoặc tên đăng nhập.", "error");
        return;
    }

    if (forgotResetUiState.cooldownRemaining > 0) {
        setBoxMessage(
            "forgot-password-message",
            `Bạn đang thao tác quá nhanh. Vui lòng chờ ${forgotResetUiState.cooldownRemaining}s để gửi lại.`,
            "error"
        );
        return;
    }

    setBoxMessage("forgot-password-message", "", "");
    setBoxMessage("reset-token-message", "", "");
    setBoxMessage("reset-password-message", "", "");
    setButtonLoading(submitBtn, true, "Đang tạo mã...");

    try {
        const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ identifier })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(parseApiError(data, "Không thể tạo mã đặt lại mật khẩu."));
        }

        const expiresInMinutes = Number(data.expiresInMinutes);
        const hasExpiry = Number.isFinite(expiresInMinutes) && expiresInMinutes > 0;

        const requestDoneMessage = data.resetToken
            ? (data.message || "Mã reset đã được tạo.")
            : "Nếu tài khoản tồn tại, mã đã được gửi về email.";
        setBoxMessage("forgot-password-message", requestDoneMessage, "success");

        if (resetSection) {
            resetSection.hidden = false;
        }
        setResetPasswordStage("token");
        updateForgotResetSteps("reset");
        setForgotIdentifierReadonly(true);
        startForgotResetCooldown();
        clearVerifiedResetToken();

        const tokenInput = document.getElementById("reset-token");
        if (data.resetToken && tokenInput) {
            tokenInput.value = data.resetToken;
            if (tokenHint) {
                tokenHint.style.display = "block";
                tokenHint.textContent = hasExpiry
                    ? `Dev mode: mã reset đã điền sẵn (${expiresInMinutes} phút).`
                    : "Dev mode: mã reset đã được điền sẵn.";
            }
        } else if (tokenHint) {
            if (tokenInput) {
                tokenInput.value = "";
            }
            tokenHint.style.display = "block";
            tokenHint.textContent = hasExpiry
                ? `Mã reset có hiệu lực ${expiresInMinutes} phút.`
                : "Nhập mã nhận từ email để xác thực.";
        }

        document.getElementById("reset-token")?.focus();
        renderPasswordRules("");
    } catch (err) {
        setBoxMessage("forgot-password-message", err.message, "error");
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

async function verifyResetToken(event) {
    event.preventDefault();

    const token = (document.getElementById("reset-token")?.value || "").trim();
    const submitBtn = document.getElementById("reset-verify-btn");

    if (!token) {
        setBoxMessage("reset-token-message", "Vui lòng nhập mã reset.", "error");
        return;
    }

    setBoxMessage("reset-token-message", "", "");
    setBoxMessage("reset-password-message", "", "");
    setButtonLoading(submitBtn, true, "Đang xác thực...");

    try {
        const response = await fetch(`${API_BASE}/api/auth/verify-reset-token`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ token })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(parseApiError(data, "Mã reset không hợp lệ hoặc đã hết hạn."));
        }

        markVerifiedResetToken(token);
        setResetPasswordStage("password");
        renderPasswordRules(document.getElementById("reset-password-new")?.value || "");
        setBoxMessage(
            "reset-password-message",
            data.message || "Mã reset hợp lệ. Hãy đặt mật khẩu mới.",
            "success"
        );
        document.getElementById("reset-password-new")?.focus();
    } catch (err) {
        clearVerifiedResetToken();
        setResetPasswordStage("token");
        setBoxMessage("reset-token-message", err.message, "error");
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

async function submitResetPassword(event) {
    event.preventDefault();

    const token = (document.getElementById("reset-token-confirmed")?.value || "").trim();
    const newPassword = document.getElementById("reset-password-new")?.value || "";
    const confirmPassword = document.getElementById("reset-password-confirm")?.value || "";
    const submitBtn = document.getElementById("reset-submit-btn");

    renderPasswordRules(newPassword);

    if (!token || !forgotResetUiState.tokenVerified) {
        setBoxMessage("reset-password-message", "Vui lòng xác thực mã reset trước khi đổi mật khẩu.", "error");
        setResetPasswordStage("token");
        document.getElementById("reset-token")?.focus();
        return;
    }

    if (newPassword.length < 7) {
        setBoxMessage("reset-password-message", "Mật khẩu mới phải có tối thiểu 7 ký tự.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        setBoxMessage("reset-password-message", "Xác nhận mật khẩu chưa khớp.", "error");
        return;
    }

    setBoxMessage("reset-password-message", "", "");
    setButtonLoading(submitBtn, true, "Đang đặt lại...");

    try {
        const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ token, newPassword })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(parseApiError(data, "Không thể đặt lại mật khẩu."));
        }

        setBoxMessage(
            "reset-password-message",
            data.message || "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại.",
            "success"
        );

        // Close modal shortly after successful reset for smoother UX.
        setTimeout(() => {
            closeForgotPasswordModal();
        }, 1000);
    } catch (err) {
        const errorMessage = String(err?.message || "Không thể đặt lại mật khẩu.");
        if (/mã reset|mã đặt lại mật khẩu/i.test(errorMessage)) {
            clearVerifiedResetToken();
            setResetPasswordStage("token");
            setBoxMessage("reset-token-message", errorMessage, "error");
            setBoxMessage("reset-password-message", "", "");
            document.getElementById("reset-token")?.focus();
        } else {
            setBoxMessage("reset-password-message", errorMessage, "error");
        }
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

function bindForgotPasswordModal() {
    const modal = document.getElementById("forgot-password-modal");
    if (!modal) {
        return;
    }

    // Close on overlay click or explicit close button.
    modal.addEventListener("click", (event) => {
        const target = event.target;
        if (target && target.getAttribute("data-close") === "1") {
            closeForgotPasswordModal();
        }
    });

    // Close modal with Escape key.
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.classList.contains("show")) {
            closeForgotPasswordModal();
        }
    });

    const resetPasswordInput = document.getElementById("reset-password-new");
    if (resetPasswordInput) {
        resetPasswordInput.addEventListener("input", (event) => {
            renderPasswordRules(event.target?.value || "");
        });
    }

    const resetTokenInput = document.getElementById("reset-token");
    if (resetTokenInput) {
        resetTokenInput.addEventListener("input", () => {
            setBoxMessage("reset-token-message", "", "");
        });
    }
}

window.addEventListener("DOMContentLoaded", () => {
    bindVietnameseConstraintValidation();
    bindForgotPasswordModal();
    initRegisterAddressPicker();
});

window.techstoreAuth = {
    login,
    register,
    togglePassword,
    openForgotPasswordModal,
    closeForgotPasswordModal,
    backToForgotStep,
    requestPasswordReset,
    verifyResetToken,
    submitResetPassword,
    // Keep old name for backward compatibility with existing onclick in templates.
    fakeForgotPassword: openForgotPasswordModal,
    logout
};

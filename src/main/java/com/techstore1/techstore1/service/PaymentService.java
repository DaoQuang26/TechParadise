package com.techstore1.techstore1.service;

import com.techstore1.techstore1.dto.CreatePaymentSessionResponse;
import com.techstore1.techstore1.dto.MockPaymentSessionResponse;
import com.techstore1.techstore1.dto.MockPaymentWebhookRequest;
import com.techstore1.techstore1.dto.MockPaymentWebhookResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techstore1.techstore1.entity.Order;
import com.techstore1.techstore1.enums.OnlinePaymentStatus;
import com.techstore1.techstore1.enums.OrderStatus;
import com.techstore1.techstore1.enums.PaymentGatewayProvider;
import com.techstore1.techstore1.enums.PaymentMethod;
import com.techstore1.techstore1.repository.OrderRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
// tac dung code: xu ly tao session thanh toan theo provider (MOCK/VNPAY/MOMO) + cap nhat trang thai don sau callback.
public class PaymentService {

    private static final DateTimeFormatter VNPAY_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final ZoneId VNPAY_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    private final OrderRepository orderRepository;
    private final OrderService orderService;
    private final OrderStatusHistoryService orderStatusHistoryService;
    private final EmailNotificationService emailNotificationService;

    private final String mockProviderName;
    private final String mockWebhookSecret;

    private final String vnpayTmnCode;
    private final String vnpayHashSecret;
    private final String vnpayPayUrl;
    private final String vnpayReturnUrl;
    private final String vnpayIpnUrl;
    private final String vnpayVersion;
    private final String vnpayCommand;
    private final String vnpayOrderType;
    private final String vnpayLocale;
    private final int vnpayExpireMinutes;

    private final String momoPartnerCode;
    private final String momoAccessKey;
    private final String momoSecretKey;
    private final String momoEndpoint;
    private final String momoReturnUrl;
    private final String momoIpnUrl;
    private final String momoRequestType;
    private final String momoLang;
    private final String momoPartnerName;
    private final String momoStoreId;
    private final boolean paymentAllowReturnConfirmation;

    public PaymentService(
            ObjectMapper objectMapper,
            OrderRepository orderRepository,
            OrderService orderService,
            OrderStatusHistoryService orderStatusHistoryService,
            EmailNotificationService emailNotificationService,
            @Value("${app.payment.mock.provider-name:MOCK_GATEWAY}") String mockProviderName,
            @Value("${app.payment.mock.webhook-secret:change-me-mock-webhook-secret}") String mockWebhookSecret,
            @Value("${app.payment.vnpay.tmn-code:}") String vnpayTmnCode,
            @Value("${app.payment.vnpay.hash-secret:}") String vnpayHashSecret,
            @Value("${app.payment.vnpay.pay-url:https://sandbox.vnpayment.vn/paymentv2/vpcpay.html}") String vnpayPayUrl,
            @Value("${app.payment.vnpay.return-url:http://localhost:8080/payments/vnpay/return}") String vnpayReturnUrl,
            @Value("${app.payment.vnpay.ipn-url:http://localhost:8080/payments/vnpay/ipn}") String vnpayIpnUrl,
            @Value("${app.payment.vnpay.version:2.1.0}") String vnpayVersion,
            @Value("${app.payment.vnpay.command:pay}") String vnpayCommand,
            @Value("${app.payment.vnpay.order-type:other}") String vnpayOrderType,
            @Value("${app.payment.vnpay.locale:vn}") String vnpayLocale,
            @Value("${app.payment.vnpay.expire-minutes:15}") int vnpayExpireMinutes,
            @Value("${app.payment.momo.partner-code:}") String momoPartnerCode,
            @Value("${app.payment.momo.access-key:}") String momoAccessKey,
            @Value("${app.payment.momo.secret-key:}") String momoSecretKey,
            @Value("${app.payment.momo.endpoint:https://test-payment.momo.vn/v2/gateway/api/create}") String momoEndpoint,
            @Value("${app.payment.momo.return-url:http://localhost:8080/payments/momo/return}") String momoReturnUrl,
            @Value("${app.payment.momo.ipn-url:http://localhost:8080/payments/momo/ipn}") String momoIpnUrl,
            @Value("${app.payment.momo.request-type:payWithMethod}") String momoRequestType,
            @Value("${app.payment.momo.lang:vi}") String momoLang,
            @Value("${app.payment.momo.partner-name:TechStore Test}") String momoPartnerName,
            @Value("${app.payment.momo.store-id:TechStoreTestStore}") String momoStoreId,
            @Value("${app.payment.allow-return-confirmation:false}") boolean paymentAllowReturnConfirmation
    ) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
        this.orderRepository = orderRepository;
        this.orderService = orderService;
        this.orderStatusHistoryService = orderStatusHistoryService;
        this.emailNotificationService = emailNotificationService;
        this.mockProviderName = mockProviderName;
        this.mockWebhookSecret = mockWebhookSecret;
        this.vnpayTmnCode = vnpayTmnCode;
        this.vnpayHashSecret = vnpayHashSecret;
        this.vnpayPayUrl = vnpayPayUrl;
        this.vnpayReturnUrl = vnpayReturnUrl;
        this.vnpayIpnUrl = vnpayIpnUrl;
        this.vnpayVersion = vnpayVersion;
        this.vnpayCommand = vnpayCommand;
        this.vnpayOrderType = vnpayOrderType;
        this.vnpayLocale = vnpayLocale;
        this.vnpayExpireMinutes = vnpayExpireMinutes;
        this.momoPartnerCode = momoPartnerCode;
        this.momoAccessKey = momoAccessKey;
        this.momoSecretKey = momoSecretKey;
        this.momoEndpoint = momoEndpoint;
        this.momoReturnUrl = momoReturnUrl;
        this.momoIpnUrl = momoIpnUrl;
        this.momoRequestType = momoRequestType;
        this.momoLang = momoLang;
        this.momoPartnerName = momoPartnerName;
        this.momoStoreId = momoStoreId;
        this.paymentAllowReturnConfirmation = paymentAllowReturnConfirmation;
    }

    @Transactional
    public CreatePaymentSessionResponse createSession(
            String username,
            Long orderId,
            String provider,
            String clientIp
    ) {
        PaymentGatewayProvider targetProvider = parseProvider(provider);
        // tac dung code: switch provider de dung chung 1 endpoint tao payment session.
        return switch (targetProvider) {
            case VNPAY -> createVnpaySession(username, orderId, clientIp);
            case MOMO -> createMomoSession(username, orderId, clientIp);
            case MOCK -> createMockSession(username, orderId);
        };
    }

    @Transactional
    public CreatePaymentSessionResponse createMockSession(String username, Long orderId) {
        Order order = loadOnlineOrderForSession(username, orderId);

        ensurePaymentReference(order, "MOCKPAY");
        order.setPaymentProvider(mockProviderName);
        order.setOnlinePaymentStatus(OnlinePaymentStatus.PENDING);
        orderRepository.save(order);

        String encodedReference = urlEncode(order.getPaymentReference());
        String checkoutUrl = "/payments/mock/checkout?reference=" + encodedReference;

        return new CreatePaymentSessionResponse(
                order.getId(),
                order.getPaymentReference(),
                PaymentGatewayProvider.MOCK.name(),
                checkoutUrl
        );
    }

    @Transactional
    public CreatePaymentSessionResponse createVnpaySession(String username, Long orderId, String clientIp) {
        validateVnpayConfig();
        Order order = loadOnlineOrderForSession(username, orderId);

        ensurePaymentReference(order, "VNPAY");
        order.setPaymentProvider(PaymentGatewayProvider.VNPAY.name());
        order.setOnlinePaymentStatus(OnlinePaymentStatus.PENDING);
        orderRepository.save(order);

        String checkoutUrl = buildVnpayCheckoutUrl(order, clientIp);
        return new CreatePaymentSessionResponse(
                order.getId(),
                order.getPaymentReference(),
                PaymentGatewayProvider.VNPAY.name(),
                checkoutUrl
        );
    }

    @Transactional
    public CreatePaymentSessionResponse createMomoSession(String username, Long orderId, String clientIp) {
        validateMomoConfig();
        Order order = loadOnlineOrderForSession(username, orderId);

        ensurePaymentReference(order, "MOMO");
        order.setPaymentProvider(PaymentGatewayProvider.MOMO.name());
        order.setOnlinePaymentStatus(OnlinePaymentStatus.PENDING);
        orderRepository.save(order);

        String checkoutUrl = buildMomoCheckoutUrl(order, clientIp);
        return new CreatePaymentSessionResponse(
                order.getId(),
                order.getPaymentReference(),
                PaymentGatewayProvider.MOMO.name(),
                checkoutUrl
        );
    }

    public MockPaymentSessionResponse getPublicMockSession(String paymentReference) {
        String reference = normalizeReference(paymentReference);
        Order order = orderRepository.findByPaymentReference(reference)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phiên thanh toán"));
        // tac dung code: vao trang mock checkout se cap nhat ngay neu don da qua han giu hang.
        orderService.expireReservationIfNeeded(order.getId(), "mock-session-view");
        order = orderRepository.findById(order.getId()).orElse(order);

        if (!isOnlinePaymentMethod(order.getPaymentMethod())) {
            throw new IllegalArgumentException("Phiên này không thuộc thanh toán online");
        }

        // tac dung code: ky san cho 2 ket qua PAID/FAILED de frontend mock goi webhook hop le.
        String paidSignature = signMockWebhook(reference, "PAID");
        String failedSignature = signMockWebhook(reference, "FAILED");

        return new MockPaymentSessionResponse(
                order.getId(),
                reference,
                order.getTotalPrice(),
                order.getUser() != null ? order.getUser().getUsername() : null,
                order.getOnlinePaymentStatus() == null ? OnlinePaymentStatus.PENDING : order.getOnlinePaymentStatus(),
                paidSignature,
                failedSignature
        );
    }

    @Transactional
    public MockPaymentWebhookResponse handleMockWebhook(MockPaymentWebhookRequest request) {
        String reference = normalizeReference(request.getPaymentReference());
        String status = normalizeMockWebhookStatus(request.getStatus());
        String signature = request.getSignature() == null ? "" : request.getSignature().trim();

        String expectedSignature = signMockWebhook(reference, status);
        if (!MessageDigest.isEqual(
                signature.getBytes(StandardCharsets.UTF_8),
                expectedSignature.getBytes(StandardCharsets.UTF_8)
        )) {
            throw new IllegalArgumentException("Chữ ký webhook không hợp lệ");
        }

        Order order = orderRepository.findByPaymentReference(reference)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng theo payment reference"));

        if (!isOnlinePaymentMethod(order.getPaymentMethod())) {
            throw new IllegalArgumentException("Đơn hàng này không thuộc thanh toán online");
        }
        if (orderService.expireReservationIfNeeded(order.getId(), "mock-webhook-expire-check")) {
            return new MockPaymentWebhookResponse(
                    "Đơn hàng đã hết hạn thanh toán online",
                    buildOrderRedirect(order.getId(), "expired", "mock", null)
            );
        }
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new IllegalArgumentException("Đơn hàng đã hủy, bỏ qua webhook thanh toán");
        }

        if ("PAID".equals(status)) {
            if (order.getOnlinePaymentStatus() == OnlinePaymentStatus.PAID) {
                return new MockPaymentWebhookResponse(
                        "Webhook đã được xử lý trước đó",
                        buildOrderRedirect(order.getId(), "success", "mock", null)
                );
            }

            markOrderPaid(order, mockProviderName, "Mock gateway báo đã thanh toán", "payment-webhook");
            return new MockPaymentWebhookResponse(
                    "Thanh toán thành công",
                    buildOrderRedirect(order.getId(), "success", "mock", null)
            );
        }

        markOrderFailed(order, mockProviderName, "Mock gateway báo thanh toán thất bại", "payment-webhook");
        return new MockPaymentWebhookResponse(
                "Thanh toán thất bại",
                buildOrderRedirect(order.getId(), "failed", "mock", null)
        );
    }

    @Transactional
    public String handleVnpayReturnAndBuildRedirect(Map<String, String> rawParams) {
        Map<String, String> params = normalizeVnpayParams(rawParams);
        String paymentReference = normalizeReference(params.get("vnp_TxnRef"));
        Order order = orderRepository.findByPaymentReference(paymentReference)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng theo payment reference"));

        if (orderService.expireReservationIfNeeded(order.getId(), "vnpay-return-expire-check")) {
            return buildOrderRedirect(order.getId(), "expired", "vnpay", params.get("vnp_ResponseCode"));
        }

        boolean gatewaySuccess = isVnpaySuccess(params);
        boolean signatureValid = verifyVnpaySignature(params);
        if (!signatureValid && !allowInsecureReturnConfirmation(gatewaySuccess)) {
            return buildOrderRedirect(order.getId(), "invalid-signature", "vnpay", params.get("vnp_ResponseCode"));
        }

        long gatewayAmount = parseLongSafely(params.get("vnp_Amount"));
        long expectedAmount = toVnpayAmount(order.getTotalPrice());
        if (gatewayAmount > 0 && gatewayAmount != expectedAmount) {
            return buildOrderRedirect(order.getId(), "amount-mismatch", "vnpay", params.get("vnp_ResponseCode"));
        }

        applyReturnSuccessFallback(
                order,
                gatewaySuccess,
                PaymentGatewayProvider.VNPAY.name(),
                "VNPay trả về thành công.",
                "vnpay-return"
        );
        String paymentResult = resolveReturnPaymentResult(order, gatewaySuccess);
        return buildOrderRedirect(order.getId(), paymentResult, "vnpay", params.get("vnp_ResponseCode"));
    }

    @Transactional
    public Map<String, String> handleVnpayIpn(Map<String, String> rawParams) {
        Map<String, String> params = normalizeVnpayParams(rawParams);

        if (!verifyVnpaySignature(params)) {
            return vnpayAck("97", "Invalid checksum");
        }

        String paymentReference = params.get("vnp_TxnRef");
        if (paymentReference == null || paymentReference.isBlank()) {
            return vnpayAck("01", "Order not found");
        }

        Order order = orderRepository.findByPaymentReference(paymentReference.trim()).orElse(null);
        if (order == null) {
            return vnpayAck("01", "Order not found");
        }
        if (orderService.expireReservationIfNeeded(order.getId(), "vnpay-ipn-expire-check")) {
            return vnpayAck("02", "Order expired");
        }

        if (!isOnlinePaymentMethod(order.getPaymentMethod())) {
            return vnpayAck("02", "Order already confirmed");
        }

        long gatewayAmount = parseLongSafely(params.get("vnp_Amount"));
        long expectedAmount = toVnpayAmount(order.getTotalPrice());
        if (gatewayAmount <= 0 || gatewayAmount != expectedAmount) {
            return vnpayAck("04", "Invalid amount");
        }

        boolean success = isVnpaySuccess(params);
        if (success) {
            if (order.getOnlinePaymentStatus() == OnlinePaymentStatus.PAID) {
                return vnpayAck("02", "Order already confirmed");
            }
            markOrderPaid(order, PaymentGatewayProvider.VNPAY.name(), "VNPay IPN xác nhận thành công.", "vnpay-ipn");
            return vnpayAck("00", "Confirm Success");
        }

        markOrderFailed(order, PaymentGatewayProvider.VNPAY.name(), "VNPay IPN xác nhận thất bại.", "vnpay-ipn");
        return vnpayAck("00", "Confirm Success");
    }

    @Transactional
    public String handleMomoReturnAndBuildRedirect(Map<String, String> rawParams) {
        Map<String, String> params = normalizeMomoParams(rawParams);
        String paymentReference = normalizeReference(params.get("orderId"));
        Order order = orderRepository.findByPaymentReference(paymentReference)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng theo payment reference"));

        if (orderService.expireReservationIfNeeded(order.getId(), "momo-return-expire-check")) {
            return buildOrderRedirect(order.getId(), "expired", "momo", params.get("resultCode"));
        }

        int resultCode = parseIntSafely(params.get("resultCode"), -1);
        boolean gatewaySuccess = resultCode == 0;
        boolean signatureValid = verifyMomoResultSignature(params);
        if (!signatureValid && !allowInsecureReturnConfirmation(gatewaySuccess)) {
            return buildOrderRedirect(order.getId(), "invalid-signature", "momo", params.get("resultCode"));
        }
        if (!momoPartnerCode.trim().equalsIgnoreCase(params.getOrDefault("partnerCode", ""))
                && !allowInsecureReturnConfirmation(gatewaySuccess)) {
            return buildOrderRedirect(order.getId(), "invalid-signature", "momo", params.get("resultCode"));
        }

        long gatewayAmount = parseLongSafely(params.get("amount"));
        long expectedAmount = toMomoAmount(order.getTotalPrice());
        if (gatewayAmount > 0 && gatewayAmount != expectedAmount) {
            return buildOrderRedirect(order.getId(), "amount-mismatch", "momo", params.get("resultCode"));
        }

        applyReturnSuccessFallback(
                order,
                gatewaySuccess,
                PaymentGatewayProvider.MOMO.name(),
                "MoMo trả về thành công",
                "momo-return"
        );
        String paymentResult = resolveReturnPaymentResult(order, gatewaySuccess);
        return buildOrderRedirect(order.getId(), paymentResult, "momo", params.get("resultCode"));
    }

    @Transactional
    public void handleMomoIpn(Map<String, Object> rawParams) {
        Map<String, String> params = normalizeMomoParams(rawParams);
        if (!verifyMomoResultSignature(params)) {
            throw new IllegalArgumentException("Chữ ký callback MoMo không hợp lệ");
        }
        if (!momoPartnerCode.trim().equalsIgnoreCase(params.getOrDefault("partnerCode", ""))) {
            throw new IllegalArgumentException("PartnerCode callback MoMo không hợp lệ");
        }

        String paymentReference = params.get("orderId");
        if (paymentReference == null || paymentReference.isBlank()) {
            throw new IllegalArgumentException("MoMo callback thieu orderId");
        }

        Order order = orderRepository.findByPaymentReference(paymentReference.trim())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng theo payment reference"));

        if (orderService.expireReservationIfNeeded(order.getId(), "momo-ipn-expire-check")) {
            return;
        }

        if (!isOnlinePaymentMethod(order.getPaymentMethod())) {
            return;
        }

        long gatewayAmount = parseLongSafely(params.get("amount"));
        long expectedAmount = toMomoAmount(order.getTotalPrice());
        if (gatewayAmount <= 0 || gatewayAmount != expectedAmount) {
            throw new IllegalArgumentException("MoMo callback sai số tiền giao dịch");
        }

        int resultCode = parseIntSafely(params.get("resultCode"), -1);
        if (resultCode == 0) {
            if (order.getOnlinePaymentStatus() != OnlinePaymentStatus.PAID) {
                markOrderPaid(order, PaymentGatewayProvider.MOMO.name(), "MoMo IPN xác nhận thành công", "momo-ipn");
            }
            return;
        }

        markOrderFailed(order, PaymentGatewayProvider.MOMO.name(), "MoMo IPN xác nhận thất bại", "momo-ipn");
    }

    private Order loadOnlineOrderForSession(String username, Long orderId) {
        Order order = orderRepository.findByIdWithItemsForUser(orderId, username)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng"));

        if (!isOnlinePaymentMethod(order.getPaymentMethod())) {
            throw new IllegalArgumentException("Đơn hàng này không sử dụng thanh toán online");
        }
        if (order.getStatus() == OrderStatus.CANCEL_REQUESTED) {
            throw new IllegalArgumentException("Đơn hàng đang chờ duyệt hủy, không thể tạo phiên thanh toán");
        }
        if (orderService.expireReservationIfNeeded(order.getId(), "create-payment-session")) {
            throw new IllegalArgumentException("Đơn hàng đã hết hạn giữ hàng, vui lòng đặt đơn mới");
        }
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new IllegalArgumentException("Đơn hàng đã bị hủy, không thể thanh toán");
        }
        if (order.getOnlinePaymentStatus() == OnlinePaymentStatus.PAID) {
            throw new IllegalArgumentException("Đơn hàng đã được thanh toán online trước đó");
        }
        return order;
    }

    private void markOrderPaid(
            Order order,
            String provider,
            String note,
            String changedBy
    ) {
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new IllegalArgumentException("Đơn hàng đã hủy, bỏ qua webhook thanh toán");
        }
        if (order.getOnlinePaymentStatus() == OnlinePaymentStatus.PAID) {
            return;
        }

        OrderStatus currentStatus = order.getStatus();
        order.setOnlinePaymentStatus(OnlinePaymentStatus.PAID);
        order.setPaymentProvider(provider);
        // tac dung code: don da thanh toan thi bo moc giu hang vi ton kho da thanh giao dich that.
        order.setReservationExpiresAt(null);
        if (order.getPaidAt() == null) {
            order.setPaidAt(LocalDateTime.now());
        }

        if (currentStatus == OrderStatus.PENDING) {
            // tac dung code: don online dang pending se tu auto-confirm ngay sau khi cong thanh toan bao thanh cong.
            order.setStatus(OrderStatus.CONFIRMED);
            orderRepository.save(order);
            appendStatusHistory(
                    order,
                    currentStatus,
                    OrderStatus.CONFIRMED,
                    note,
                    changedBy
            );
            emailNotificationService.sendOrderPaymentResult(order, OnlinePaymentStatus.PAID, provider);
            return;
        }

        orderRepository.save(order);
        appendStatusHistory(
                order,
                currentStatus,
                currentStatus,
                note,
                changedBy
        );
        emailNotificationService.sendOrderPaymentResult(order, OnlinePaymentStatus.PAID, provider);
    }

    private void markOrderFailed(
            Order order,
            String provider,
            String note,
            String changedBy
    ) {
        if (order.getStatus() == OrderStatus.CANCELLED) {
            return;
        }
        if (order.getOnlinePaymentStatus() == OnlinePaymentStatus.PAID) {
            return;
        }
        if (order.getOnlinePaymentStatus() == OnlinePaymentStatus.FAILED) {
            return;
        }

        OrderStatus currentStatus = order.getStatus();
        order.setOnlinePaymentStatus(OnlinePaymentStatus.FAILED);
        order.setPaymentProvider(provider);
        // tac dung code: don online pending bi fail se huy ngay va tra ton kho de khong treo "Cho xu ly".
        if (currentStatus == OrderStatus.PENDING || currentStatus == OrderStatus.CANCEL_REQUESTED) {
            order.setStatus(OrderStatus.CANCELLED);
            order.setReservationExpiresAt(null);
            restoreStock(order);
            orderRepository.save(order);
            appendStatusHistory(
                    order,
                    currentStatus,
                    OrderStatus.CANCELLED,
                    note + " - he thong huy don va tra ton kho",
                    changedBy
            );
            emailNotificationService.sendOrderStatusChanged(order, currentStatus, OrderStatus.CANCELLED, note);
            emailNotificationService.sendOrderPaymentResult(order, OnlinePaymentStatus.FAILED, provider);
            return;
        }

        orderRepository.save(order);
        appendStatusHistory(order, currentStatus, currentStatus, note, changedBy);
        emailNotificationService.sendOrderPaymentResult(order, OnlinePaymentStatus.FAILED, provider);
    }

    private void validateVnpayConfig() {
        // tac dung code: chan som neu chua khai bao thong so bat buoc cua VNPay.
        if (isBlank(vnpayTmnCode) || isBlank(vnpayHashSecret) || isBlank(vnpayPayUrl) || isBlank(vnpayReturnUrl)) {
            throw new IllegalArgumentException(
                    "VNPay chua duoc cau hinh day du (tmn-code/hash-secret/pay-url/return-url)."
            );
        }
    }

    private void validateMomoConfig() {
        // tac dung code: chan som neu chua khai bao thong so bat buoc cua MoMo.
        if (isBlank(momoPartnerCode)
                || isBlank(momoAccessKey)
                || isBlank(momoSecretKey)
                || isBlank(momoEndpoint)
                || isBlank(momoReturnUrl)
                || isBlank(momoIpnUrl)) {
            throw new IllegalArgumentException(
                    "MoMo chua duoc cau hinh day du (partner-code/access-key/secret-key/endpoint/return-url/ipn-url)"
            );
        }
    }

    private String buildVnpayCheckoutUrl(Order order, String rawClientIp) {
        long amount = toVnpayAmount(order.getTotalPrice());
        if (amount <= 0) {
            throw new IllegalArgumentException("Số tiền thanh toán không hợp lệ.");
        }

        LocalDateTime now = LocalDateTime.now(VNPAY_ZONE);
        LocalDateTime expiredAt = now.plusMinutes(Math.max(1, vnpayExpireMinutes));

        Map<String, String> params = new TreeMap<>();
        params.put("vnp_Version", vnpayVersion);
        params.put("vnp_Command", vnpayCommand);
        params.put("vnp_TmnCode", vnpayTmnCode.trim());
        params.put("vnp_Amount", String.valueOf(amount));
        params.put("vnp_CurrCode", "VND");
        params.put("vnp_TxnRef", order.getPaymentReference());
        params.put("vnp_OrderInfo", "Thanh toan don hang #" + order.getId());
        params.put("vnp_OrderType", vnpayOrderType);
        params.put("vnp_Locale", vnpayLocale);
        params.put("vnp_ReturnUrl", vnpayReturnUrl);
        params.put("vnp_IpAddr", normalizeClientIp(rawClientIp));
        params.put("vnp_CreateDate", now.format(VNPAY_TIME_FORMAT));
        params.put("vnp_ExpireDate", expiredAt.format(VNPAY_TIME_FORMAT));

        String hashData = buildVnpayHashData(params);
        String secureHash = signVnpay(hashData);
        String query = buildVnpayQuery(params);

        return vnpayPayUrl
                + "?" + query
                + "&vnp_SecureHashType=HmacSHA512"
                + "&vnp_SecureHash=" + secureHash;
    }

    private String buildMomoCheckoutUrl(Order order, String rawClientIp) {
        long amount = toMomoAmount(order.getTotalPrice());
        if (amount <= 0) {
            throw new IllegalArgumentException("Số tiền thanh toán không hợp lệ.");
        }

        String requestId = "MOMO-REQ-" + System.currentTimeMillis() + "-" + ThreadLocalRandom.current().nextInt(1000, 9999);
        String orderId = order.getPaymentReference();
        String orderInfo = "Thanh toan don hang #" + order.getId();
        String extraData = "";
        String requestType = normalizeMomoRequestType(momoRequestType);
        String lang = isBlank(momoLang) ? "vi" : momoLang.trim();

        String rawSignature = "accessKey=" + momoAccessKey.trim()
                + "&amount=" + amount
                + "&extraData=" + extraData
                + "&ipnUrl=" + momoIpnUrl.trim()
                + "&orderId=" + orderId
                + "&orderInfo=" + orderInfo
                + "&partnerCode=" + momoPartnerCode.trim()
                + "&redirectUrl=" + momoReturnUrl.trim()
                + "&requestId=" + requestId
                + "&requestType=" + requestType;
        String signature = signMomo(rawSignature);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("partnerCode", momoPartnerCode.trim());
        if (!isBlank(momoPartnerName)) {
            payload.put("partnerName", momoPartnerName.trim());
        }
        if (!isBlank(momoStoreId)) {
            payload.put("storeId", momoStoreId.trim());
        }
        payload.put("accessKey", momoAccessKey.trim());
        payload.put("requestId", requestId);
        payload.put("amount", String.valueOf(amount));
        payload.put("orderId", orderId);
        payload.put("orderInfo", orderInfo);
        payload.put("redirectUrl", momoReturnUrl.trim());
        payload.put("ipnUrl", momoIpnUrl.trim());
        payload.put("requestType", requestType);
        payload.put("extraData", extraData);
        payload.put("lang", lang);
        payload.put("signature", signature);

        if (!isBlank(rawClientIp)) {
            payload.put("userIp", normalizeClientIp(rawClientIp));
        }

        Map<String, Object> response = requestMomoCreatePayment(payload);
        int resultCode = parseIntSafely(readMapString(response, "resultCode"), -1);
        String payUrl = readMapString(response, "payUrl");
        String message = readMapString(response, "message");

        if (!verifyMomoCreateResponseSignature(response)) {
            throw new IllegalArgumentException("Chữ ký response MoMo không hợp lệ");
        }

        if (resultCode != 0 || isBlank(payUrl)) {
            String safeMessage = isBlank(message) ? "MoMo trả về kết quả không hợp lệ" : message.trim();
            throw new IllegalArgumentException("Không tạo được phiên thanh toán MoMo: " + safeMessage + " (" + resultCode + ")");
        }

        return payUrl;
    }

    private String normalizeMomoRequestType(String rawRequestType) {
        String normalized = rawRequestType == null ? "" : rawRequestType.trim();
        if (normalized.isBlank()) {
            return "payWithMethod";
        }

        if ("captureWallet".equalsIgnoreCase(normalized)) {
            return "captureWallet";
        }
        if ("payWithMethod".equalsIgnoreCase(normalized)) {
            return "payWithMethod";
        }
        return normalized;
    }

    private Map<String, Object> requestMomoCreatePayment(Map<String, Object> payload) {
        try {
            String jsonBody = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(momoEndpoint.trim()))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalArgumentException("MoMo API loi HTTP " + response.statusCode());
            }

            return objectMapper.readValue(response.body(), new TypeReference<>() {
            });
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("Không thể gọi API MoMo. Vui lòng kiểm tra endpoint, key và kết nối mạng.", ex);
        }
    }

    private Map<String, String> normalizeMomoParams(Map<?, ?> rawParams) {
        Map<String, String> normalized = new LinkedHashMap<>();
        if (rawParams == null) {
            return normalized;
        }
        rawParams.forEach((key, value) -> {
            if (key == null) {
                return;
            }
            String normalizedKey = String.valueOf(key).trim();
            if (normalizedKey.isBlank() || value == null) {
                return;
            }

            String normalizedValue = String.valueOf(value).trim();
            if (!normalizedValue.isBlank()) {
                normalized.put(normalizedKey, normalizedValue);
            }
        });
        return normalized;
    }

    private Map<String, String> normalizeVnpayParams(Map<String, String> rawParams) {
        Map<String, String> normalized = new LinkedHashMap<>();
        if (rawParams == null) {
            return normalized;
        }
        rawParams.forEach((key, value) -> {
            if (key == null || key.isBlank() || value == null) {
                return;
            }
            normalized.put(key.trim(), value.trim());
        });
        return normalized;
    }

    private boolean verifyMomoCreateResponseSignature(Map<String, Object> response) {
        if (response == null || response.isEmpty()) {
            return false;
        }
        String signature = readMapString(response, "signature");
        if (isBlank(signature)) {
            return true;
        }

        String raw = "accessKey=" + momoAccessKey.trim()
                + "&amount=" + readMapString(response, "amount")
                + "&orderId=" + readMapString(response, "orderId")
                + "&partnerCode=" + readMapString(response, "partnerCode")
                + "&payUrl=" + readMapString(response, "payUrl")
                + "&requestId=" + readMapString(response, "requestId")
                + "&responseTime=" + readMapString(response, "responseTime")
                + "&resultCode=" + readMapString(response, "resultCode");
        String expected = signMomo(raw);

        return MessageDigest.isEqual(
                signature.trim().getBytes(StandardCharsets.UTF_8),
                expected.getBytes(StandardCharsets.UTF_8)
        );
    }

    private boolean verifyMomoResultSignature(Map<String, String> params) {
        String signature = params.get("signature");
        if (signature == null || signature.isBlank()) {
            return false;
        }

        String raw = "accessKey=" + momoAccessKey.trim()
                + "&amount=" + params.getOrDefault("amount", "")
                + "&extraData=" + params.getOrDefault("extraData", "")
                + "&message=" + params.getOrDefault("message", "")
                + "&orderId=" + params.getOrDefault("orderId", "")
                + "&orderInfo=" + params.getOrDefault("orderInfo", "")
                + "&orderType=" + params.getOrDefault("orderType", "")
                + "&partnerCode=" + params.getOrDefault("partnerCode", "")
                + "&payType=" + params.getOrDefault("payType", "")
                + "&requestId=" + params.getOrDefault("requestId", "")
                + "&responseTime=" + params.getOrDefault("responseTime", "")
                + "&resultCode=" + params.getOrDefault("resultCode", "")
                + "&transId=" + params.getOrDefault("transId", "");
        String expected = signMomo(raw);

        return MessageDigest.isEqual(
                signature.trim().getBytes(StandardCharsets.UTF_8),
                expected.getBytes(StandardCharsets.UTF_8)
        );
    }

    private boolean verifyVnpaySignature(Map<String, String> params) {
        String receivedHash = normalizeHex(params.get("vnp_SecureHash"));
        if (receivedHash.isBlank()) {
            return false;
        }

        Map<String, String> signFields = new TreeMap<>();
        params.forEach((key, value) -> {
            if (key == null || value == null || value.isBlank()) {
                return;
            }
            if (!key.startsWith("vnp_")) {
                return;
            }
            if ("vnp_SecureHash".equals(key) || "vnp_SecureHashType".equals(key)) {
                return;
            }
            signFields.put(key, value);
        });

        String expectedHash = normalizeHex(signVnpay(buildVnpayHashData(signFields)));
        return MessageDigest.isEqual(
                receivedHash.getBytes(StandardCharsets.UTF_8),
                expectedHash.getBytes(StandardCharsets.UTF_8)
        );
    }

    private boolean isVnpaySuccess(Map<String, String> params) {
        String responseCode = params.getOrDefault("vnp_ResponseCode", "");
        String transactionStatus = params.getOrDefault("vnp_TransactionStatus", "");
        boolean responseOk = "00".equals(responseCode);
        boolean statusOk = transactionStatus.isBlank() || "00".equals(transactionStatus);
        return responseOk && statusOk;
    }

    private Map<String, String> vnpayAck(String code, String message) {
        Map<String, String> response = new LinkedHashMap<>();
        response.put("RspCode", code);
        response.put("Message", message);
        return response;
    }

    private String buildVnpayHashData(Map<String, String> params) {
        return params.entrySet()
                .stream()
                .filter(entry -> entry.getValue() != null && !entry.getValue().isBlank())
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> entry.getKey() + "=" + vnpayEncode(entry.getValue()))
                .collect(Collectors.joining("&"));
    }

    private String buildVnpayQuery(Map<String, String> params) {
        return params.entrySet()
                .stream()
                .filter(entry -> entry.getValue() != null && !entry.getValue().isBlank())
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> vnpayEncode(entry.getKey()) + "=" + vnpayEncode(entry.getValue()))
                .collect(Collectors.joining("&"));
    }

    private String signMockWebhook(String reference, String status) {
        String payload = reference + "|" + status;
        return signHmacSha256(payload, mockWebhookSecret, "Không thể tạo chữ ký webhook");
    }

    private String signMomo(String data) {
        return signHmacSha256(data, momoSecretKey, "Không thể tạo chữ ký MoMo");
    }

    private String signHmacSha256(String data, String secret, String errorMessage) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException(errorMessage, ex);
        }
    }

    private String signVnpay(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(vnpayHashSecret.trim().getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            byte[] digest = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("Không thể tạo chữ ký VNPay.", ex);
        }
    }

    private void appendStatusHistory(
            Order order,
            OrderStatus fromStatus,
            OrderStatus toStatus,
            String note,
            String changedBy
    ) {
        // tac dung code: luu history bang transaction rieng de loi lich su khong rollback cap nhat thanh toan.
        orderStatusHistoryService.saveHistorySafe(order, fromStatus, toStatus, note, changedBy);
    }

    private void ensurePaymentReference(Order order, String prefix) {
        if (order.getPaymentReference() != null && !order.getPaymentReference().isBlank()) {
            return;
        }
        // tac dung code: tao ma giao dich duy nhat de map callback vao dung don hang.
        order.setPaymentReference(generatePaymentReference(order.getId(), prefix));
    }

    private String normalizeReference(String rawReference) {
        String reference = rawReference == null ? "" : rawReference.trim();
        if (reference.isBlank()) {
            throw new IllegalArgumentException("Payment reference không được để trống");
        }
        return reference;
    }

    private String normalizeMockWebhookStatus(String rawStatus) {
        String status = rawStatus == null ? "" : rawStatus.trim().toUpperCase(Locale.ROOT);
        if (!"PAID".equals(status) && !"FAILED".equals(status)) {
            throw new IllegalArgumentException("Trạng thái webhook không hợp lệ");
        }
        return status;
    }

    private String normalizeClientIp(String rawIp) {
        if (rawIp == null || rawIp.isBlank()) {
            return "127.0.0.1";
        }
        String ip = rawIp.split(",")[0].trim();
        if (ip.startsWith("::ffff:")) {
            ip = ip.substring("::ffff:".length());
        }
        if (ip.isBlank() || "0:0:0:0:0:0:0:1".equals(ip) || "::1".equals(ip)) {
            return "127.0.0.1";
        }
        return ip;
    }

    private String normalizeHex(String hex) {
        return hex == null ? "" : hex.trim().toLowerCase(Locale.ROOT);
    }

    private PaymentGatewayProvider parseProvider(String rawProvider) {
        // tac dung code: chap nhan nhieu gia tri provider tu frontend de tranh loi parse JSON enum.
        if (rawProvider == null || rawProvider.trim().isBlank()) {
            return PaymentGatewayProvider.MOCK;
        }
        String normalized = rawProvider.trim().toUpperCase(Locale.ROOT);
        if ("MOCK".equals(normalized) || "MOCK_GATEWAY".equals(normalized)) {
            return PaymentGatewayProvider.MOCK;
        }
        if ("VNPAY".equals(normalized)) {
            return PaymentGatewayProvider.VNPAY;
        }
        if ("MOMO".equals(normalized)) {
            return PaymentGatewayProvider.MOMO;
        }
        throw new IllegalArgumentException("Provider thanh toán không hợp lệ. Hỗ trợ: MOCK, VNPAY, MOMO");
    }

    private String buildOrderRedirect(Long orderId, String paymentResult, String provider, String gatewayCode) {
        StringBuilder url = new StringBuilder("/payments/result")
                .append("?orderId=").append(orderId)
                .append("&payment=").append(urlEncode(paymentResult))
                .append("&provider=").append(urlEncode(provider));
        if (!isBlank(gatewayCode)) {
            url.append("&code=").append(urlEncode(gatewayCode));
        }
        return url.toString();
    }

    private String resolveReturnPaymentResult(Order order, boolean gatewaySuccess) {
        if (order == null) {
            return gatewaySuccess ? "pending-confirmation" : "failed";
        }

        OnlinePaymentStatus currentStatus = order.getOnlinePaymentStatus();
        if (currentStatus == OnlinePaymentStatus.PAID) {
            return "success";
        }
        if (currentStatus == OnlinePaymentStatus.FAILED) {
            return "failed";
        }
        return gatewaySuccess ? "pending-confirmation" : "failed";
    }

    private void applyReturnSuccessFallback(
            Order order,
            boolean gatewaySuccess,
            String provider,
            String note,
            String changedBy
    ) {
        if (!paymentAllowReturnConfirmation || !gatewaySuccess || order == null) {
            return;
        }
        if (order.getStatus() == OrderStatus.CANCELLED || order.getOnlinePaymentStatus() == OnlinePaymentStatus.PAID) {
            return;
        }
        markOrderPaid(order, provider, note, changedBy);
    }

    private boolean allowInsecureReturnConfirmation(boolean gatewaySuccess) {
        return paymentAllowReturnConfirmation && gatewaySuccess;
    }

    private long toVnpayAmount(Double orderTotalPrice) {
        if (orderTotalPrice == null) {
            return 0L;
        }
        return Math.round(orderTotalPrice * 100D);
    }

    private long toMomoAmount(Double orderTotalPrice) {
        if (orderTotalPrice == null) {
            return 0L;
        }
        return Math.round(orderTotalPrice);
    }

    private long parseLongSafely(String value) {
        if (value == null || value.isBlank()) {
            return -1L;
        }
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException ex) {
            return -1L;
        }
    }

    private int parseIntSafely(String value, int fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private String readMapString(Map<String, Object> source, String key) {
        if (source == null || key == null || key.isBlank()) {
            return "";
        }
        Object value = source.get(key);
        if (value == null) {
            return "";
        }
        String raw = String.valueOf(value).trim();
        if ("null".equalsIgnoreCase(raw)) {
            return "";
        }
        if (value instanceof Number number) {
            long asLong = number.longValue();
            if (number.doubleValue() == (double) asLong) {
                return String.valueOf(asLong);
            }
        }
        return raw;
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private String vnpayEncode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.US_ASCII);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isBlank();
    }

    private String generatePaymentReference(Long orderId, String prefix) {
        long now = System.currentTimeMillis();
        int random = ThreadLocalRandom.current().nextInt(100_000, 999_999);
        return prefix + "-" + orderId + "-" + now + "-" + random;
    }

    private boolean isOnlinePaymentMethod(PaymentMethod paymentMethod) {
        return paymentMethod == PaymentMethod.ONLINE_GATEWAY || paymentMethod == PaymentMethod.BANK_TRANSFER;
    }

    private void restoreStock(Order order) {
        if (order == null || order.getItems() == null) {
            return;
        }
        for (var item : order.getItems()) {
            if (item == null || item.getProduct() == null) {
                continue;
            }
            int stock = item.getProduct().getStock() == null ? 0 : item.getProduct().getStock();
            int qty = item.getQuantity() == null ? 0 : item.getQuantity();
            item.getProduct().setStock(stock + qty);
        }
    }
}

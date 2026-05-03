package com.techstore1.techstore1.service;

import com.techstore1.techstore1.dto.CreateOrderRequest;
import com.techstore1.techstore1.dto.OrderDetailResponse;
import com.techstore1.techstore1.dto.OrderItemLineResponse;
import com.techstore1.techstore1.dto.OrderItemRequest;
import com.techstore1.techstore1.dto.OrderStatusHistoryResponse;
import com.techstore1.techstore1.dto.OrderSummaryResponse;
import com.techstore1.techstore1.entity.Order;
import com.techstore1.techstore1.entity.OrderItem;
import com.techstore1.techstore1.entity.Product;
import com.techstore1.techstore1.entity.ProductVariant;
import com.techstore1.techstore1.entity.Promotion;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.enums.OnlinePaymentStatus;
import com.techstore1.techstore1.enums.OrderStatus;
import com.techstore1.techstore1.enums.PaymentMethod;
import com.techstore1.techstore1.repository.OrderRepository;
import com.techstore1.techstore1.repository.OrderStatusHistoryRepository;
import com.techstore1.techstore1.repository.ProductRepository;
import com.techstore1.techstore1.repository.ProductVariantRepository;
import com.techstore1.techstore1.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
// tac dung code: xu ly nghiep vu don hang va map du lieu chi tiet ra DTO cho frontend.
public class OrderService {

    private static final long BASE_VARIANT_KEY = 0L;

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final PromotionService promotionService;
    private final OrderStatusHistoryRepository orderStatusHistoryRepository;
    private final OrderStatusHistoryService orderStatusHistoryService;
    private final EmailNotificationService emailNotificationService;
    private final ProductPricingService productPricingService;
    private final JdbcTemplate jdbcTemplate;
    private final int onlineReservationMinutes;
    private volatile Boolean legacyBankTransferEnumColumn;

    public OrderService(
            OrderRepository orderRepository,
            UserRepository userRepository,
            ProductRepository productRepository,
            ProductVariantRepository productVariantRepository,
            PromotionService promotionService,
            OrderStatusHistoryRepository orderStatusHistoryRepository,
            OrderStatusHistoryService orderStatusHistoryService,
            EmailNotificationService emailNotificationService,
            ProductPricingService productPricingService,
            JdbcTemplate jdbcTemplate,
            @Value("${app.order.online-reservation-minutes:20}") int onlineReservationMinutes
    ) {
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
        this.productRepository = productRepository;
        this.productVariantRepository = productVariantRepository;
        this.promotionService = promotionService;
        this.orderStatusHistoryRepository = orderStatusHistoryRepository;
        this.orderStatusHistoryService = orderStatusHistoryService;
        this.emailNotificationService = emailNotificationService;
        this.productPricingService = productPricingService;
        this.jdbcTemplate = jdbcTemplate;
        // tac dung code: gioi han toi thieu 1 phut de tranh cau hinh loi <= 0.
        this.onlineReservationMinutes = Math.max(1, onlineReservationMinutes);
    }

    /**
     * Create order and return summary DTO for checkout page.
     */
    @Transactional
    public OrderSummaryResponse createOrderSummary(String username, CreateOrderRequest request) {
        return toSummary(createOrder(username, request));
    }

    @Transactional
    public Order createOrder(String username, CreateOrderRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Yêu cầu đặt hàng không hợp lệ.");
        }
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new IllegalArgumentException("Đơn hàng phải có ít nhất 1 sản phẩm.");
        }
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản."));

        Order order = new Order();
        order.setUser(user);
        order.setStatus(OrderStatus.PENDING);
        order.setShippingAddress(
                request.getShippingAddress() == null || request.getShippingAddress().isBlank()
                        ? user.getAddress()
                        : request.getShippingAddress()
        );
        String recipientName = firstNonBlank(
                safeText(request.getRecipientName()),
                safeText(user.getFullName()),
                safeText(user.getUsername())
        );
        if (recipientName == null) {
            throw new IllegalArgumentException("Vui lòng nhập tên người nhận.");
        }
        order.setRecipientName(recipientName);

        String recipientPhone = firstNonBlank(
                safeText(request.getRecipientPhone()),
                safeText(user.getPhone())
        );
        if (recipientPhone == null) {
            throw new IllegalArgumentException("Vui lòng nhập số điện thoại người nhận.");
        }
        order.setRecipientPhone(recipientPhone);

        // Allow checkout to choose payment method, default to COD when client omits this field.
        // tac dung code: map ONLINE_GATEWAY -> BANK_TRANSFER neu DB cu dang enum(BANK_TRANSFER,COD).
        order.setPaymentMethod(normalizePaymentMethodForDatabase(request.getPaymentMethod()));
        // tac dung code: thong nhat tat ca don (ke ca COD) bat dau o trang thai "chua thanh toan".
        order.setOnlinePaymentStatus(OnlinePaymentStatus.PENDING);
        // tac dung code: don online giu hang tam thoi trong mot khoang thoi gian cau hinh de tranh hold ton kho vo han.
        order.setReservationExpiresAt(isOnlinePaymentMethod(order.getPaymentMethod())
                ? LocalDateTime.now().plusMinutes(onlineReservationMinutes)
                : null);

        // Merge duplicated product+variant lines to avoid subtracting stock inconsistently.
        Map<OrderLineKey, Integer> quantityByLine = new LinkedHashMap<>();
        for (OrderItemRequest itemRequest : request.getItems()) {
            if (itemRequest == null || itemRequest.getProductId() == null
                    || itemRequest.getQuantity() == null || itemRequest.getQuantity() <= 0) {
                throw new IllegalArgumentException("Sản phẩm trong đơn hàng không hợp lệ.");
            }
            OrderLineKey key = new OrderLineKey(
                    itemRequest.getProductId(),
                    normalizeVariantKey(itemRequest.getVariantId())
            );
            quantityByLine.merge(key, itemRequest.getQuantity(), Integer::sum);
        }

        double subtotal = 0D;
        for (Map.Entry<OrderLineKey, Integer> entry : quantityByLine.entrySet()) {
            Long productId = entry.getKey().productId();
            Integer quantity = entry.getValue();

            // tac dung code: tuong thich du lieu cu khi cot products.version bi null, tranh NPE khi Hibernate tang version.
            ensureProductVersionInitialized(productId);
            Product product = productRepository.findById(productId)
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy sản phẩm: " + productId));

            ResolvedOrderVariant resolvedVariant = resolveOrderVariant(product, entry.getKey().variantId(), true);
            int currentProductStock = product.getStock() == null ? 0 : product.getStock();
            if (currentProductStock < quantity) {
                throw new IllegalArgumentException("Tồn kho tổng không đủ cho sản phẩm: " + product.getName());
            }
            if (resolvedVariant.availableStock() < quantity) {
                throw new IllegalArgumentException("Tồn kho biến thể không đủ cho sản phẩm: " + product.getName());
            }

            double unitPrice = productPricingService.calculateDiscountedPrice(
                    resolvedVariant.basePrice(),
                    product.getDiscountPercent()
            );

            // Decrease stock immediately when order is created.
            product.setStock(currentProductStock - quantity);
            if (resolvedVariant.variant() != null) {
                ProductVariant variant = resolvedVariant.variant();
                variant.setStock((variant.getStock() == null ? 0 : variant.getStock()) - quantity);
            }

            OrderItem item = new OrderItem();
            item.setOrder(order);
            item.setProduct(product);
            item.setProductVariantId(resolvedVariant.variantId());
            item.setProductVariantName(resolvedVariant.variantName());
            item.setQuantity(quantity);
            item.setPrice(unitPrice);
            order.getItems().add(item);

            subtotal += unitPrice * quantity;
        }

        // Apply promotion code snapshot at order creation time.
        String rawCode = request.getPromotionCode();
        Promotion promo = null;
        if (rawCode != null && !rawCode.trim().isBlank()) {
            promo = promotionService.findValidPromotionOrThrow(rawCode);
        }

        int percent = promo == null ? 0 : promo.getDiscountPercent();
        double discountAmount = percent <= 0 ? 0D : Math.round(subtotal * percent / 100.0);
        double total = Math.max(0D, subtotal - discountAmount);

        order.setSubtotalPrice(subtotal);
        order.setDiscountPercent(percent <= 0 ? null : percent);
        order.setPromotionCode(promo == null ? null : promo.getCode());
        order.setDiscountAmount(discountAmount);
        order.setTotalPrice(total);

        // Save first so order id exists, then append initial status event for timeline/audit.
        Order saved = saveOrderWithLegacyCharsetFallback(order);
        // tac dung code: set fromStatus = toStatus ngay luc tao don de tranh null constraint o DB cu.
        appendStatusHistory(saved, saved.getStatus(), saved.getStatus(), "Đơn hàng được tạo", username);
        emailNotificationService.sendOrderCreated(saved);
        return saved;
    }

    public List<OrderSummaryResponse> findSummariesByUser(String username) {
        // tac dung code: dong bo nhanh cac don online (het han/failed) truoc khi render danh sach cho khach.
        synchronizeOnlineOrderStates();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản."));

        return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::toSummary)
                .toList();
    }

    public List<OrderSummaryResponse> findAllSummaries() {
        // tac dung code: dam bao admin xem danh sach don moi nhat (khong bi treo trang thai PENDING qua han/failed).
        synchronizeOnlineOrderStates();
        return orderRepository.findAll(Sort.by(Sort.Direction.ASC, "id"))
                .stream()
                .map(this::toSummary)
                .toList();
    }

    public Page<OrderSummaryResponse> findAllSummariesPaged(int page, int size, String keyword, OrderStatus status) {
        return findAllSummariesPaged(page, size, "asc", keyword, null, status, null, null);
    }

    public Page<OrderSummaryResponse> findAllSummariesPaged(
            int page,
            int size,
            String sortDir,
            String keyword,
            Long orderId,
            OrderStatus orderStatus,
            OnlinePaymentStatus onlinePaymentStatus,
            String paymentProvider
    ) {
        // tac dung code: truoc khi phan trang danh sach, tu dong dong bo don online het han/failed de so lieu nhat quan.
        synchronizeOnlineOrderStates();
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        if (normalizedKeyword.isBlank()) {
            normalizedKeyword = null;
        }
        String normalizedPaymentProvider = paymentProvider == null ? "" : paymentProvider.trim();
        if (normalizedPaymentProvider.isBlank()) {
            normalizedPaymentProvider = null;
        }
        Long normalizedOrderId = (orderId == null || orderId <= 0) ? null : orderId;

        Sort.Direction direction = "desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC;
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(direction, "id"));
        return orderRepository.searchAdminOrders(
                orderStatus,
                normalizedOrderId,
                onlinePaymentStatus,
                normalizedPaymentProvider,
                normalizedKeyword,
                pageable
        ).map(this::toSummary);
    }

    @Transactional
    public OrderSummaryResponse updateStatusSummary(Long orderId, OrderStatus status, String actorUsername) {
        Order order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng."));

        OrderStatus current = order.getStatus();
        if (current == status) {
            return toSummary(order);
        }

        // Only allow cancellation for statuses where stock can still be rolled back.
        if (status == OrderStatus.CANCELLED) {
            boolean canCancel = current == OrderStatus.CANCEL_REQUESTED
                    || current == OrderStatus.PENDING
                    || current == OrderStatus.CONFIRMED;
            if (!canCancel) {
                throw new IllegalArgumentException("Không thể hủy đơn ở trạng thái hiện tại.");
            }
            restoreStock(order);
        }

        // If admin rejects cancellation request, clear old request reason/time.
        if (current == OrderStatus.CANCEL_REQUESTED && status != OrderStatus.CANCELLED) {
            order.setCancelRequestReason(null);
            order.setCancelRequestedAt(null);
        }

        order.setStatus(status);
        if (status == OrderStatus.DELIVERED) {
            // tac dung code: don da giao duoc xem la da thu tien, ke ca COD.
            order.setOnlinePaymentStatus(OnlinePaymentStatus.PAID);
            if (order.getPaidAt() == null) {
                order.setPaidAt(LocalDateTime.now());
            }
        }
        // tac dung code: khi don roi khoi trang thai cho xu ly thi khong can giu hang online nua.
        if (status != OrderStatus.PENDING && status != OrderStatus.CANCEL_REQUESTED) {
            order.setReservationExpiresAt(null);
        }
        Order saved = saveOrderWithLegacyCharsetFallback(order);

        String note = status == OrderStatus.CANCELLED
                ? "Admin đã duyệt hủy đơn"
                : "Admin cập nhật trạng thái đơn";
        appendStatusHistory(saved, current, status, note, actorUsername);
        emailNotificationService.sendOrderStatusChanged(saved, current, status, note);

        return toSummary(saved);
    }

    @Transactional
    public void deleteOrderByAdmin(Long orderId, String actorUsername) {
        if (orderId == null) {
            throw new IllegalArgumentException("Không tìm thấy đơn hàng.");
        }

        Order order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng."));

        // tac dung code: chan xoa cac don da vao luong giao hoac da thu tien de tranh sai lech doanh thu/doi soat.
        if (order.getStatus() == OrderStatus.SHIPPING || order.getStatus() == OrderStatus.DELIVERED) {
            throw new IllegalArgumentException("Không thể xóa đơn đang giao hoặc đã giao.");
        }
        if (order.getOnlinePaymentStatus() == OnlinePaymentStatus.PAID) {
            throw new IllegalArgumentException("Không thể xóa đơn đã thanh toán online.");
        }

        // tac dung code: hoan ton kho cho cac don chua huy truoc khi xoa ban ghi don.
        if (order.getStatus() != OrderStatus.CANCELLED) {
            restoreStock(order);
        }

        orderStatusHistoryRepository.deleteByOrderId(order.getId());
        orderRepository.delete(order);
    }

    @Transactional
    public OrderDetailResponse getOrderDetailForAdmin(Long orderId) {
        // tac dung code: vao trang chi tiet se cap nhat ngay neu don online da qua han giu hang.
        expireReservationIfNeeded(orderId, "admin-order-detail");
        reconcileFailedOnlineOrder(orderId, "admin-order-detail");
        Order order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng."));
        return toDetail(order);
    }

    @Transactional
    public OrderDetailResponse getOrderDetailForUser(String username, Long orderId) {
        // tac dung code: vao trang chi tiet se cap nhat ngay neu don online da qua han giu hang.
        expireReservationIfNeeded(orderId, "customer-order-detail");
        reconcileFailedOnlineOrder(orderId, "customer-order-detail");
        Order order = orderRepository.findByIdWithItemsForUser(orderId, username)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng."));
        return toDetail(order);
    }

    @Transactional
    public OrderDetailResponse requestCancelOrder(String username, Long orderId, String reason) {
        Order order = orderRepository.findByIdWithItemsForUser(orderId, username)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng."));

        OrderStatus current = order.getStatus();
        if (current == OrderStatus.CANCEL_REQUESTED) {
            throw new IllegalArgumentException("Đơn hàng đã gửi yêu cầu hủy trước đó.");
        }

        boolean canRequest = current == OrderStatus.PENDING || current == OrderStatus.CONFIRMED;
        if (!canRequest) {
            throw new IllegalArgumentException("Không thể gửi yêu cầu hủy ở trạng thái hiện tại.");
        }

        String normalizedReason = reason == null ? null : reason.trim();
        if (normalizedReason != null && normalizedReason.isBlank()) {
            normalizedReason = null;
        }

        order.setStatus(OrderStatus.CANCEL_REQUESTED);
        order.setCancelRequestReason(normalizedReason);
        order.setCancelRequestedAt(LocalDateTime.now());
        Order saved = saveOrderWithLegacyCharsetFallback(order);

        String note = normalizedReason == null
                ? "Khách gửi yêu cầu hủy đơn"
                : "Khách gửi yêu cầu hủy: " + normalizedReason;
        appendStatusHistory(saved, current, OrderStatus.CANCEL_REQUESTED, note, username);
        emailNotificationService.sendOrderStatusChanged(saved, current, OrderStatus.CANCEL_REQUESTED, note);

        return toDetail(saved);
    }

    @Transactional
    public int expireOnlineReservations() {
        LocalDateTime now = LocalDateTime.now();
        List<Order> expiredOrders = orderRepository.findExpiredOnlineReservations(now);
        int expiredCount = 0;

        for (Order order : expiredOrders) {
            if (expireReservationIfNeededInternal(order, now, "reservation-scheduler")) {
                expiredCount++;
            }
        }
        return expiredCount;
    }

    @Transactional
    public boolean expireReservationIfNeeded(Long orderId, String changedBy) {
        if (orderId == null) {
            return false;
        }
        Order order = orderRepository.findByIdWithItems(orderId).orElse(null);
        if (order == null) {
            return false;
        }
        return expireReservationIfNeededInternal(order, LocalDateTime.now(), changedBy);
    }

    @Transactional
    public int reconcileFailedOnlineOrders() {
        List<Order> failedOrders = orderRepository.findPendingFailedOnlineOrders();
        int reconciledCount = 0;
        for (Order order : failedOrders) {
            if (reconcileFailedOnlineOrderInternal(order, "failed-payment-reconcile")) {
                reconciledCount++;
            }
        }
        return reconciledCount;
    }

    @Transactional
    public boolean reconcileFailedOnlineOrder(Long orderId, String changedBy) {
        if (orderId == null) {
            return false;
        }
        Order order = orderRepository.findByIdWithItems(orderId).orElse(null);
        if (order == null) {
            return false;
        }
        return reconcileFailedOnlineOrderInternal(order, changedBy);
    }

    @Transactional
    public void synchronizeOnlineOrderStates() {
        // tac dung code: dong bo ca 2 nhom don: pending-failed va pending-het-han.
        reconcileFailedOnlineOrders();
        expireOnlineReservations();
    }

    private OrderSummaryResponse toSummary(Order order) {
        OnlinePaymentStatus paymentStatus = resolveDisplayOnlinePaymentStatus(order);
        return new OrderSummaryResponse(
                order.getId(),
                order.getUser() != null ? order.getUser().getUsername() : null,
                order.getTotalPrice(),
                order.getStatus(),
                order.getCreatedAt(),
                order.getPaymentMethod(),
                paymentStatus,
                order.getPaymentProvider(),
                order.getPaymentReference(),
                order.getPaidAt()
        );
    }

    private OrderDetailResponse toDetail(Order order) {
        List<OrderItemLineResponse> lines = order.getItems()
                .stream()
                .map((item) -> {
                    Product p = item.getProduct();
                    Long productId = p != null ? p.getId() : null;
                    long variantId = normalizeVariantKey(item.getProductVariantId());
                    String variantName = safeText(item.getProductVariantName());
                    String baseName = p != null ? p.getName() : "Sản phẩm";
                    String name = variantName == null ? baseName : baseName + " (" + variantName + ")";
                    String imageUrl = p != null ? p.getImageUrl() : null;
                    double unitPrice = item.getPrice() == null ? 0D : item.getPrice();
                    int qty = item.getQuantity() == null ? 0 : item.getQuantity();
                    double lineTotal = unitPrice * qty;

                    return new OrderItemLineResponse(
                            productId,
                            name,
                            variantId > BASE_VARIANT_KEY ? variantId : null,
                            variantName,
                            imageUrl,
                            unitPrice,
                            qty,
                            lineTotal
                    );
                })
                .toList();

        // Load status timeline for both customer and admin order detail screens.
        List<OrderStatusHistoryResponse> history = orderStatusHistoryRepository
                .findByOrderIdOrderByCreatedAtAsc(order.getId())
                .stream()
                .map(entry -> new OrderStatusHistoryResponse(
                        entry.getFromStatus(),
                        entry.getToStatus(),
                        entry.getNote(),
                        entry.getChangedBy(),
                        entry.getCreatedAt()
                ))
                .toList();

        return new OrderDetailResponse(
                order.getId(),
                order.getUser() != null ? order.getUser().getUsername() : null,
                order.getStatus(),
                order.getCancelRequestReason(),
                order.getCancelRequestedAt(),
                order.getCreatedAt(),
                order.getRecipientName(),
                order.getRecipientPhone(),
                order.getShippingAddress(),
                order.getPaymentMethod(),
                resolveDisplayOnlinePaymentStatus(order),
                order.getPaymentProvider(),
                order.getPaymentReference(),
                order.getPaidAt(),
                order.getReservationExpiresAt(),
                order.getSubtotalPrice(),
                order.getDiscountAmount(),
                order.getDiscountPercent(),
                order.getPromotionCode(),
                order.getTotalPrice(),
                lines,
                history
        );
    }

    private OnlinePaymentStatus resolveDisplayOnlinePaymentStatus(Order order) {
        if (order == null) {
            return OnlinePaymentStatus.PENDING;
        }
        if (order.getStatus() == OrderStatus.DELIVERED) {
            return OnlinePaymentStatus.PAID;
        }
        OnlinePaymentStatus status = order.getOnlinePaymentStatus();
        if (status == null || status == OnlinePaymentStatus.NOT_REQUIRED) {
            return OnlinePaymentStatus.PENDING;
        }
        return status;
    }

    private void appendStatusHistory(
            Order order,
            OrderStatus fromStatus,
            OrderStatus toStatus,
            String note,
            String changedBy
    ) {
        // tac dung code: luu history bang transaction rieng de loi history khong rollback don chinh.
        orderStatusHistoryService.saveHistorySafe(order, fromStatus, toStatus, note, changedBy);
    }

    private Order saveOrderWithLegacyCharsetFallback(Order order) {
        try {
            // tac dung code: flush ngay de bat loi CSDL tai diem tao/sua don (khong doi den luc commit).
            return orderRepository.saveAndFlush(order);
        } catch (RuntimeException ex) {
            if (!isIncorrectStringValue(ex)) {
                throw ex;
            }

            // tac dung code: fallback cho MySQL collation cu (latin1), strip dau de don van tao duoc.
            order.setRecipientName(sanitizeForLegacyDatabase(order.getRecipientName()));
            order.setRecipientPhone(sanitizeForLegacyDatabase(order.getRecipientPhone()));
            order.setShippingAddress(sanitizeForLegacyDatabase(order.getShippingAddress()));
            order.setCancelRequestReason(sanitizeForLegacyDatabase(order.getCancelRequestReason()));
            order.setPromotionCode(sanitizeForLegacyDatabase(order.getPromotionCode()));
            return orderRepository.saveAndFlush(order);
        }
    }

    private boolean isIncorrectStringValue(Throwable throwable) {
        Throwable cursor = throwable;
        while (cursor != null) {
            String message = cursor.getMessage();
            if (message != null) {
                String normalized = message.toLowerCase();
                if (normalized.contains("incorrect string value")
                        || normalized.contains("cannot convert string")
                        || normalized.contains("character set")) {
                    return true;
                }
            }
            cursor = cursor.getCause();
        }
        return false;
    }

    private boolean isOnlinePaymentMethod(PaymentMethod paymentMethod) {
        return paymentMethod == PaymentMethod.ONLINE_GATEWAY || paymentMethod == PaymentMethod.BANK_TRANSFER;
    }

    private void ensureProductVersionInitialized(Long productId) {
        if (productId == null) {
            return;
        }
        try {
            jdbcTemplate.update("UPDATE products SET version = 0 WHERE id = ? AND version IS NULL", productId);
        } catch (RuntimeException ignored) {
            // tac dung code: neu DB cu khong co cot version thi bo qua de khong chan luong dat hang.
        }
    }

    private PaymentMethod normalizePaymentMethodForDatabase(PaymentMethod requestedMethod) {
        PaymentMethod method = requestedMethod == null ? PaymentMethod.COD : requestedMethod;
        if (method != PaymentMethod.ONLINE_GATEWAY) {
            return method;
        }
        // tac dung code: tu dong tuong thich schema cu enum('BANK_TRANSFER','COD') ma khong can sua tay DB.
        return isLegacyBankTransferEnumColumn() ? PaymentMethod.BANK_TRANSFER : PaymentMethod.ONLINE_GATEWAY;
    }

    private boolean isLegacyBankTransferEnumColumn() {
        if (legacyBankTransferEnumColumn != null) {
            return legacyBankTransferEnumColumn;
        }

        synchronized (this) {
            if (legacyBankTransferEnumColumn != null) {
                return legacyBankTransferEnumColumn;
            }

            boolean legacy = false;
            try {
                Map<String, Object> row = jdbcTemplate.queryForMap("""
                        SELECT DATA_TYPE, COLUMN_TYPE
                        FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE()
                          AND TABLE_NAME = 'orders'
                          AND COLUMN_NAME = 'payment_method'
                        """);
                String dataType = String.valueOf(row.getOrDefault("DATA_TYPE", "")).toLowerCase();
                String columnType = String.valueOf(row.getOrDefault("COLUMN_TYPE", "")).toUpperCase();
                legacy = "enum".equals(dataType)
                        && columnType.contains("BANK_TRANSFER")
                        && !columnType.contains("ONLINE_GATEWAY");
            } catch (RuntimeException ignored) {
                // tac dung code: neu khong doc duoc metadata thi giu logic hien tai, khong chan luong dat hang.
            }

            legacyBankTransferEnumColumn = legacy;
            return legacy;
        }
    }

    private String sanitizeForLegacyDatabase(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return normalized
                .replace("\u0111", "d")
                .replace("\u0110", "D");
    }

    private boolean expireReservationIfNeededInternal(Order order, LocalDateTime now, String changedBy) {
        if (!shouldExpireReservation(order, now)) {
            return false;
        }

        OrderStatus currentStatus = order.getStatus();
        restoreStock(order);

        order.setStatus(OrderStatus.CANCELLED);
        order.setOnlinePaymentStatus(OnlinePaymentStatus.FAILED);
        order.setReservationExpiresAt(null);

        Order saved = saveOrderWithLegacyCharsetFallback(order);
        String actor = (changedBy == null || changedBy.isBlank()) ? "reservation-system" : changedBy.trim();
            String note = "Hệ thống tự động hủy đơn vì hết hạn thanh toán online";
        appendStatusHistory(saved, currentStatus, OrderStatus.CANCELLED, note, actor);
        emailNotificationService.sendOrderStatusChanged(saved, currentStatus, OrderStatus.CANCELLED, note);
        emailNotificationService.sendOrderPaymentResult(saved, OnlinePaymentStatus.FAILED, "RESERVATION_EXPIRE");
        return true;
    }

    private boolean shouldExpireReservation(Order order, LocalDateTime now) {
        if (order == null || now == null) {
            return false;
        }
        if (!isOnlinePaymentMethod(order.getPaymentMethod())) {
            return false;
        }
        if (order.getOnlinePaymentStatus() == null || order.getOnlinePaymentStatus() != OnlinePaymentStatus.PENDING) {
            return false;
        }
        if (order.getReservationExpiresAt() == null || order.getReservationExpiresAt().isAfter(now)) {
            return false;
        }

        OrderStatus status = order.getStatus();
        return status == OrderStatus.PENDING || status == OrderStatus.CANCEL_REQUESTED;
    }

    private boolean reconcileFailedOnlineOrderInternal(Order order, String changedBy) {
        if (order == null) {
            return false;
        }
        if (!isOnlinePaymentMethod(order.getPaymentMethod())) {
            return false;
        }
        if (order.getOnlinePaymentStatus() != OnlinePaymentStatus.FAILED) {
            return false;
        }
        OrderStatus current = order.getStatus();
        if (current != OrderStatus.PENDING && current != OrderStatus.CANCEL_REQUESTED) {
            return false;
        }

        restoreStock(order);
        order.setStatus(OrderStatus.CANCELLED);
        order.setReservationExpiresAt(null);

        Order saved = saveOrderWithLegacyCharsetFallback(order);
        String actor = (changedBy == null || changedBy.isBlank()) ? "failed-payment-reconcile" : changedBy.trim();
            String note = "Hệ thống đồng bộ đơn online thất bại về trạng thái đã hủy";
        appendStatusHistory(saved, current, OrderStatus.CANCELLED, note, actor);
        emailNotificationService.sendOrderStatusChanged(saved, current, OrderStatus.CANCELLED, note);
        return true;
    }

    private void restoreStock(Order order) {
        for (OrderItem item : order.getItems()) {
            Product product = item.getProduct();
            if (product == null) {
                continue;
            }

            int stock = product.getStock() == null ? 0 : product.getStock();
            int qty = item.getQuantity() == null ? 0 : item.getQuantity();
            product.setStock(stock + qty);

            long variantId = normalizeVariantKey(item.getProductVariantId());
            if (variantId <= BASE_VARIANT_KEY || qty <= 0) {
                continue;
            }

            ProductVariant variant = productVariantRepository.findById(variantId).orElse(null);
            if (variant == null || variant.getProduct() == null
                    || !Objects.equals(variant.getProduct().getId(), product.getId())) {
                continue;
            }
            int variantStock = variant.getStock() == null ? 0 : variant.getStock();
            variant.setStock(variantStock + qty);
        }
    }

    private ResolvedOrderVariant resolveOrderVariant(Product product, Long requestedVariantId, boolean allowAutoSelect) {
        long normalizedVariantId = normalizeVariantKey(requestedVariantId);
        List<ProductVariant> variants = productVariantRepository.findByProductIdOrderBySortOrderAscIdAsc(product.getId());
        if (variants.isEmpty()) {
            if (product.getPrice() == null || product.getPrice() < 0D) {
                throw new IllegalArgumentException("Sản phẩm chưa có giá hợp lệ: " + product.getName());
            }
            return new ResolvedOrderVariant(
                    BASE_VARIANT_KEY,
                    null,
                    null,
                    productPricingService.normalizePrice(product.getPrice()),
                    product.getStock() == null ? 0 : product.getStock()
            );
        }

        ProductVariant selected = null;
        if (normalizedVariantId > BASE_VARIANT_KEY) {
            selected = variants.stream()
                    .filter(variant -> Objects.equals(variant.getId(), normalizedVariantId))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Biến thể không hợp lệ"));
        } else if (allowAutoSelect) {
            selected = variants.stream()
                    .filter(variant -> variant.getStock() != null && variant.getStock() > 0)
                    .findFirst()
                    .orElse(variants.get(0));
        }

        if (selected == null) {
            throw new IllegalArgumentException("Vui lòng chọn biến thể sản phẩm");
        }

        return new ResolvedOrderVariant(
                normalizeVariantKey(selected.getId()),
                safeText(selected.getName()),
                selected,
                resolveVariantBasePrice(product, selected),
                selected.getStock() == null ? 0 : selected.getStock()
        );
    }

    private double resolveVariantBasePrice(Product product, ProductVariant variant) {
        if (variant != null && variant.getPrice() != null && variant.getPrice() >= 0D) {
            return productPricingService.normalizePrice(variant.getPrice());
        }
        if (product.getPrice() == null || product.getPrice() < 0D) {
            throw new IllegalArgumentException("Sản phẩm chưa có giá hợp lệ: " + product.getName());
        }
        return productPricingService.normalizePrice(product.getPrice());
    }

    private long normalizeVariantKey(Long rawVariantId) {
        if (rawVariantId == null || rawVariantId <= 0L) {
            return BASE_VARIANT_KEY;
        }
        return rawVariantId;
    }

    private String safeText(String value) {
        String text = value == null ? "" : value.trim();
        return text.isBlank() ? null : text;
    }

    private String firstNonBlank(String... values) {
        if (values == null || values.length == 0) {
            return null;
        }
        for (String value : values) {
            String text = safeText(value);
            if (text != null) {
                return text;
            }
        }
        return null;
    }

    private record OrderLineKey(Long productId, Long variantId) {
    }

    private record ResolvedOrderVariant(
            long variantId,
            String variantName,
            ProductVariant variant,
            double basePrice,
            int availableStock
    ) {
    }
}


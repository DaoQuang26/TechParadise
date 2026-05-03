package com.techstore1.techstore1;

import com.techstore1.techstore1.dto.CreateOrderRequest;
import com.techstore1.techstore1.dto.OrderItemRequest;
import com.techstore1.techstore1.dto.OrderSummaryResponse;
import com.techstore1.techstore1.entity.Product;
import com.techstore1.techstore1.entity.ProductVariant;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.enums.OnlinePaymentStatus;
import com.techstore1.techstore1.enums.OrderStatus;
import com.techstore1.techstore1.enums.PaymentMethod;
import com.techstore1.techstore1.enums.Role;
import com.techstore1.techstore1.repository.CartItemRepository;
import com.techstore1.techstore1.repository.OrderRepository;
import com.techstore1.techstore1.repository.OrderStatusHistoryRepository;
import com.techstore1.techstore1.repository.ProductRepository;
import com.techstore1.techstore1.repository.ProductVariantRepository;
import com.techstore1.techstore1.repository.UserRepository;
import com.techstore1.techstore1.service.OrderService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@SpringBootTest
class OrderCheckoutIntegrationTest {

    @Autowired
    private OrderService orderService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductVariantRepository productVariantRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderStatusHistoryRepository orderStatusHistoryRepository;

    @Autowired
    private CartItemRepository cartItemRepository;

    private String createdUsername;
    private Long createdProductId;
    private Long createdOrderId;

    @AfterEach
    void cleanup() {
        if (createdOrderId != null) {
            orderStatusHistoryRepository.deleteAll(orderStatusHistoryRepository.findByOrderIdOrderByCreatedAtAsc(createdOrderId));
            orderRepository.findById(createdOrderId).ifPresent(orderRepository::delete);
        }
        if (createdUsername != null) {
            userRepository.findByUsernameIgnoreCase(createdUsername).ifPresent(user -> {
                cartItemRepository.deleteByUserId(user.getId());
                userRepository.delete(user);
            });
        }
        if (createdProductId != null) {
            productVariantRepository.deleteByProductId(createdProductId);
            productRepository.findById(createdProductId).ifPresent(productRepository::delete);
        }
    }

    @Test
    void createOrderSummaryShouldCommitWithoutTransactionSystemException() {
        // tac dung code: tao user test doc lap de tai hien dung luong dat hang.
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String username = "order_test_" + suffix;
        createdUsername = username;

        User user = new User();
        user.setUsername(username);
        user.setEmail(username + "@mail.local");
        user.setPassword("$2a$10$4g6jDI3I8ULfIGQkPj2QseHirIXL50DJBSSTXobHxPPH/FkOFjH6W"); // 123456
        user.setRole(Role.CUSTOMER);
        user.setPhone("0900000000");
        user.setAddress("123 Test Street");
        userRepository.save(user);

        // tac dung code: tao san pham ton kho > 0 de dat don hop le.
        Product product = new Product();
        product.setName("Order test product " + suffix);
        product.setPrice(1000000D);
        product.setStock(10);
        product.setDescription("integration test product");
        product = productRepository.save(product);
        createdProductId = product.getId();

        OrderItemRequest line = new OrderItemRequest();
        line.setProductId(product.getId());
        line.setQuantity(1);

        CreateOrderRequest request = new CreateOrderRequest();
        request.setShippingAddress("123 Test Street, District 1, HCM");
        request.setPaymentMethod(PaymentMethod.COD);
        request.setItems(List.of(line));

        OrderSummaryResponse summary = orderService.createOrderSummary(username, request);
        createdOrderId = summary.id();

        Assertions.assertNotNull(summary);
        Assertions.assertNotNull(summary.id());
        Assertions.assertEquals(username, summary.customerUsername());
    }

    @Test
    void createOrderSummaryWithVietnameseAddressAndOnlineGatewayShouldNotThrow() {
        // tac dung code: tai hien du lieu tu form checkout thuc te (co dau + ghi chu + online gateway).
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String username = "order_vn_" + suffix;
        createdUsername = username;

        User user = new User();
        user.setUsername(username);
        user.setEmail(username + "@mail.local");
        user.setPassword("$2a$10$4g6jDI3I8ULfIGQkPj2QseHirIXL50DJBSSTXobHxPPH/FkOFjH6W");
        user.setRole(Role.CUSTOMER);
        user.setPhone("0900000001");
        user.setAddress("Số 1, Đường Lê Lợi, Quáº­n 1, TP. Hồ Chí Minh");
        userRepository.save(user);

        Product product = new Product();
        product.setName("Điện thoáº¡i test " + suffix);
        product.setPrice(15000000D);
        product.setStock(5);
        product.setDescription("Sáº£n pháº©m test tiáº¿ng Việt");
        product = productRepository.save(product);
        createdProductId = product.getId();

        OrderItemRequest line = new OrderItemRequest();
        line.setProductId(product.getId());
        line.setQuantity(1);

        CreateOrderRequest request = new CreateOrderRequest();
        request.setItems(List.of(line));
        request.setPaymentMethod(PaymentMethod.ONLINE_GATEWAY);
        request.setShippingAddress("""
                Số 99, Đường Nguyễn Huệ, Phường Báº¿n Nghé, Quáº­n 1, TP. Hồ Chí Minh
                Ghi chú: Giao sau 18h, gọi trước khi giao giúp tôi.
                """);

        OrderSummaryResponse summary = orderService.createOrderSummary(username, request);
        createdOrderId = summary.id();

        Assertions.assertNotNull(summary);
        Assertions.assertNotNull(summary.id());
        Assertions.assertEquals(username, summary.customerUsername());
        Assertions.assertEquals(com.techstore1.techstore1.enums.OrderStatus.PENDING, summary.status());

        // tac dung code: kiem tra don online moi tao duoc gan trang thai thanh toan online cho webhook.
        var order = orderRepository.findById(summary.id()).orElseThrow();
        Assertions.assertEquals(OnlinePaymentStatus.PENDING, order.getOnlinePaymentStatus());
        Assertions.assertTrue(
                order.getPaymentMethod() == PaymentMethod.ONLINE_GATEWAY
                        || order.getPaymentMethod() == PaymentMethod.BANK_TRANSFER
        );
    }

    @Test
    void expireReservationShouldCancelOrderAndRestoreStock() {
        // tac dung code: tao du lieu doc lap de verify luong auto huy don online het han.
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String username = "order_expire_" + suffix;
        createdUsername = username;

        User user = new User();
        user.setUsername(username);
        user.setEmail(username + "@mail.local");
        user.setPassword("$2a$10$4g6jDI3I8ULfIGQkPj2QseHirIXL50DJBSSTXobHxPPH/FkOFjH6W");
        user.setRole(Role.CUSTOMER);
        user.setPhone("0900000002");
        user.setAddress("456 Test Street");
        userRepository.save(user);

        Product product = new Product();
        product.setName("Expire reservation product " + suffix);
        product.setPrice(2000000D);
        product.setStock(7);
        product.setDescription("reservation expiry integration test");
        product = productRepository.save(product);
        createdProductId = product.getId();

        OrderItemRequest line = new OrderItemRequest();
        line.setProductId(product.getId());
        line.setQuantity(2);

        CreateOrderRequest request = new CreateOrderRequest();
        request.setItems(List.of(line));
        request.setPaymentMethod(PaymentMethod.ONLINE_GATEWAY);
        request.setShippingAddress("456 Test Street, District 1, HCM");

        OrderSummaryResponse summary = orderService.createOrderSummary(username, request);
        createdOrderId = summary.id();

        // tac dung code: gia lap don qua han giu hang bang cach day moc het han ve qua khu.
        var order = orderRepository.findByIdWithItems(summary.id()).orElseThrow();
        order.setReservationExpiresAt(LocalDateTime.now().minusMinutes(2));
        orderRepository.saveAndFlush(order);

        boolean expired = orderService.expireReservationIfNeeded(summary.id(), "integration-test");
        Assertions.assertTrue(expired);

        var refreshedOrder = orderRepository.findByIdWithItems(summary.id()).orElseThrow();
        Assertions.assertEquals(OrderStatus.CANCELLED, refreshedOrder.getStatus());
        Assertions.assertEquals(OnlinePaymentStatus.FAILED, refreshedOrder.getOnlinePaymentStatus());
        Assertions.assertNull(refreshedOrder.getReservationExpiresAt());

        var refreshedProduct = productRepository.findById(product.getId()).orElseThrow();
        Assertions.assertEquals(7, refreshedProduct.getStock());
    }

    @Test
    void createOrderSummaryWithVariantShouldUseVariantStockAndPrice() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String username = "order_variant_" + suffix;
        createdUsername = username;

        User user = new User();
        user.setUsername(username);
        user.setEmail(username + "@mail.local");
        user.setPassword("$2a$10$4g6jDI3I8ULfIGQkPj2QseHirIXL50DJBSSTXobHxPPH/FkOFjH6W");
        user.setRole(Role.CUSTOMER);
        user.setPhone("0900000003");
        user.setAddress("789 Variant Street");
        userRepository.save(user);

        Product product = new Product();
        product.setName("Variant order test " + suffix);
        product.setPrice(22000000D);
        product.setDiscountPercent(10D);
        product.setStock(12);
        product.setDescription("variant integration test");
        product = productRepository.save(product);
        createdProductId = product.getId();

        ProductVariant variantA = new ProductVariant();
        variantA.setProduct(product);
        variantA.setName("16GB / 512GB");
        variantA.setSku("VAR-" + suffix + "-A");
        variantA.setPrice(21000000D);
        variantA.setStock(5);
        variantA.setSortOrder(0);

        ProductVariant variantB = new ProductVariant();
        variantB.setProduct(product);
        variantB.setName("32GB / 1TB");
        variantB.setSku("VAR-" + suffix + "-B");
        variantB.setPrice(26000000D);
        variantB.setStock(7);
        variantB.setSortOrder(1);

        List<ProductVariant> savedVariants = productVariantRepository.saveAll(List.of(variantA, variantB));
        ProductVariant savedVariantB = savedVariants.stream()
                .filter(variant -> "32GB / 1TB".equals(variant.getName()))
                .findFirst()
                .orElseThrow();

        OrderItemRequest line = new OrderItemRequest();
        line.setProductId(product.getId());
        line.setVariantId(savedVariantB.getId());
        line.setQuantity(2);

        CreateOrderRequest request = new CreateOrderRequest();
        request.setShippingAddress("789 Variant Street, District 2, HCM");
        request.setPaymentMethod(PaymentMethod.COD);
        request.setItems(List.of(line));

        OrderSummaryResponse summary = orderService.createOrderSummary(username, request);
        createdOrderId = summary.id();

        var order = orderRepository.findByIdWithItems(summary.id()).orElseThrow();
        Assertions.assertEquals(1, order.getItems().size());
        var savedLine = order.getItems().get(0);

        // Variant B price (26,000,000) with 10% discount => 23,400,000
        Assertions.assertEquals(23400000D, savedLine.getPrice());
        Assertions.assertEquals(savedVariantB.getId(), savedLine.getProductVariantId());
        Assertions.assertEquals("32GB / 1TB", savedLine.getProductVariantName());

        var refreshedProduct = productRepository.findById(product.getId()).orElseThrow();
        Assertions.assertEquals(10, refreshedProduct.getStock());

        var refreshedVariantB = productVariantRepository.findById(savedVariantB.getId()).orElseThrow();
        Assertions.assertEquals(5, refreshedVariantB.getStock());
    }

}

package com.techstore1.techstore1;

import com.techstore1.techstore1.dto.AddCartItemRequest;
import com.techstore1.techstore1.dto.CartResponse;
import com.techstore1.techstore1.dto.UpdateCartQuantityRequest;
import com.techstore1.techstore1.entity.Product;
import com.techstore1.techstore1.entity.ProductVariant;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.enums.Role;
import com.techstore1.techstore1.repository.CartItemRepository;
import com.techstore1.techstore1.repository.ProductRepository;
import com.techstore1.techstore1.repository.ProductVariantRepository;
import com.techstore1.techstore1.repository.UserRepository;
import com.techstore1.techstore1.service.CartService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.UUID;

@SpringBootTest
class CartVariantIntegrationTest {

    @Autowired
    private CartService cartService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductVariantRepository productVariantRepository;

    @Autowired
    private CartItemRepository cartItemRepository;

    private String createdUsername;
    private Long createdProductId;

    @AfterEach
    void cleanup() {
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
    void addDifferentVariantsShouldCreateSeparateLines() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String username = "cart_variant_" + suffix;
        createdUsername = username;

        userRepository.save(newCustomer(username, "0907000001"));

        Product product = new Product();
        product.setName("Cart variant product " + suffix);
        product.setPrice(10000000D);
        product.setDiscountPercent(10D);
        product.setStock(20);
        product.setDescription("cart variant test");
        product = productRepository.save(product);
        createdProductId = product.getId();

        ProductVariant variantA = saveVariant(product, "8GB / 256GB", "CV-" + suffix + "-A", 10000000D, 5, 0);
        ProductVariant variantB = saveVariant(product, "12GB / 512GB", "CV-" + suffix + "-B", 12000000D, 6, 1);

        AddCartItemRequest addA = new AddCartItemRequest();
        addA.setProductId(product.getId());
        addA.setVariantId(variantA.getId());
        addA.setQuantity(2);
        cartService.addItem(username, addA);

        AddCartItemRequest addB = new AddCartItemRequest();
        addB.setProductId(product.getId());
        addB.setVariantId(variantB.getId());
        addB.setQuantity(1);
        CartResponse cart = cartService.addItem(username, addB);

        Assertions.assertEquals(2, cart.items().size());
        Assertions.assertEquals(3, cart.totalQuantity());

        var lineA = cart.items().stream()
                .filter(item -> variantA.getId().equals(item.variantId()))
                .findFirst()
                .orElseThrow();
        var lineB = cart.items().stream()
                .filter(item -> variantB.getId().equals(item.variantId()))
                .findFirst()
                .orElseThrow();

        Assertions.assertEquals(2, lineA.quantity());
        Assertions.assertEquals(9000000D, lineA.price());
        Assertions.assertEquals(1, lineB.quantity());
        Assertions.assertEquals(10800000D, lineB.price());
    }

    @Test
    void setQuantityAndRemoveByVariantShouldAffectCorrectLine() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String username = "cart_mutate_" + suffix;
        createdUsername = username;

        userRepository.save(newCustomer(username, "0907000002"));

        Product product = new Product();
        product.setName("Cart mutate product " + suffix);
        product.setPrice(8000000D);
        product.setDiscountPercent(0D);
        product.setStock(30);
        product.setDescription("cart mutate test");
        product = productRepository.save(product);
        createdProductId = product.getId();

        ProductVariant variantA = saveVariant(product, "White", "CM-" + suffix + "-A", 7800000D, 10, 0);
        ProductVariant variantB = saveVariant(product, "Black", "CM-" + suffix + "-B", 7900000D, 10, 1);

        AddCartItemRequest addA = new AddCartItemRequest();
        addA.setProductId(product.getId());
        addA.setVariantId(variantA.getId());
        addA.setQuantity(1);
        cartService.addItem(username, addA);

        AddCartItemRequest addB = new AddCartItemRequest();
        addB.setProductId(product.getId());
        addB.setVariantId(variantB.getId());
        addB.setQuantity(2);
        cartService.addItem(username, addB);

        UpdateCartQuantityRequest update = new UpdateCartQuantityRequest();
        update.setQuantity(3);
        cartService.setItemQuantity(username, product.getId(), variantA.getId(), update);
        CartResponse cart = cartService.removeItem(username, product.getId(), variantB.getId());

        Assertions.assertEquals(1, cart.items().size());
        Assertions.assertEquals(3, cart.totalQuantity());
        var remaining = cart.items().get(0);
        Assertions.assertEquals(variantA.getId(), remaining.variantId());
        Assertions.assertEquals(3, remaining.quantity());
    }

    @Test
    void setQuantityWithoutVariantWhenMultipleLinesShouldThrow() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String username = "cart_guard_" + suffix;
        createdUsername = username;

        userRepository.save(newCustomer(username, "0907000003"));

        Product product = new Product();
        product.setName("Cart guard product " + suffix);
        product.setPrice(6000000D);
        product.setDiscountPercent(0D);
        product.setStock(20);
        product.setDescription("cart guard test");
        product = productRepository.save(product);
        createdProductId = product.getId();
        final Long productId = product.getId();

        ProductVariant variantA = saveVariant(product, "64GB", "CG-" + suffix + "-A", 6000000D, 7, 0);
        ProductVariant variantB = saveVariant(product, "128GB", "CG-" + suffix + "-B", 7000000D, 7, 1);

        AddCartItemRequest addA = new AddCartItemRequest();
        addA.setProductId(productId);
        addA.setVariantId(variantA.getId());
        addA.setQuantity(1);
        cartService.addItem(username, addA);

        AddCartItemRequest addB = new AddCartItemRequest();
        addB.setProductId(productId);
        addB.setVariantId(variantB.getId());
        addB.setQuantity(1);
        cartService.addItem(username, addB);

        UpdateCartQuantityRequest update = new UpdateCartQuantityRequest();
        update.setQuantity(2);

        IllegalArgumentException ex = Assertions.assertThrows(
                IllegalArgumentException.class,
                () -> cartService.setItemQuantity(username, productId, null, update)
        );
        Assertions.assertTrue(ex.getMessage().contains("chon bien the"));
    }

    @Test
    void addWithoutVariantShouldAutoSelectFirstInStockVariant() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String username = "cart_autovariant_" + suffix;
        createdUsername = username;

        userRepository.save(newCustomer(username, "0907000004"));

        Product product = new Product();
        product.setName("Cart auto variant product " + suffix);
        product.setPrice(9000000D);
        product.setDiscountPercent(5D);
        product.setStock(15);
        product.setDescription("cart auto variant test");
        product = productRepository.save(product);
        createdProductId = product.getId();

        saveVariant(product, "Base", "CA-" + suffix + "-A", 8800000D, 0, 0);
        ProductVariant inStockVariant = saveVariant(product, "Pro", "CA-" + suffix + "-B", 9800000D, 4, 1);

        AddCartItemRequest add = new AddCartItemRequest();
        add.setProductId(product.getId());
        add.setQuantity(1);
        add.setVariantId(null);

        CartResponse cart = cartService.addItem(username, add);

        Assertions.assertEquals(1, cart.items().size());
        var line = cart.items().get(0);
        Assertions.assertEquals(inStockVariant.getId(), line.variantId());
        Assertions.assertEquals("Pro", line.variantName());
        Assertions.assertEquals(1, line.quantity());
        Assertions.assertEquals(9310000D, line.price());
    }

    private User newCustomer(String username, String phone) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(username + "@mail.local");
        user.setPassword("$2a$10$4g6jDI3I8ULfIGQkPj2QseHirIXL50DJBSSTXobHxPPH/FkOFjH6W");
        user.setRole(Role.CUSTOMER);
        user.setPhone(phone);
        user.setAddress("123 Test Street");
        return user;
    }

    private ProductVariant saveVariant(
            Product product,
            String name,
            String sku,
            double price,
            int stock,
            int sortOrder
    ) {
        ProductVariant variant = new ProductVariant();
        variant.setProduct(product);
        variant.setName(name);
        variant.setSku(sku);
        variant.setPrice(price);
        variant.setStock(stock);
        variant.setSortOrder(sortOrder);
        return productVariantRepository.save(variant);
    }
}

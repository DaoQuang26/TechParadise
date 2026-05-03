package com.techstore1.techstore1.service;

import com.techstore1.techstore1.dto.AddCartItemRequest;
import com.techstore1.techstore1.dto.CartItemResponse;
import com.techstore1.techstore1.dto.CartResponse;
import com.techstore1.techstore1.dto.UpdateCartQuantityRequest;
import com.techstore1.techstore1.entity.CartItem;
import com.techstore1.techstore1.entity.Product;
import com.techstore1.techstore1.entity.ProductVariant;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.repository.CartItemRepository;
import com.techstore1.techstore1.repository.ProductRepository;
import com.techstore1.techstore1.repository.ProductVariantRepository;
import com.techstore1.techstore1.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CartService {

    private static final long BASE_VARIANT_KEY = 0L;

    private final CartItemRepository cartItemRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final ProductPricingService productPricingService;

    public CartService(
            CartItemRepository cartItemRepository,
            UserRepository userRepository,
            ProductRepository productRepository,
            ProductVariantRepository productVariantRepository,
            ProductPricingService productPricingService
    ) {
        this.cartItemRepository = cartItemRepository;
        this.userRepository = userRepository;
        this.productRepository = productRepository;
        this.productVariantRepository = productVariantRepository;
        this.productPricingService = productPricingService;
    }

    @Transactional
    public CartResponse getCart(String username) {
        User user = findUserByUsername(username);
        return buildCart(user.getId());
    }

    @Transactional
    public CartResponse addItem(String username, AddCartItemRequest request) {
        if (request == null || request.getProductId() == null) {
            throw new IllegalArgumentException("Yêu cầu giỏ hàng không hợp lệ");
        }

        User user = findUserByUsername(username);
        Product product = findProductById(request.getProductId());
        ResolvedCartVariant resolvedVariant = resolveCartVariant(product, request.getVariantId(), true);

        int addQuantity = request.getQuantity() == null ? 1 : request.getQuantity();
        CartItem cartItem = cartItemRepository
                .findByUserIdAndProductIdAndProductVariantId(
                        user.getId(),
                        product.getId(),
                        resolvedVariant.variantKey()
                )
                .orElseGet(() -> {
                    CartItem item = new CartItem();
                    item.setUser(user);
                    item.setProduct(product);
                    item.setProductVariantId(resolvedVariant.variantKey());
                    item.setQuantity(0);
                    return item;
                });

        int nextQuantity = (cartItem.getQuantity() == null ? 0 : cartItem.getQuantity()) + addQuantity;
        validateQuantity(resolvedVariant.availableStock(), nextQuantity);

        cartItem.setProductVariantId(resolvedVariant.variantKey());
        cartItem.setQuantity(nextQuantity);
        cartItemRepository.save(cartItem);

        return buildCart(user.getId());
    }

    @Transactional
    public CartResponse setItemQuantity(
            String username,
            Long productId,
            Long variantId,
            UpdateCartQuantityRequest request
    ) {
        User user = findUserByUsername(username);
        Product product = findProductById(productId);
        CartItem cartItem = findCartItemForMutation(user.getId(), productId, variantId);
        ResolvedCartVariant resolvedVariant = resolveVariantForExistingCartLine(product, cartItem.getProductVariantId());

        int quantity = request.getQuantity() == null ? 1 : request.getQuantity();
        validateQuantity(resolvedVariant.availableStock(), quantity);

        cartItem.setProductVariantId(resolvedVariant.variantKey());
        cartItem.setQuantity(quantity);
        cartItemRepository.save(cartItem);

        return buildCart(user.getId());
    }

    @Transactional
    public CartResponse removeItem(String username, Long productId, Long variantId) {
        User user = findUserByUsername(username);
        CartItem cartItem = findCartItemForMutation(user.getId(), productId, variantId);
        cartItemRepository.delete(cartItem);
        return buildCart(user.getId());
    }

    @Transactional
    public CartResponse clearCart(String username) {
        User user = findUserByUsername(username);
        cartItemRepository.deleteByUserId(user.getId());
        return buildCart(user.getId());
    }

    private CartResponse buildCart(Long userId) {
        List<CartItem> items = cartItemRepository.findByUserIdOrderByUpdatedAtDesc(userId);
        Set<Long> variantIds = items.stream()
                .map(CartItem::getProductVariantId)
                .filter(Objects::nonNull)
                .map(this::normalizeVariantKey)
                .filter(variantId -> variantId > BASE_VARIANT_KEY)
                .collect(Collectors.toSet());
        Map<Long, ProductVariant> variantById = productVariantRepository.findAllById(variantIds)
                .stream()
                .collect(Collectors.toMap(ProductVariant::getId, Function.identity()));

        List<CartItemResponse> lines = items.stream()
                .map(item -> toCartItemResponse(item, variantById))
                .toList();

        int totalQuantity = lines.stream().mapToInt(line -> line.quantity() == null ? 0 : line.quantity()).sum();
        double subtotal = lines.stream().mapToDouble(line -> line.lineTotal() == null ? 0D : line.lineTotal()).sum();

        return new CartResponse(lines, totalQuantity, subtotal);
    }

    private CartItemResponse toCartItemResponse(CartItem item, Map<Long, ProductVariant> variantById) {
        Product product = item.getProduct();
        int quantity = item.getQuantity() == null ? 0 : item.getQuantity();
        long variantKey = normalizeVariantKey(item.getProductVariantId());

        ProductVariant variant = variantKey <= BASE_VARIANT_KEY ? null : variantById.get(variantKey);
        boolean validVariant = variant != null
                && variant.getProduct() != null
                && Objects.equals(variant.getProduct().getId(), product.getId());

        String variantName = null;
        String displayName = product.getName();
        String imageUrl = product.getImageUrl();
        int availableStock = product.getStock() == null ? 0 : product.getStock();
        double originalPrice = productPricingService.normalizePrice(product.getPrice());

        if (validVariant) {
            variantName = safeText(variant.getName());
            if (variant.getImageUrl() != null && !variant.getImageUrl().isBlank()) {
                imageUrl = variant.getImageUrl();
            }
            availableStock = variant.getStock() == null ? 0 : variant.getStock();
            if (variant.getPrice() != null && variant.getPrice() >= 0D) {
                originalPrice = productPricingService.normalizePrice(variant.getPrice());
            }
        } else if (variantKey > BASE_VARIANT_KEY) {
            variantName = "Biến thể đã thay đổi";
        }

        if (variantName != null && !variantName.isBlank()) {
            displayName = product.getName() + " (" + variantName + ")";
        }

        double discountPercent = productPricingService.normalizeDiscountPercent(product.getDiscountPercent());
        double unitPrice = productPricingService.calculateDiscountedPrice(originalPrice, discountPercent);
        double lineTotal = unitPrice * quantity;

        return new CartItemResponse(
                product.getId(),
                displayName,
                variantKey > BASE_VARIANT_KEY ? variantKey : null,
                variantName,
                imageUrl,
                originalPrice,
                discountPercent,
                unitPrice,
                availableStock,
                quantity,
                lineTotal
        );
    }

    private CartItem findCartItemForMutation(Long userId, Long productId, Long variantId) {
        long normalizedVariantId = normalizeVariantKey(variantId);
        if (normalizedVariantId > BASE_VARIANT_KEY) {
            return cartItemRepository
                    .findByUserIdAndProductIdAndProductVariantId(userId, productId, normalizedVariantId)
                    .orElseThrow(() -> new IllegalArgumentException("Sản phẩm không có trong giỏ hàng"));
        }

        List<CartItem> productLines = cartItemRepository.findByUserIdAndProductIdOrderByUpdatedAtDesc(userId, productId);
        if (productLines.isEmpty()) {
            throw new IllegalArgumentException("Sản phẩm không có trong giỏ hàng");
        }
        if (productLines.size() == 1) {
            return productLines.get(0);
        }

        return productLines.stream()
                .filter(line -> normalizeVariantKey(line.getProductVariantId()) == BASE_VARIANT_KEY)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Vui lòng chọn biến thể cần cập nhật"));
    }

    private ResolvedCartVariant resolveCartVariant(Product product, Long requestedVariantId, boolean allowAutoSelect) {
        List<ProductVariant> variants = productVariantRepository.findByProductIdOrderBySortOrderAscIdAsc(product.getId());
        if (variants.isEmpty()) {
            return new ResolvedCartVariant(
                    BASE_VARIANT_KEY,
                    null,
                    product.getStock() == null ? 0 : product.getStock(),
                    productPricingService.normalizePrice(product.getPrice())
            );
        }

        long normalizedVariantId = normalizeVariantKey(requestedVariantId);
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

        return new ResolvedCartVariant(
                normalizeVariantKey(selected.getId()),
                safeText(selected.getName()),
                selected.getStock() == null ? 0 : selected.getStock(),
                normalizeVariantPriceOrFallback(product, selected)
        );
    }

    private ResolvedCartVariant resolveVariantForExistingCartLine(Product product, Long variantId) {
        long normalizedVariantId = normalizeVariantKey(variantId);
        if (normalizedVariantId <= BASE_VARIANT_KEY) {
            return new ResolvedCartVariant(
                    BASE_VARIANT_KEY,
                    null,
                    product.getStock() == null ? 0 : product.getStock(),
                    productPricingService.normalizePrice(product.getPrice())
            );
        }

        ProductVariant selected = productVariantRepository.findByIdAndProductId(normalizedVariantId, product.getId())
                .orElseThrow(() -> new IllegalArgumentException("Biến thể đã thay đổi, vui lòng cập nhật giỏ hàng"));
        return new ResolvedCartVariant(
                normalizedVariantId,
                safeText(selected.getName()),
                selected.getStock() == null ? 0 : selected.getStock(),
                normalizeVariantPriceOrFallback(product, selected)
        );
    }

    private double normalizeVariantPriceOrFallback(Product product, ProductVariant variant) {
        if (variant != null && variant.getPrice() != null && variant.getPrice() >= 0D) {
            return productPricingService.normalizePrice(variant.getPrice());
        }
        return productPricingService.normalizePrice(product.getPrice());
    }

    private User findUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản"));
    }

    private Product findProductById(Long productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy sản phẩm"));
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

    private void validateQuantity(int stock, int quantity) {
        if (quantity < 1) {
            throw new IllegalArgumentException("Số lượng phải lớn hơn 0");
        }
        if (stock <= 0) {
            throw new IllegalArgumentException("Sản phẩm đang hết hàng");
        }
        if (quantity > stock) {
            throw new IllegalArgumentException("Số lượng vượt quá tồn kho hiện tại");
        }
    }

    private record ResolvedCartVariant(
            long variantKey,
            String variantName,
            int availableStock,
            double basePrice
    ) {
    }
}

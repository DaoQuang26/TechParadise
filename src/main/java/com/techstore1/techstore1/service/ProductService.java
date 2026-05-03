package com.techstore1.techstore1.service;

import com.techstore1.techstore1.entity.Category;
import com.techstore1.techstore1.entity.Product;
import com.techstore1.techstore1.repository.CartItemRepository;
import com.techstore1.techstore1.repository.CategoryRepository;
import com.techstore1.techstore1.repository.OrderItemRepository;
import com.techstore1.techstore1.repository.ProductRepository;
import com.techstore1.techstore1.repository.ProductReviewRepository;
import com.techstore1.techstore1.repository.ProductVariantRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
// tac dung code: nghiep vu san pham cho storefront/admin va validation du lieu truoc khi luu DB.
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final OrderItemRepository orderItemRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductVariantRepository productVariantRepository;
    private final ProductReviewRepository productReviewRepository;
    private final ProductPricingService productPricingService;

    public ProductService(
            ProductRepository productRepository,
            CategoryRepository categoryRepository,
            OrderItemRepository orderItemRepository,
            CartItemRepository cartItemRepository,
            ProductVariantRepository productVariantRepository,
            ProductReviewRepository productReviewRepository,
            ProductPricingService productPricingService
    ) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.orderItemRepository = orderItemRepository;
        this.cartItemRepository = cartItemRepository;
        this.productVariantRepository = productVariantRepository;
        this.productReviewRepository = productReviewRepository;
        this.productPricingService = productPricingService;
    }

    public List<Product> getPublicProducts(String keyword, Long categoryId) {
        String kw = keyword == null ? "" : keyword.trim();

        List<Product> products;
        if (!kw.isBlank() && categoryId != null) {
            products = productRepository.findByCategoryIdAndNameContainingIgnoreCase(categoryId, kw);
        } else if (!kw.isBlank()) {
            products = productRepository.findByNameContainingIgnoreCase(kw);
        } else if (categoryId != null) {
            products = productRepository.findByCategoryId(categoryId);
        } else {
            products = productRepository.findAll();
        }

        // Sắp xếp mới nhất trước để storefront luôn "động" như site thương mại điện tử thật.
        products.sort(Comparator.comparing(Product::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed());
        enrichPublicRatingData(products);
        return products;
    }

    public Page<Product> getPublicProductsPaged(String keyword, Long categoryId, int page, int size) {
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        if (normalizedKeyword.isBlank()) {
            normalizedKeyword = null;
        }

        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(60, size));

        // Sort newest first so customers always see fresh products first.
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Product> pageResult = productRepository.searchPublicProducts(normalizedKeyword, categoryId, pageable);
        enrichPublicRatingData(pageResult.getContent());
        return pageResult;
    }

    public Page<Product> getAdminProductsPaged(String keyword, int page, int size) {
        return getAdminProductsPaged(keyword, null, page, size, "asc");
    }

    public Page<Product> getAdminProductsPaged(String keyword, int page, int size, String sortDir) {
        return getAdminProductsPaged(keyword, null, page, size, sortDir);
    }

    public Page<Product> getAdminProductsPaged(String keyword, Long categoryId, int page, int size, String sortDir) {
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        if (normalizedKeyword.isBlank()) {
            normalizedKeyword = null;
        }

        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(60, size));
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;

        // Admin list sorts by product id to make operation/auditing easier.
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(direction, "id"));
        return productRepository.searchPublicProducts(normalizedKeyword, categoryId, pageable);
    }

    public Product getProductById(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy sản phẩm"));
        enrichPublicRatingData(List.of(product));
        return product;
    }

    public Product createProduct(Product product) {
        validateProductPayload(product);
        // Always let DB auto-increment generate id (starts from >= 1).
        product.setId(null);
        Category category = validateCategory(product.getCategory() == null ? null : product.getCategory().getId());
        product.setCategory(category);
        if (product.getCreatedAt() == null) {
            product.setCreatedAt(LocalDateTime.now());
        }
        return productRepository.save(product);
    }

    public Product updateProduct(Long id, Product request) {
        validateProductPayload(request);
        Product existing = getProductById(id);
        existing.setName(request.getName());
        existing.setDescription(request.getDescription());
        existing.setPrice(request.getPrice());
        existing.setDiscountPercent(request.getDiscountPercent());
        existing.setStock(request.getStock());
        existing.setImageUrl(request.getImageUrl());
        existing.setGalleryImages(request.getGalleryImages());
        existing.setQuickSpecs(request.getQuickSpecs());
        existing.setDetailSpecs(request.getDetailSpecs());
        existing.setCpu(request.getCpu());
        existing.setRam(request.getRam());
        existing.setStorage(request.getStorage());
        existing.setGpu(request.getGpu());
        existing.setScreen(request.getScreen());
        existing.setBattery(request.getBattery());
        existing.setCamera(request.getCamera());
        existing.setOperatingSystem(request.getOperatingSystem());

        Long categoryId = request.getCategory() == null ? null : request.getCategory().getId();
        existing.setCategory(validateCategory(categoryId));

        return productRepository.save(existing);
    }

    @Transactional
    public void deleteProduct(Long id) {
        if (!productRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy sản phẩm");
        }

        long orderedCount = orderItemRepository.countByProductId(id);
        if (orderedCount > 0) {
            throw new IllegalArgumentException("Không thể xóa sản phẩm vì sản phẩm đã phát sinh trong đơn hàng");
        }

        // Dọn các dòng giỏ hàng còn tham chiếu sản phẩm trước khi xóa.
        cartItemRepository.deleteByProductId(id);
        productVariantRepository.deleteByProductId(id);
        productReviewRepository.deleteByProductId(id);
        productRepository.deleteById(id);
    }

    private Category validateCategory(Long categoryId) {
        if (categoryId == null) {
            throw new IllegalArgumentException("Vui lòng chọn danh mục");
        }

        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy danh mục"));
    }

    private void validateProductPayload(Product product) {
        if (product == null) {
            throw new IllegalArgumentException("Dữ liệu sản phẩm không hợp lệ");
        }

        String name = product.getName() == null ? "" : product.getName().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("Tên sản phẩm không được để trống");
        }
        if (name.length() > 160) {
            throw new IllegalArgumentException("Tên sản phẩm quá dài (tối đa 160 ký tự)");
        }

        Double price = product.getPrice();
        if (price == null || !Double.isFinite(price) || price < 0) {
            throw new IllegalArgumentException("Giá sản phẩm không hợp lệ");
        }
        product.setPrice(productPricingService.normalizePrice(price));

        Double discountPercent = product.getDiscountPercent();
        if (discountPercent == null) {
            discountPercent = 0D;
        }
        if (!Double.isFinite(discountPercent) || discountPercent < 0D || discountPercent > 100D) {
            throw new IllegalArgumentException("Phần trăm khuyến mãi phải trong khoảng 0-100");
        }
        product.setDiscountPercent(productPricingService.normalizeDiscountPercent(discountPercent));

        Integer stock = product.getStock();
        if (stock == null || stock < 0) {
            throw new IllegalArgumentException("Tồn kho không hợp lệ");
        }

        // Normalize data trước khi save.
        product.setName(name);

        String imageUrl = product.getImageUrl() == null ? "" : product.getImageUrl().trim();
        validateImageUrlIfPresent(imageUrl);

        String galleryImages = normalizeMultiLine(product.getGalleryImages(), 4000);
        List<String> gallery = normalizeGalleryUrls(galleryImages);

        // Nếu chưa có ảnh đại diện thì ưu tiên lấy ảnh đầu tiên trong gallery.
        if (imageUrl.isBlank() && !gallery.isEmpty()) {
            imageUrl = gallery.get(0);
        }

        // Đảm bảo ảnh đại diện luôn nằm trong gallery để frontend render thống nhất.
        if (!imageUrl.isBlank()) {
            final String coverImage = imageUrl;
            gallery.removeIf(url -> url.equalsIgnoreCase(coverImage));
            gallery.add(0, coverImage);
        }

        product.setImageUrl(imageUrl.isBlank() ? null : imageUrl);
        product.setGalleryImages(gallery.isEmpty() ? null : String.join("\n", gallery));

        String description = normalizeMultiLine(product.getDescription(), 8000);
        product.setDescription(description.isBlank() ? null : description);

        String cpu = normalizeSingleLine(product.getCpu(), 180, "CPU");
        String ram = normalizeSingleLine(product.getRam(), 120, "RAM");
        String storage = normalizeSingleLine(product.getStorage(), 120, "Bộ nhớ");
        String gpu = normalizeSingleLine(product.getGpu(), 180, "Card đồ hoạ");
        String screen = normalizeSingleLine(product.getScreen(), 180, "Màn hình");
        String battery = normalizeSingleLine(product.getBattery(), 180, "Pin");
        String camera = normalizeSingleLine(product.getCamera(), 180, "Camera");
        String operatingSystem = normalizeSingleLine(product.getOperatingSystem(), 120, "Hệ điều hành");

        product.setCpu(cpu.isBlank() ? null : cpu);
        product.setRam(ram.isBlank() ? null : ram);
        product.setStorage(storage.isBlank() ? null : storage);
        product.setGpu(gpu.isBlank() ? null : gpu);
        product.setScreen(screen.isBlank() ? null : screen);
        product.setBattery(battery.isBlank() ? null : battery);
        product.setCamera(camera.isBlank() ? null : camera);
        product.setOperatingSystem(operatingSystem.isBlank() ? null : operatingSystem);

        String quickSpecsInput = normalizeMultiLine(product.getQuickSpecs(), 1000);
        List<String> generatedQuickSpecs = buildDefaultQuickSpecs(product);
        String quickSpecs = generatedQuickSpecs.isEmpty()
                ? quickSpecsInput
                : String.join("\n", generatedQuickSpecs);
        quickSpecs = normalizeMultiLine(quickSpecs, 1000);
        product.setQuickSpecs(quickSpecs.isBlank() ? null : quickSpecs);

        String detailSpecsInput = normalizeMultiLine(product.getDetailSpecs(), 6000);
        List<String> generatedDetailSpecs = buildDefaultDetailSpecs(product);
        String detailSpecs = mergeDefaultAndCustomDetailSpecs(generatedDetailSpecs, detailSpecsInput);
        detailSpecs = normalizeMultiLine(detailSpecs, 6000);
        product.setDetailSpecs(detailSpecs.isBlank() ? null : detailSpecs);
    }

    private void validateImageUrlIfPresent(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return;
        }

        if (!(imageUrl.startsWith("http://")
                || imageUrl.startsWith("https://")
                || imageUrl.startsWith("/uploads/"))) {
            throw new IllegalArgumentException("URL ảnh phải bắt đầu bằng http://, https:// hoặc /uploads/");
        }
    }

    private List<String> normalizeGalleryUrls(String raw) {
        if (raw == null || raw.isBlank()) {
            return new ArrayList<>();
        }

        Set<String> unique = new LinkedHashSet<>();
        String[] lines = raw.split("\\r?\\n");
        for (String line : lines) {
            String url = line == null ? "" : line.trim();
            if (url.isBlank()) {
                continue;
            }
            validateImageUrlIfPresent(url);
            unique.add(url);
        }

        if (unique.size() > 12) {
            throw new IllegalArgumentException("Tối đa 12 ảnh cho một sản phẩm");
        }

        return new ArrayList<>(unique);
    }

    private String normalizeMultiLine(String raw, int maxLength) {
        String text = raw == null ? "" : raw.trim();
        if (text.isBlank()) {
            return "";
        }
        if (text.length() > maxLength) {
            throw new IllegalArgumentException("Nội dung nhập quá dài");
        }
        return text;
    }

    private String normalizeSingleLine(String raw, int maxLength, String fieldName) {
        String text = raw == null ? "" : raw.trim();
        if (text.isBlank()) {
            return "";
        }
        if (text.length() > maxLength) {
            throw new IllegalArgumentException(fieldName + " qua dai");
        }
        return text;
    }

    private List<String> buildDefaultQuickSpecs(Product product) {
        List<String> specs = new ArrayList<>();
        appendSpecLine(specs, "CPU", product.getCpu());
        appendSpecLine(specs, "RAM", product.getRam());
        appendSpecLine(specs, "Bộ nhớ", product.getStorage());
        appendSpecLine(specs, "Màn hình", product.getScreen());
        appendSpecLine(specs, "Card đồ hoạ", product.getGpu());
        appendSpecLine(specs, "Pin", product.getBattery());
        appendSpecLine(specs, "Hệ điều hành", product.getOperatingSystem());
        appendSpecLine(specs, "Camera", product.getCamera());

        if (specs.size() > 6) {
            return new ArrayList<>(specs.subList(0, 6));
        }
        return specs;
    }

    private List<String> buildDefaultDetailSpecs(Product product) {
        List<String> specs = new ArrayList<>();
        appendSpecLine(specs, "CPU", product.getCpu());
        appendSpecLine(specs, "RAM", product.getRam());
        appendSpecLine(specs, "Bộ nhớ", product.getStorage());
        appendSpecLine(specs, "Màn hình", product.getScreen());
        appendSpecLine(specs, "Card đồ hoạ", product.getGpu());
        appendSpecLine(specs, "Pin", product.getBattery());
        appendSpecLine(specs, "Camera", product.getCamera());
        appendSpecLine(specs, "Hệ điều hành", product.getOperatingSystem());
        return specs;
    }

    private String mergeDefaultAndCustomDetailSpecs(List<String> defaultSpecs, String customSpecsText) {
        Map<String, String> merged = new LinkedHashMap<>();
        List<String> extras = new ArrayList<>();

        if (defaultSpecs != null) {
            for (String line : defaultSpecs) {
                upsertDetailSpecLine(merged, line);
            }
        }

        if (customSpecsText != null && !customSpecsText.isBlank()) {
            String[] lines = customSpecsText.split("\\r?\\n");
            for (String line : lines) {
                String clean = line == null ? "" : line.trim();
                if (clean.isBlank()) {
                    continue;
                }

                if (clean.contains(":")) {
                    upsertDetailSpecLine(merged, clean);
                    continue;
                }

                extras.add(clean);
            }
        }

        List<String> out = new ArrayList<>(merged.values());
        out.addAll(extras);
        return String.join("\n", out);
    }

    private void upsertDetailSpecLine(Map<String, String> merged, String line) {
        if (merged == null || line == null) {
            return;
        }

        String clean = line.trim();
        if (clean.isBlank()) {
            return;
        }

        int idx = clean.indexOf(':');
        if (idx <= 0) {
            return;
        }

        String label = clean.substring(0, idx).trim();
        String value = clean.substring(idx + 1).trim();
        if (label.isBlank() || value.isBlank()) {
            return;
        }

        merged.put(normalizeSpecLabel(label), label + ": " + value);
    }

    private String normalizeSpecLabel(String label) {
        String raw = label == null ? "" : label.trim();
        if (raw.isBlank()) {
            return "";
        }

        String noAccent = Normalizer.normalize(raw, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        String normalized = noAccent.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        if ("cpuchip".equals(normalized)) {
            return "cpu";
        }
        if ("gpu".equals(normalized) || "cardmanhinh".equals(normalized)) {
            return "carddohoa";
        }
        if ("ocung".equals(normalized) || "luutru".equals(normalized) || "storage".equals(normalized)) {
            return "bonho";
        }
        return normalized;
    }

    private void appendSpecLine(List<String> specs, String label, String value) {
        String cleanValue = value == null ? "" : value.trim();
        if (cleanValue.isBlank()) {
            return;
        }
        specs.add(label + ": " + cleanValue);
    }

    private void enrichPublicRatingData(List<Product> products) {
        if (products == null || products.isEmpty()) {
            return;
        }

        List<Long> productIds = products.stream()
                .map(Product::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (productIds.isEmpty()) {
            products.forEach(product -> {
                product.setAverageRating(0D);
                product.setTotalReviews(0L);
            });
            return;
        }

        Map<Long, ProductReviewRepository.ProductRatingAggregate> summaryByProductId =
                productReviewRepository.summarizeRatingsByProductIds(productIds).stream()
                        .collect(Collectors.toMap(
                                ProductReviewRepository.ProductRatingAggregate::getProductId,
                                Function.identity()
                        ));

        for (Product product : products) {
            ProductReviewRepository.ProductRatingAggregate summary = summaryByProductId.get(product.getId());
            if (summary == null) {
                product.setAverageRating(0D);
                product.setTotalReviews(0L);
                continue;
            }

            double average = summary.getAverageRating() == null ? 0D : summary.getAverageRating();
            long totalReviews = summary.getTotalReviews() == null ? 0L : summary.getTotalReviews();

            double normalizedAverage = Math.max(0D, Math.min(5D, average));
            product.setAverageRating(Math.round(normalizedAverage * 10D) / 10D);
            product.setTotalReviews(Math.max(0L, totalReviews));
        }
    }
}

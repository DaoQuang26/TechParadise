package com.techstore1.techstore1.service;

import com.techstore1.techstore1.dto.ProductVariantRequest;
import com.techstore1.techstore1.dto.ProductVariantResponse;
import com.techstore1.techstore1.entity.Product;
import com.techstore1.techstore1.entity.ProductVariant;
import com.techstore1.techstore1.repository.ProductRepository;
import com.techstore1.techstore1.repository.ProductVariantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
// tac dung code: xu ly nghiep vu bien the san pham de admin quan ly va storefront hien thi theo cau hinh.
public class ProductVariantService {

    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;

    public ProductVariantService(
            ProductRepository productRepository,
            ProductVariantRepository productVariantRepository
    ) {
        this.productRepository = productRepository;
        this.productVariantRepository = productVariantRepository;
    }

    @Transactional(readOnly = true)
    public List<ProductVariantResponse> getByProductId(Long productId) {
        ensureProductExists(productId);
        return productVariantRepository.findByProductIdOrderBySortOrderAscIdAsc(productId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public List<ProductVariantResponse> replaceProductVariants(Long productId, List<ProductVariantRequest> requests) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Khong tim thay san pham"));

        List<ProductVariantRequest> source = requests == null ? List.of() : requests;
        if (source.size() > 50) {
            throw new IllegalArgumentException("Toi da 50 bien the cho mot san pham");
        }

        List<ProductVariant> nextVariants = new ArrayList<>();
        int index = 0;
        for (ProductVariantRequest request : source) {
            if (request == null) {
                continue;
            }

            ProductVariant variant = new ProductVariant();
            variant.setProduct(product);
            variant.setName(normalizeRequired(request.getName(), "Ten bien the khong duoc de trong", 180));
            variant.setSku(normalizeOptional(request.getSku(), 80));
            variant.setPrice(normalizePrice(request.getPrice()));
            variant.setStock(normalizeStock(request.getStock()));
            variant.setImageUrl(normalizeImageUrl(request.getImageUrl()));
            variant.setSortOrder(request.getSortOrder() == null ? index : request.getSortOrder());
            nextVariants.add(variant);
            index++;
        }

        // Xoa-ghi lai theo danh sach moi de frontend admin co the sua nhanh bang 1 lan luu.
        productVariantRepository.deleteByProductId(productId);

        if (!nextVariants.isEmpty()) {
            productVariantRepository.saveAll(nextVariants);
        }

        // Dong bo gia/ton kho goc theo bien the de danh sach san pham hien thi hop ly.
        if (!nextVariants.isEmpty()) {
            nextVariants.sort(Comparator.comparing(ProductVariant::getPrice));
            ProductVariant cheapest = nextVariants.get(0);

            int totalStock = nextVariants.stream()
                    .map(ProductVariant::getStock)
                    .mapToInt(value -> value == null ? 0 : value)
                    .sum();

            product.setPrice(cheapest.getPrice());
            product.setStock(totalStock);

            if ((product.getImageUrl() == null || product.getImageUrl().isBlank())
                    && cheapest.getImageUrl() != null && !cheapest.getImageUrl().isBlank()) {
                product.setImageUrl(cheapest.getImageUrl());
            }
            productRepository.save(product);
        }

        return productVariantRepository.findByProductIdOrderBySortOrderAscIdAsc(productId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void deleteByProductId(Long productId) {
        productVariantRepository.deleteByProductId(productId);
    }

    private void ensureProductExists(Long productId) {
        if (productId == null || !productRepository.existsById(productId)) {
            throw new IllegalArgumentException("Khong tim thay san pham");
        }
    }

    private ProductVariantResponse toResponse(ProductVariant variant) {
        return new ProductVariantResponse(
                variant.getId(),
                variant.getProduct() == null ? null : variant.getProduct().getId(),
                variant.getName(),
                variant.getSku(),
                variant.getPrice(),
                variant.getStock(),
                variant.getImageUrl(),
                variant.getSortOrder(),
                variant.getUpdatedAt()
        );
    }

    private String normalizeRequired(String value, String message, int maxLength) {
        String text = value == null ? "" : value.trim();
        if (text.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        if (text.length() > maxLength) {
            throw new IllegalArgumentException("Noi dung nhap qua dai");
        }
        return text;
    }

    private String normalizeOptional(String value, int maxLength) {
        String text = value == null ? "" : value.trim();
        if (text.isBlank()) {
            return null;
        }
        if (text.length() > maxLength) {
            throw new IllegalArgumentException("Noi dung nhap qua dai");
        }
        return text;
    }

    private Double normalizePrice(Double price) {
        if (price == null || price < 0) {
            throw new IllegalArgumentException("Gia bien the khong hop le");
        }
        return price;
    }

    private Integer normalizeStock(Integer stock) {
        if (stock == null || stock < 0) {
            throw new IllegalArgumentException("Ton kho bien the khong hop le");
        }
        return stock;
    }

    private String normalizeImageUrl(String rawImageUrl) {
        String imageUrl = normalizeOptional(rawImageUrl, 500);
        if (imageUrl == null) {
            return null;
        }
        if (!(imageUrl.startsWith("http://")
                || imageUrl.startsWith("https://")
                || imageUrl.startsWith("/uploads/"))) {
            throw new IllegalArgumentException("URL anh bien the phai bat dau bang http://, https:// hoac /uploads/");
        }
        return imageUrl;
    }
}


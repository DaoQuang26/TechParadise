package com.techstore1.techstore1.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Optimistic lock version to prevent lost updates/oversell in concurrent order flows.
    @Version
    private Long version;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Double price;

    // Product-level discount percent (0-100). Final selling price is computed from this field.
    private Double discountPercent;

    @Column(nullable = false)
    private Integer stock;

    private String imageUrl;

    // Danh sách ảnh phụ của sản phẩm, lưu dạng nhiều dòng (mỗi dòng 1 URL ảnh).
    @Column(columnDefinition = "TEXT")
    private String galleryImages;

    // Thông số nhanh để hiển thị ở danh sách sản phẩm, lưu nhiều dòng.
    @Column(length = 1000)
    private String quickSpecs;

    // Thông số chi tiết ở trang product detail, định dạng gợi ý: "Tên thông số: Giá trị" mỗi dòng.
    @Column(columnDefinition = "TEXT")
    private String detailSpecs;

    @Column(length = 180)
    private String cpu;

    @Column(length = 120)
    private String ram;

    @Column(length = 120)
    private String storage;

    @Column(length = 180)
    private String gpu;

    @Column(length = 180)
    private String screen;

    @Column(length = 180)
    private String battery;

    @Column(length = 180)
    private String camera;

    @Column(length = 120)
    private String operatingSystem;

    private LocalDateTime createdAt;

    @ManyToOne
    @JoinColumn(name = "category_id")
    private Category category;

    @Transient
    @JsonProperty(value = "averageRating", access = JsonProperty.Access.READ_ONLY)
    private Double averageRating;

    @Transient
    @JsonProperty(value = "totalReviews", access = JsonProperty.Access.READ_ONLY)
    private Long totalReviews;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (discountPercent == null) {
            discountPercent = 0D;
        }
    }

    @PreUpdate
    public void preUpdate() {
        if (discountPercent == null) {
            discountPercent = 0D;
        }
    }

    @Transient
    @JsonProperty(value = "finalPrice", access = JsonProperty.Access.READ_ONLY)
    public Double getFinalPrice() {
        double basePrice = price == null || price < 0D ? 0D : price;
        double percent = discountPercent == null ? 0D : Math.max(0D, Math.min(100D, discountPercent));
        if (percent <= 0D) {
            return basePrice;
        }
        return Math.max(0D, Math.round(basePrice * (100D - percent) / 100D));
    }

    @Transient
    @JsonProperty(value = "discountAmount", access = JsonProperty.Access.READ_ONLY)
    public Double getDiscountAmount() {
        double basePrice = price == null || price < 0D ? 0D : price;
        double finalPrice = getFinalPrice() == null ? basePrice : getFinalPrice();
        return Math.max(0D, basePrice - finalPrice);
    }
}

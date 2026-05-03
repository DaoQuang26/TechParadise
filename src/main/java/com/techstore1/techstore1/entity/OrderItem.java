package com.techstore1.techstore1.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "order_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private Double price;

    @ManyToOne
    @JoinColumn(name = "order_id")
    @JsonBackReference
    private Order order;

    @ManyToOne
    @JoinColumn(name = "product_id")
    private Product product;

    // 0 = base product (without variant), >0 = product_variants.id at order time.
    @Column(name = "product_variant_id", nullable = false, columnDefinition = "BIGINT NOT NULL DEFAULT 0")
    private Long productVariantId;

    // Snapshot variant display name so order history stays readable even if variants are edited/deleted later.
    @Column(name = "product_variant_name", length = 180)
    private String productVariantName;

    @PrePersist
    public void prePersist() {
        if (productVariantId == null || productVariantId < 0) {
            productVariantId = 0L;
        }
    }

    @PreUpdate
    public void preUpdate() {
        if (productVariantId == null || productVariantId < 0) {
            productVariantId = 0L;
        }
    }
}

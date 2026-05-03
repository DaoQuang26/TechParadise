package com.techstore1.techstore1.repository;

import com.techstore1.techstore1.entity.ProductVariant;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;
import java.util.Optional;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {

    List<ProductVariant> findByProductIdOrderBySortOrderAscIdAsc(Long productId);

    Optional<ProductVariant> findByIdAndProductId(Long id, Long productId);

    long countByProductId(Long productId);

    @Modifying
    @Transactional
    void deleteByProductId(Long productId);
}

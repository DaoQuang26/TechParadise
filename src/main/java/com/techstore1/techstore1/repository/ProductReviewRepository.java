package com.techstore1.techstore1.repository;

import com.techstore1.techstore1.entity.ProductReview;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface ProductReviewRepository extends JpaRepository<ProductReview, Long> {

    interface ProductRatingAggregate {
        Long getProductId();
        Double getAverageRating();
        Long getTotalReviews();
    }

    @EntityGraph(attributePaths = {"user"})
    List<ProductReview> findByProductIdOrderByCreatedAtDesc(Long productId);

    Optional<ProductReview> findByProductIdAndUserId(Long productId, Long userId);

    long countByProductId(Long productId);

    long countByProductIdAndRating(Long productId, Integer rating);

    @Query("""
            select coalesce(avg(r.rating), 0)
            from ProductReview r
            where r.product.id = :productId
            """)
    Double averageRatingByProductId(@Param("productId") Long productId);

    @Query("""
            select r.product.id as productId,
                   coalesce(avg(r.rating), 0) as averageRating,
                   count(r.id) as totalReviews
            from ProductReview r
            where r.product.id in :productIds
            group by r.product.id
            """)
    List<ProductRatingAggregate> summarizeRatingsByProductIds(@Param("productIds") List<Long> productIds);

    @Modifying
    @Transactional
    void deleteByProductId(Long productId);
}

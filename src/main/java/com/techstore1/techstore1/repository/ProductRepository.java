package com.techstore1.techstore1.repository;

import com.techstore1.techstore1.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findByNameContainingIgnoreCase(String keyword);

    List<Product> findByCategoryId(Long categoryId);

    List<Product> findByCategoryIdAndNameContainingIgnoreCase(Long categoryId, String keyword);

    long countByCategoryId(Long categoryId);

    @Query("""
            select p
            from Product p
            where (:categoryId is null or p.category.id = :categoryId)
              and (
                    :keyword is null
                    or lower(p.name) like lower(concat('%', :keyword, '%'))
                    or lower(coalesce(p.description, '')) like lower(concat('%', :keyword, '%'))
                  )
            """)
    Page<Product> searchPublicProducts(
            @Param("keyword") String keyword,
            @Param("categoryId") Long categoryId,
            Pageable pageable
    );
}

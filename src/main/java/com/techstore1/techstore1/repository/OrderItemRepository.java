package com.techstore1.techstore1.repository;

import com.techstore1.techstore1.entity.OrderItem;
import com.techstore1.techstore1.enums.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    long countByProductId(Long productId);

    @Query("""
            select count(oi) > 0
            from OrderItem oi
            where oi.product.id = :productId
              and oi.order.user.id = :userId
              and oi.order.status = :status
            """)
    boolean existsByUserAndProductAndOrderStatus(
            @Param("userId") Long userId,
            @Param("productId") Long productId,
            @Param("status") OrderStatus status
    );

}

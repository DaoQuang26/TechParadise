package com.techstore1.techstore1.repository;

import com.techstore1.techstore1.entity.OrderStatusHistory;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;

public interface OrderStatusHistoryRepository extends JpaRepository<OrderStatusHistory, Long> {

    List<OrderStatusHistory> findByOrderIdOrderByCreatedAtAsc(Long orderId);

    // tac dung code: xoa toan bo timeline truoc khi xoa don de tranh vi pham khoa ngoai order_id.
    @Modifying
    @Transactional
    void deleteByOrderId(Long orderId);
}

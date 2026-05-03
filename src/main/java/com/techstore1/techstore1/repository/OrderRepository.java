package com.techstore1.techstore1.repository;

import com.techstore1.techstore1.entity.Order;
import com.techstore1.techstore1.enums.OnlinePaymentStatus;
import com.techstore1.techstore1.enums.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByUserIdOrderByCreatedAtDesc(Long userId);

    long countByUserId(Long userId);

    long countByStatus(OrderStatus status);

    // tac dung code: lay don da giao trong khoang thoi gian de tinh bieu do doanh thu chi tiet.
    List<Order> findByStatusAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
            OrderStatus status,
            LocalDateTime from,
            LocalDateTime to
    );

    @Query("select coalesce(sum(o.totalPrice), 0) from Order o where o.status = com.techstore1.techstore1.enums.OrderStatus.DELIVERED")
    Double totalRevenueFromDeliveredOrders();

    @Query("""
            select distinct o
            from Order o
            left join fetch o.items i
            left join fetch i.product p
            where o.id = :id
            """)
    Optional<Order> findByIdWithItems(@Param("id") Long id);

    @Query("""
            select distinct o
            from Order o
            left join fetch o.items i
            left join fetch i.product p
            where o.id = :id and o.user.username = :username
            """)
    Optional<Order> findByIdWithItemsForUser(@Param("id") Long id, @Param("username") String username);

    // tac dung code: tim don hang theo ma tham chieu thanh toan de xu ly webhook.
    Optional<Order> findByPaymentReference(String paymentReference);

    @Query("""
            select o
            from Order o
            where (:orderStatus is null or o.status = :orderStatus)
              and (:orderId is null or o.id = :orderId)
              and (:onlinePaymentStatus is null or o.onlinePaymentStatus = :onlinePaymentStatus)
              and (:paymentProvider is null or lower(coalesce(o.paymentProvider, '')) = lower(:paymentProvider))
              and (
                    :keyword is null
                    or lower(o.user.username) like lower(concat('%', :keyword, '%'))
                    or str(o.id) like concat('%', :keyword, '%')
                    or lower(coalesce(o.paymentReference, '')) like lower(concat('%', :keyword, '%'))
                    or lower(coalesce(o.paymentProvider, '')) like lower(concat('%', :keyword, '%'))
                  )
            """)
    Page<Order> searchAdminOrders(
            @Param("orderStatus") OrderStatus orderStatus,
            @Param("orderId") Long orderId,
            @Param("onlinePaymentStatus") OnlinePaymentStatus onlinePaymentStatus,
            @Param("paymentProvider") String paymentProvider,
            @Param("keyword") String keyword,
            Pageable pageable
    );

    // tac dung code: query audit cac don dung thanh toan online co bo loc provider/status/keyword cho admin.
    @Query("""
            select o
            from Order o
            where o.paymentMethod in (
                    com.techstore1.techstore1.enums.PaymentMethod.ONLINE_GATEWAY,
                    com.techstore1.techstore1.enums.PaymentMethod.BANK_TRANSFER
                  )
              and (:provider is null or lower(coalesce(o.paymentProvider, '')) = lower(:provider))
              and (:onlineStatus is null or o.onlinePaymentStatus = :onlineStatus)
              and (
                    :keyword is null
                    or lower(o.user.username) like lower(concat('%', :keyword, '%'))
                    or str(o.id) like concat('%', :keyword, '%')
                    or lower(coalesce(o.paymentReference, '')) like lower(concat('%', :keyword, '%'))
                  )
            """)
    Page<Order> searchAdminPayments(
            @Param("provider") String provider,
            @Param("onlineStatus") OnlinePaymentStatus onlineStatus,
            @Param("keyword") String keyword,
            Pageable pageable
    );

    // tac dung code: lay cac don online het han giu hang (pending/cancel-requested) kem item+product de auto huy va hoan kho.
    @Query("""
            select distinct o
            from Order o
            left join fetch o.items i
            left join fetch i.product p
            where o.status in (
                    com.techstore1.techstore1.enums.OrderStatus.PENDING,
                    com.techstore1.techstore1.enums.OrderStatus.CANCEL_REQUESTED
                  )
              and o.paymentMethod in (
                    com.techstore1.techstore1.enums.PaymentMethod.ONLINE_GATEWAY,
                    com.techstore1.techstore1.enums.PaymentMethod.BANK_TRANSFER
                  )
              and o.onlinePaymentStatus = com.techstore1.techstore1.enums.OnlinePaymentStatus.PENDING
              and o.reservationExpiresAt is not null
              and o.reservationExpiresAt <= :now
            """)
    List<Order> findExpiredOnlineReservations(@Param("now") LocalDateTime now);

    // tac dung code: lay don online da FAILED nhung status don van pending/cancel-requested de dong bo lai trang thai.
    @Query("""
            select distinct o
            from Order o
            left join fetch o.items i
            left join fetch i.product p
            where o.status in (
                    com.techstore1.techstore1.enums.OrderStatus.PENDING,
                    com.techstore1.techstore1.enums.OrderStatus.CANCEL_REQUESTED
                  )
              and o.paymentMethod in (
                    com.techstore1.techstore1.enums.PaymentMethod.ONLINE_GATEWAY,
                    com.techstore1.techstore1.enums.PaymentMethod.BANK_TRANSFER
                  )
              and o.onlinePaymentStatus = com.techstore1.techstore1.enums.OnlinePaymentStatus.FAILED
            """)
    List<Order> findPendingFailedOnlineOrders();
}

package com.techstore1.techstore1.service;

import com.techstore1.techstore1.entity.Order;
import com.techstore1.techstore1.entity.OrderStatusHistory;
import com.techstore1.techstore1.enums.OrderStatus;
import com.techstore1.techstore1.repository.OrderStatusHistoryRepository;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.text.Normalizer;

@Service
// tac dung code: ghi timeline trang thai don hang an toan, khong de loi history lam rollback luong chinh.
public class OrderStatusHistoryService {

    private static final Logger log = LoggerFactory.getLogger(OrderStatusHistoryService.class);

    private final OrderStatusHistoryRepository orderStatusHistoryRepository;
    private final EntityManager entityManager;
    private final TransactionTemplate requiresNewTransaction;

    public OrderStatusHistoryService(
            OrderStatusHistoryRepository orderStatusHistoryRepository,
            EntityManager entityManager,
            PlatformTransactionManager transactionManager
    ) {
        this.orderStatusHistoryRepository = orderStatusHistoryRepository;
        this.entityManager = entityManager;
        this.requiresNewTransaction = new TransactionTemplate(transactionManager);
        this.requiresNewTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void saveHistorySafe(
            Order order,
            OrderStatus fromStatus,
            OrderStatus toStatus,
            String note,
            String changedBy
    ) {
        if (order == null || order.getId() == null || toStatus == null) {
            return;
        }

        // tac dung code: copy gia tri ra bien local de dung an toan trong callback afterCommit.
        Long orderId = order.getId();
        OrderStatus safeFromStatus = fromStatus == null ? toStatus : fromStatus;
        String safeNote = sanitizeForLegacyDatabase(note);
        String safeChangedBy = sanitizeForLegacyDatabase(changedBy);

        // tac dung code: neu dang trong transaction chinh thi ghi history sau khi commit de tranh lock FK.
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    persistInNewTransaction(orderId, safeFromStatus, toStatus, safeNote, safeChangedBy);
                }
            });
            return;
        }

        persistInNewTransaction(orderId, safeFromStatus, toStatus, safeNote, safeChangedBy);
    }

    private void persistInNewTransaction(
            Long orderId,
            OrderStatus fromStatus,
            OrderStatus toStatus,
            String note,
            String changedBy
    ) {
        try {
            requiresNewTransaction.executeWithoutResult((status) -> {
                OrderStatusHistory row = new OrderStatusHistory();
                // tac dung code: dung reference theo id de gan FK order ma khong can load full entity.
                row.setOrder(entityManager.getReference(Order.class, orderId));
                row.setFromStatus(fromStatus);
                row.setToStatus(toStatus);
                row.setNote(note);
                row.setChangedBy(changedBy);
                orderStatusHistoryRepository.saveAndFlush(row);
            });
        } catch (RuntimeException ex) {
            // tac dung code: neu bang history loi schema/collation/lock thi bo qua, khong chan checkout/payment.
            log.warn("Skip history row due to DB/schema issue: {}", ex.getMessage());
        }
    }

    private String sanitizeForLegacyDatabase(String value) {
        if (value == null || value.isBlank()) {
            return value;
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return normalized
                .replace("\u0111", "d")
                .replace("\u0110", "D");
    }
}

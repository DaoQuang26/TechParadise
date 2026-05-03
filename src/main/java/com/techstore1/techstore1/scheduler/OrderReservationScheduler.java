package com.techstore1.techstore1.scheduler;

import com.techstore1.techstore1.service.OrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
// tac dung code: scheduler quet dinh ky cac don online het han de tu dong huy va tra ton kho.
public class OrderReservationScheduler {

    private static final Logger logger = LoggerFactory.getLogger(OrderReservationScheduler.class);

    private final OrderService orderService;

    public OrderReservationScheduler(OrderService orderService) {
        this.orderService = orderService;
    }

    @Scheduled(
            fixedDelayString = "${app.order.reservation-expire-check-ms:60000}",
            initialDelayString = "${app.order.reservation-expire-check-initial-ms:15000}"
    )
    public void expireTimedOutReservations() {
        int expiredCount = orderService.expireOnlineReservations();
        if (expiredCount > 0) {
            logger.info("Auto expired {} online reservation order(s).", expiredCount);
        }
    }
}

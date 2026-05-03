package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.config.DataInitializer;
import com.techstore1.techstore1.dto.OrderDetailResponse;
import com.techstore1.techstore1.dto.MessageResponse;
import com.techstore1.techstore1.dto.PageResponse;
import com.techstore1.techstore1.dto.OrderSummaryResponse;
import com.techstore1.techstore1.enums.OnlinePaymentStatus;
import com.techstore1.techstore1.dto.UpdateOrderStatusRequest;
import com.techstore1.techstore1.enums.OrderStatus;
import com.techstore1.techstore1.service.AdminAuditLogService;
import com.techstore1.techstore1.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/orders")
public class AdminOrderController {

    private final OrderService orderService;
    private final AdminAuditLogService adminAuditLogService;
    private final DataInitializer dataInitializer;

    public AdminOrderController(
            OrderService orderService,
            AdminAuditLogService adminAuditLogService,
            DataInitializer dataInitializer
    ) {
        this.orderService = orderService;
        this.adminAuditLogService = adminAuditLogService;
        this.dataInitializer = dataInitializer;
    }

    @GetMapping
    public List<OrderSummaryResponse> findAll() {
        return orderService.findAllSummaries();
    }

    @GetMapping("/paged")
    public PageResponse<OrderSummaryResponse> findAllPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "asc") String sortDir,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long id,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) OnlinePaymentStatus paymentStatus,
            @RequestParam(required = false) String paymentProvider
    ) {
        // Return stable paging payload so frontend can paginate orders smoothly.
        return PageResponse.from(orderService.findAllSummariesPaged(
                page,
                size,
                sortDir,
                keyword,
                id,
                status,
                paymentStatus,
                paymentProvider
        ));
    }

    @GetMapping("/{id}")
    public OrderDetailResponse detail(@PathVariable Long id) {
        return orderService.getOrderDetailForAdmin(id);
    }

    @PostMapping("/seed-sample")
    public MessageResponse seedSampleOrders() {
        int created = dataInitializer.seedSampleOrdersNow();
        if (created <= 0) {
            return new MessageResponse("KhÃ´ng cÃ³ Ä‘Æ¡n máº«u má»›i Ä‘Æ°á»£c táº¡o.");
        }
        return new MessageResponse("ÄÃ£ táº¡o thÃªm " + created + " Ä‘Æ¡n máº«u.");
    }

    @PatchMapping("/{id}/status")
    public OrderSummaryResponse updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateOrderStatusRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        // Save actor username into order status history for audit trail.
        OrderSummaryResponse summary = orderService.updateStatusSummary(id, request.getStatus(), authentication.getName());
        adminAuditLogService.logAction(
                authentication.getName(),
                resolveActorRole(authentication),
                "ORDER_STATUS_UPDATE",
                "ORDER",
                id,
                "Cập nhật trạng thái đơn thành " + request.getStatus(),
                resolveClientIp(httpRequest)
        );
        return summary;
    }

    @DeleteMapping("/{id}")
    public MessageResponse deleteOrder(
            @PathVariable Long id,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        String actor = authentication != null ? authentication.getName() : "admin";
        orderService.deleteOrderByAdmin(id, actor);
        adminAuditLogService.logAction(
                actor,
                resolveActorRole(authentication),
                "ORDER_DELETE",
                "ORDER",
                id,
                "Xóa đơn hàng khỏi hệ thống",
                resolveClientIp(httpRequest)
        );
        return new MessageResponse("Đã xóa đơn hàng thành công.");
    }

    private String resolveActorRole(Authentication authentication) {
        if (authentication == null || authentication.getAuthorities() == null) {
            return null;
        }
        return authentication.getAuthorities().stream()
                .findFirst()
                .map(granted -> granted.getAuthority())
                .orElse(null);
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}

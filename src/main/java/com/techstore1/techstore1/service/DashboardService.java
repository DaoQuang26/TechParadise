package com.techstore1.techstore1.service;

import com.techstore1.techstore1.dto.DashboardRevenueDetailResponse;
import com.techstore1.techstore1.dto.DashboardRevenuePointResponse;
import com.techstore1.techstore1.dto.DashboardStatsResponse;
import com.techstore1.techstore1.entity.Order;
import com.techstore1.techstore1.enums.OrderStatus;
import com.techstore1.techstore1.enums.Role;
import com.techstore1.techstore1.repository.OrderRepository;
import com.techstore1.techstore1.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class DashboardService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;

    @Value("${app.dashboard.revenue.days-forward:30}")
    private int revenueDaysForward;

    public DashboardService(OrderRepository orderRepository, UserRepository userRepository) {
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
    }

    public DashboardStatsResponse getStats() {
        long totalOrders = orderRepository.count();
        long deliveredOrders = orderRepository.countByStatus(OrderStatus.DELIVERED);
        long pendingOrders = orderRepository.countByStatus(OrderStatus.PENDING);
        long totalCustomers = userRepository.findByRole(Role.CUSTOMER).size();
        double deliveredRevenue = orderRepository.totalRevenueFromDeliveredOrders();

        return new DashboardStatsResponse(
                totalOrders,
                totalCustomers,
                deliveredOrders,
                pendingOrders,
                deliveredRevenue
        );
    }

    public DashboardRevenueDetailResponse getRevenueDetail(int days, String groupByRaw) {
        int safeDays = Math.max(7, Math.min(365, days));
        int safeFutureDays = Math.max(0, Math.min(120, revenueDaysForward));
        String groupBy = normalizeGroupBy(groupByRaw);

        LocalDate today = LocalDate.now();
        LocalDate startDate = today.minusDays(safeDays - 1L);
        LocalDate endDate = today.plusDays(safeFutureDays);
        LocalDateTime from = startDate.atStartOfDay();
        LocalDateTime to = endDate.plusDays(1L).atStartOfDay();

        // tac dung code: doc don da giao trong ky hien tai (bao gom mot khoang ngay tuong lai) de ve chart doanh thu.
        List<Order> currentDeliveredOrders = orderRepository.findByStatusAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                OrderStatus.DELIVERED,
                from,
                to
        );

        LinkedHashMap<String, RevenueBucket> buckets = initBuckets(startDate, endDate, groupBy);
        fillRevenueBuckets(buckets, currentDeliveredOrders, groupBy);
        List<DashboardRevenuePointResponse> points = toPoints(buckets);

        double totalRevenue = points.stream().mapToDouble(DashboardRevenuePointResponse::revenue).sum();
        long deliveredOrders = points.stream().mapToLong(DashboardRevenuePointResponse::deliveredOrders).sum();
        double averageOrderValue = deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0D;

        LocalDateTime previousFrom = startDate.minusDays(safeDays + safeFutureDays).atStartOfDay();
        LocalDateTime previousTo = startDate.atStartOfDay();
        List<Order> previousDeliveredOrders = orderRepository.findByStatusAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                OrderStatus.DELIVERED,
                previousFrom,
                previousTo
        );
        double previousRevenue = previousDeliveredOrders
                .stream()
                .map(Order::getTotalPrice)
                .filter(price -> price != null && price > 0)
                .mapToDouble(Double::doubleValue)
                .sum();

        double growthPercent;
        if (previousRevenue <= 0) {
            growthPercent = totalRevenue > 0 ? 100D : 0D;
        } else {
            growthPercent = ((totalRevenue - previousRevenue) / previousRevenue) * 100D;
        }

        DashboardRevenuePointResponse peakPoint = points
                .stream()
                .max((a, b) -> Double.compare(a.revenue(), b.revenue()))
                .orElse(new DashboardRevenuePointResponse("-", "-", 0D, 0L));

        return new DashboardRevenueDetailResponse(
                safeDays,
                groupBy,
                totalRevenue,
                previousRevenue,
                growthPercent,
                deliveredOrders,
                averageOrderValue,
                peakPoint.label(),
                peakPoint.revenue(),
                points
        );
    }

    private String normalizeGroupBy(String raw) {
        String normalized = raw == null ? "day" : raw.trim().toLowerCase(Locale.ROOT);
        if ("week".equals(normalized) || "month".equals(normalized)) {
            return normalized;
        }
        return "day";
    }

    private LinkedHashMap<String, RevenueBucket> initBuckets(LocalDate start, LocalDate end, String groupBy) {
        LinkedHashMap<String, RevenueBucket> buckets = new LinkedHashMap<>();
        LocalDate cursor = start;
        while (!cursor.isAfter(end)) {
            BucketKey bucketKey = toBucketKey(cursor, groupBy);
            buckets.putIfAbsent(bucketKey.key(), new RevenueBucket(bucketKey.label()));
            cursor = cursor.plusDays(1L);
        }
        return buckets;
    }

    private void fillRevenueBuckets(Map<String, RevenueBucket> buckets, List<Order> orders, String groupBy) {
        for (Order order : orders) {
            if (order == null || order.getCreatedAt() == null) {
                continue;
            }
            double price = order.getTotalPrice() == null ? 0D : order.getTotalPrice();
            if (price <= 0D) {
                continue;
            }

            BucketKey bucketKey = toBucketKey(order.getCreatedAt().toLocalDate(), groupBy);
            RevenueBucket bucket = buckets.get(bucketKey.key());
            if (bucket == null) {
                continue;
            }

            bucket.revenue += price;
            bucket.deliveredOrders += 1;
        }
    }

    private List<DashboardRevenuePointResponse> toPoints(LinkedHashMap<String, RevenueBucket> buckets) {
        List<DashboardRevenuePointResponse> points = new ArrayList<>();
        for (Map.Entry<String, RevenueBucket> entry : buckets.entrySet()) {
            RevenueBucket bucket = entry.getValue();
            points.add(new DashboardRevenuePointResponse(
                    entry.getKey(),
                    bucket.label,
                    bucket.revenue,
                    bucket.deliveredOrders
            ));
        }
        return points;
    }

    private BucketKey toBucketKey(LocalDate date, String groupBy) {
        if ("week".equals(groupBy)) {
            LocalDate weekStart = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            String key = weekStart.toString();
            String label = "Tuần " + weekStart.getDayOfMonth() + "/" + weekStart.getMonthValue();
            return new BucketKey(key, label);
        }
        if ("month".equals(groupBy)) {
            LocalDate monthStart = date.withDayOfMonth(1);
            String key = monthStart.toString();
            String label = monthStart.getMonthValue() + "/" + monthStart.getYear();
            return new BucketKey(key, label);
        }

        String key = date.toString();
        String label = date.getDayOfMonth() + "/" + date.getMonthValue();
        return new BucketKey(key, label);
    }

    // tac dung code: bucket trung gian de cong don doanh thu/truy van chart nhanh gon.
    private static final class RevenueBucket {
        private final String label;
        private double revenue;
        private long deliveredOrders;

        private RevenueBucket(String label) {
            this.label = label;
            this.revenue = 0D;
            this.deliveredOrders = 0L;
        }
    }

    private record BucketKey(String key, String label) {}
}

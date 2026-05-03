package com.techstore1.techstore1.dto;

// tac dung code: 1 diem du lieu doanh thu cho bieu do admin (theo ngay/tuan/thang).
public record DashboardRevenuePointResponse(
        String key,
        String label,
        double revenue,
        long deliveredOrders
) {
}

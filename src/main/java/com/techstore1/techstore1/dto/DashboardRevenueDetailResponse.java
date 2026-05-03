package com.techstore1.techstore1.dto;

import java.util.List;

// tac dung code: goi du lieu tong hop doanh thu chi tiet cho dashboard admin.
public record DashboardRevenueDetailResponse(
        int days,
        String groupBy,
        double totalRevenue,
        double previousRevenue,
        double growthPercent,
        long deliveredOrders,
        double averageOrderValue,
        String peakLabel,
        double peakRevenue,
        List<DashboardRevenuePointResponse> points
) {
}

package com.techstore1.techstore1.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class DashboardStatsResponse {
    private long totalOrders;
    private long totalCustomers;
    private long deliveredOrders;
    private long pendingOrders;
    private double deliveredRevenue;
}

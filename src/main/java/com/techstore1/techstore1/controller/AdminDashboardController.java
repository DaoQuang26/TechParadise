package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.DashboardRevenueDetailResponse;
import com.techstore1.techstore1.dto.DashboardStatsResponse;
import com.techstore1.techstore1.service.DashboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/dashboard")
public class AdminDashboardController {

    private final DashboardService dashboardService;

    public AdminDashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/stats")
    public DashboardStatsResponse stats() {
        return dashboardService.getStats();
    }

    @GetMapping("/revenue-detail")
    public DashboardRevenueDetailResponse revenueDetail(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "day") String groupBy
    ) {
        // tac dung code: tra du lieu chart doanh thu chi tiet theo bo loc khoang ngay + kieu nhom.
        return dashboardService.getRevenueDetail(days, groupBy);
    }
}

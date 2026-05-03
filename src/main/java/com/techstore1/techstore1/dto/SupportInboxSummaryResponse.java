package com.techstore1.techstore1.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class SupportInboxSummaryResponse {
    private long unreadForCustomer;
    private String lastMessagePreview;
    private LocalDateTime lastMessageAt;
}

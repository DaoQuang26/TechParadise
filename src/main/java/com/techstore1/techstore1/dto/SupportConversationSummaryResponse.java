package com.techstore1.techstore1.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class SupportConversationSummaryResponse {
    private Long customerId;
    private String customerUsername;
    private String customerEmail;
    private String lastMessagePreview;
    private LocalDateTime lastMessageAt;
    private String lastSenderRole;
    private String lastSenderDisplayName;
    private long unreadForAdmin;
}

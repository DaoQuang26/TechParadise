package com.techstore1.techstore1.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class SupportMessageResponse {
    private Long id;
    private Long customerId;
    private Long senderUserId;
    private String senderRole;
    private String senderDisplayName;
    private String content;
    private LocalDateTime createdAt;
    private boolean readByAdmin;
    private boolean readByCustomer;
    private boolean fromCurrentUser;
}

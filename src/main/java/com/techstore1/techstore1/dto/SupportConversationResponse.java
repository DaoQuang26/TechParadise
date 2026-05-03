package com.techstore1.techstore1.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class SupportConversationResponse {
    private Long customerId;
    private String customerUsername;
    private String customerEmail;
    private long unreadForAdmin;
    private long unreadForCustomer;
    private List<SupportMessageResponse> messages = new ArrayList<>();
}

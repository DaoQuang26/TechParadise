package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.SupportConversationResponse;
import com.techstore1.techstore1.dto.SupportInboxSummaryResponse;
import com.techstore1.techstore1.dto.SupportMessageRequest;
import com.techstore1.techstore1.dto.SupportMessageResponse;
import com.techstore1.techstore1.service.SupportMessageService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customer/messages")
public class CustomerSupportMessageController {

    private final SupportMessageService supportMessageService;

    public CustomerSupportMessageController(SupportMessageService supportMessageService) {
        this.supportMessageService = supportMessageService;
    }

    @GetMapping
    public SupportConversationResponse getConversation(
            Authentication authentication,
            @RequestParam(defaultValue = "true") boolean markRead
    ) {
        return supportMessageService.getCustomerConversation(requireUsername(authentication), markRead);
    }

    @GetMapping("/summary")
    public SupportInboxSummaryResponse getInboxSummary(Authentication authentication) {
        return supportMessageService.getCustomerInboxSummary(requireUsername(authentication));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SupportMessageResponse sendMessage(
            Authentication authentication,
            @Valid @RequestBody SupportMessageRequest request
    ) {
        return supportMessageService.sendCustomerMessage(requireUsername(authentication), request.getContent());
    }

    private String requireUsername(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()
                || "anonymousUser".equalsIgnoreCase(authentication.getName())) {
            throw new IllegalArgumentException("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        }
        return authentication.getName();
    }
}

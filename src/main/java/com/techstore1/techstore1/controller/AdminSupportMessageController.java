package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.dto.SupportConversationResponse;
import com.techstore1.techstore1.dto.SupportConversationSummaryResponse;
import com.techstore1.techstore1.dto.SupportMessageRequest;
import com.techstore1.techstore1.dto.SupportMessageResponse;
import com.techstore1.techstore1.service.SupportMessageService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/messages")
public class AdminSupportMessageController {

    private final SupportMessageService supportMessageService;

    public AdminSupportMessageController(SupportMessageService supportMessageService) {
        this.supportMessageService = supportMessageService;
    }

    @GetMapping("/conversations")
    public List<SupportConversationSummaryResponse> getConversations(Authentication authentication) {
        return supportMessageService.getAdminConversations(requireUsername(authentication));
    }

    @GetMapping("/conversations/{customerId}")
    public SupportConversationResponse getConversation(
            @PathVariable Long customerId,
            Authentication authentication,
            @RequestParam(defaultValue = "true") boolean markRead
    ) {
        return supportMessageService.getAdminConversation(requireUsername(authentication), customerId, markRead);
    }

    @PostMapping("/conversations/{customerId}/reply")
    @ResponseStatus(HttpStatus.CREATED)
    public SupportMessageResponse sendReply(
            @PathVariable Long customerId,
            Authentication authentication,
            @Valid @RequestBody SupportMessageRequest request
    ) {
        return supportMessageService.sendAdminReply(requireUsername(authentication), customerId, request.getContent());
    }

    private String requireUsername(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()
                || "anonymousUser".equalsIgnoreCase(authentication.getName())) {
            throw new IllegalArgumentException("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        }
        return authentication.getName();
    }
}

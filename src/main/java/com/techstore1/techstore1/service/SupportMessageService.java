package com.techstore1.techstore1.service;

import com.techstore1.techstore1.dto.SupportConversationResponse;
import com.techstore1.techstore1.dto.SupportConversationSummaryResponse;
import com.techstore1.techstore1.dto.SupportInboxSummaryResponse;
import com.techstore1.techstore1.dto.SupportMessageResponse;
import com.techstore1.techstore1.entity.SupportMessage;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.enums.Role;
import com.techstore1.techstore1.repository.SupportMessageRepository;
import com.techstore1.techstore1.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
public class SupportMessageService {

    private static final Set<Role> ADMIN_ROLES = Set.of(Role.ADMIN, Role.SUPER_ADMIN);

    private final SupportMessageRepository supportMessageRepository;
    private final UserRepository userRepository;

    public SupportMessageService(
            SupportMessageRepository supportMessageRepository,
            UserRepository userRepository
    ) {
        this.supportMessageRepository = supportMessageRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public SupportConversationResponse getCustomerConversation(String username, boolean markRead) {
        User customer = requireCustomerUser(username);
        if (markRead) {
            supportMessageRepository.markAdminMessagesReadByCustomer(customer.getId(), ADMIN_ROLES);
        }

        List<SupportMessageResponse> messages = supportMessageRepository
                .findByCustomerIdOrderByCreatedAtAscIdAsc(customer.getId())
                .stream()
                .map((item) -> toMessageResponse(item, customer.getId()))
                .toList();

        SupportConversationResponse response = new SupportConversationResponse();
        response.setCustomerId(customer.getId());
        response.setCustomerUsername(customer.getUsername());
        response.setCustomerEmail(customer.getEmail());
        response.setUnreadForAdmin(
                supportMessageRepository.countByCustomerIdAndSenderRoleAndReadByAdminFalse(customer.getId(), Role.CUSTOMER)
        );
        response.setUnreadForCustomer(supportMessageRepository.countUnreadForCustomer(customer.getId(), ADMIN_ROLES));
        response.setMessages(messages);
        return response;
    }

    @Transactional(readOnly = true)
    public SupportInboxSummaryResponse getCustomerInboxSummary(String username) {
        User customer = requireCustomerUser(username);

        SupportInboxSummaryResponse response = new SupportInboxSummaryResponse();
        response.setUnreadForCustomer(supportMessageRepository.countUnreadForCustomer(customer.getId(), ADMIN_ROLES));
        supportMessageRepository.findTopByCustomerIdOrderByCreatedAtDescIdDesc(customer.getId())
                .ifPresent((latest) -> {
                    response.setLastMessageAt(latest.getCreatedAt());
                    response.setLastMessagePreview(buildPreview(latest.getContent()));
                });
        return response;
    }

    @Transactional
    public SupportMessageResponse sendCustomerMessage(String username, String rawContent) {
        User customer = requireCustomerUser(username);
        String content = normalizeContent(rawContent);

        SupportMessage message = new SupportMessage();
        message.setCustomer(customer);
        message.setSenderUser(customer);
        message.setSenderRole(Role.CUSTOMER);
        message.setSenderDisplayName(safeDisplayName(customer));
        message.setContent(content);
        message.setReadByAdmin(Boolean.FALSE);
        message.setReadByCustomer(Boolean.TRUE);

        SupportMessage saved = supportMessageRepository.save(message);
        return toMessageResponse(saved, customer.getId());
    }

    @Transactional(readOnly = true)
    public List<SupportConversationSummaryResponse> getAdminConversations(String adminUsername) {
        requireAdminUser(adminUsername);
        return supportMessageRepository.findLatestByCustomerConversation().stream()
                .map(this::toConversationSummary)
                .toList();
    }

    @Transactional
    public SupportConversationResponse getAdminConversation(String adminUsername, Long customerId, boolean markRead) {
        User admin = requireAdminUser(adminUsername);
        User customer = requireCustomerById(customerId);

        if (markRead) {
            supportMessageRepository.markCustomerMessagesReadByAdmin(customer.getId(), Role.CUSTOMER);
        }

        List<SupportMessageResponse> messages = supportMessageRepository
                .findByCustomerIdOrderByCreatedAtAscIdAsc(customer.getId())
                .stream()
                .map((item) -> toMessageResponse(item, admin.getId()))
                .toList();

        SupportConversationResponse response = new SupportConversationResponse();
        response.setCustomerId(customer.getId());
        response.setCustomerUsername(customer.getUsername());
        response.setCustomerEmail(customer.getEmail());
        response.setUnreadForAdmin(
                supportMessageRepository.countByCustomerIdAndSenderRoleAndReadByAdminFalse(customer.getId(), Role.CUSTOMER)
        );
        response.setUnreadForCustomer(supportMessageRepository.countUnreadForCustomer(customer.getId(), ADMIN_ROLES));
        response.setMessages(messages);
        return response;
    }

    @Transactional
    public SupportMessageResponse sendAdminReply(String adminUsername, Long customerId, String rawContent) {
        User admin = requireAdminUser(adminUsername);
        User customer = requireCustomerById(customerId);
        String content = normalizeContent(rawContent);

        SupportMessage message = new SupportMessage();
        message.setCustomer(customer);
        message.setSenderUser(admin);
        message.setSenderRole(admin.getRole());
        message.setSenderDisplayName(safeDisplayName(admin));
        message.setContent(content);
        message.setReadByAdmin(Boolean.TRUE);
        message.setReadByCustomer(Boolean.FALSE);

        SupportMessage saved = supportMessageRepository.save(message);
        return toMessageResponse(saved, admin.getId());
    }

    private SupportConversationSummaryResponse toConversationSummary(SupportMessage latest) {
        SupportConversationSummaryResponse summary = new SupportConversationSummaryResponse();
        User customer = latest.getCustomer();

        summary.setCustomerId(customer != null ? customer.getId() : null);
        summary.setCustomerUsername(customer != null ? customer.getUsername() : "Khách hàng");
        summary.setCustomerEmail(customer != null ? customer.getEmail() : "");
        summary.setLastMessageAt(latest.getCreatedAt());
        summary.setLastMessagePreview(buildPreview(latest.getContent()));
        summary.setLastSenderRole(latest.getSenderRole() == null ? "" : latest.getSenderRole().name());
        summary.setLastSenderDisplayName(latest.getSenderDisplayName());
        summary.setUnreadForAdmin(
                customer == null || customer.getId() == null
                        ? 0
                        : supportMessageRepository.countByCustomerIdAndSenderRoleAndReadByAdminFalse(customer.getId(), Role.CUSTOMER)
        );

        return summary;
    }

    private SupportMessageResponse toMessageResponse(SupportMessage message, Long currentUserId) {
        SupportMessageResponse response = new SupportMessageResponse();
        response.setId(message.getId());
        response.setCustomerId(message.getCustomer() == null ? null : message.getCustomer().getId());
        response.setSenderUserId(message.getSenderUser() == null ? null : message.getSenderUser().getId());
        response.setSenderRole(message.getSenderRole() == null ? "" : message.getSenderRole().name());
        response.setSenderDisplayName(message.getSenderDisplayName());
        response.setContent(message.getContent());
        response.setCreatedAt(message.getCreatedAt());
        response.setReadByAdmin(Boolean.TRUE.equals(message.getReadByAdmin()));
        response.setReadByCustomer(Boolean.TRUE.equals(message.getReadByCustomer()));
        response.setFromCurrentUser(
                message.getSenderUser() != null
                        && currentUserId != null
                        && currentUserId.equals(message.getSenderUser().getId())
        );
        return response;
    }

    private User requireUser(String username) {
        String safeUsername = (username == null ? "" : username).trim();
        if (safeUsername.isBlank() || "anonymousUser".equalsIgnoreCase(safeUsername)) {
            throw new IllegalArgumentException("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        }

        return userRepository.findByUsernameIgnoreCase(safeUsername)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản đăng nhập."));
    }

    private User requireAdminUser(String username) {
        User user = requireUser(username);
        if (!ADMIN_ROLES.contains(user.getRole())) {
            throw new IllegalArgumentException("Bạn không có quyền truy cập mục tin nhắn hỗ trợ.");
        }
        return user;
    }

    private User requireCustomerUser(String username) {
        User user = requireUser(username);
        if (user.getRole() != Role.CUSTOMER) {
            throw new IllegalArgumentException("Chức năng chat hỗ trợ chỉ dành cho tài khoản khách hàng.");
        }
        return user;
    }

    private User requireCustomerById(Long customerId) {
        if (customerId == null || customerId <= 0) {
            throw new IllegalArgumentException("Mã khách hàng không hợp lệ.");
        }

        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy khách hàng."));
        if (customer.getRole() != Role.CUSTOMER) {
            throw new IllegalArgumentException("Hội thoại chỉ áp dụng cho tài khoản khách hàng.");
        }
        return customer;
    }

    private String normalizeContent(String rawContent) {
        String content = (rawContent == null ? "" : rawContent).trim();
        if (content.isBlank()) {
            throw new IllegalArgumentException("Vui lòng nhập nội dung tin nhắn.");
        }
        if (content.length() > 4000) {
            throw new IllegalArgumentException("Tin nhắn quá dài (tối đa 4000 ký tự).");
        }
        return content;
    }

    private String safeDisplayName(User user) {
        if (user == null) {
            return "Ẩn danh";
        }
        String username = (user.getUsername() == null ? "" : user.getUsername()).trim();
        if (!username.isBlank()) {
            return username;
        }
        return (user.getEmail() == null ? "Ẩn danh" : user.getEmail()).trim();
    }

    private String buildPreview(String content) {
        String safe = (content == null ? "" : content).trim();
        if (safe.length() <= 120) {
            return safe;
        }
        return safe.substring(0, 120).trim() + "...";
    }
}

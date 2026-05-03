package com.techstore1.techstore1.service;

import com.techstore1.techstore1.entity.Order;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.enums.OnlinePaymentStatus;
import com.techstore1.techstore1.enums.OrderStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;

@Service
// tac dung code: gui thong bao email cho cac su kien quan trong (don hang, thanh toan, reset password).
public class EmailNotificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailNotificationService.class);
    private static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final JavaMailSender mailSender;
    private final boolean mailEnabled;
    private final String fromAddress;
    private final String adminNotifyAddress;
    private final String forgotPasswordTestTo;

    public EmailNotificationService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.mail.enabled:false}") boolean mailEnabled,
            @Value("${app.mail.from:no-reply@techparadise.local}") String fromAddress,
            @Value("${app.mail.order.notify-admin:}") String adminNotifyAddress,
            @Value("${app.mail.forgot-password.test-to:}") String forgotPasswordTestTo
    ) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.mailEnabled = mailEnabled;
        this.fromAddress = fromAddress;
        this.adminNotifyAddress = adminNotifyAddress;
        this.forgotPasswordTestTo = forgotPasswordTestTo;
    }

    public void sendOrderCreated(Order order) {
        if (order == null || order.getUser() == null) {
            return;
        }
        String to = trim(order.getUser().getEmail());
        if (to == null) {
            return;
        }
        String subject = "[TechParadise] Đã tiếp nhận đơn hàng #" + order.getId();
        String body = """
                Xin chào %s,

                Đơn hàng #%s đã được tiếp nhận.
                Tổng tiền: %s
                Trạng thái: %s

                Cảm ơn bạn đã mua sắm tại TechParadise.
                """.formatted(
                safe(order.getUser().getFullName() == null ? order.getUser().getUsername() : order.getUser().getFullName()),
                order.getId(),
                formatMoney(order.getTotalPrice()),
                safe(order.getStatus())
        );
        sendEmail(to, subject, body);
        sendAdminMirrorIfConfigured(subject, "Khách hàng: " + safe(order.getUser().getUsername()));
    }

    public void sendOrderStatusChanged(Order order, OrderStatus fromStatus, OrderStatus toStatus, String note) {
        if (order == null || order.getUser() == null) {
            return;
        }
        String to = trim(order.getUser().getEmail());
        if (to == null) {
            return;
        }
        String subject = "[TechParadise] Cập nhật đơn hàng #" + order.getId();
        String body = """
                Xin chào %s,

                Đơn hàng #%s vừa được cập nhật.
                Trạng thái cũ: %s
                Trạng thái mới: %s
                Ghi chú: %s

                Vui lòng đăng nhập để xem chi tiết đơn hàng.
                """.formatted(
                safe(order.getUser().getUsername()),
                order.getId(),
                safe(fromStatus),
                safe(toStatus),
                note == null || note.isBlank() ? "-" : note
        );
        sendEmail(to, subject, body);
    }

    public void sendOrderPaymentResult(Order order, OnlinePaymentStatus status, String provider) {
        if (order == null || order.getUser() == null) {
            return;
        }
        String to = trim(order.getUser().getEmail());
        if (to == null) {
            return;
        }
        String subject = "[TechParadise] Kết quả thanh toán đơn #" + order.getId();
        String paidAt = order.getPaidAt() == null ? "-" : DATE_TIME_FORMAT.format(order.getPaidAt());
        String body = """
                Xin chào %s,

                Đơn hàng #%s đã có kết quả thanh toán online.
                Cổng thanh toán: %s
                Trạng thái thanh toán: %s
                Thời điểm xác nhận: %s
                Mã tham chiếu: %s

                Cảm ơn bạn đã mua sắm tại TechParadise.
                """.formatted(
                safe(order.getUser().getUsername()),
                order.getId(),
                provider == null || provider.isBlank() ? "-" : provider,
                safe(status),
                paidAt,
                order.getPaymentReference() == null ? "-" : order.getPaymentReference()
        );
        sendEmail(to, subject, body);
    }

    public void sendPasswordResetToken(User user, String rawToken, long expiryMinutes) {
        if (user == null || rawToken == null || rawToken.isBlank()) {
            return;
        }
        String to = trim(forgotPasswordTestTo);
        if (to == null) {
            to = trim(user.getEmail());
        }
        if (to == null) {
            return;
        }
        String subject = "[TechParadise] Mã đặt lại mật khẩu";
        String body = """
                Xin chào %s,

                Bạn vừa yêu cầu đặt lại mật khẩu.
                Mã reset: %s
                Hiệu lực trong: %s phút

                Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.
                """.formatted(
                safe(user.getUsername()),
                rawToken,
                expiryMinutes
        );
        sendEmail(to, subject, body);
    }

    public boolean canSendEmail() {
        return mailEnabled && mailSender != null;
    }

    private void sendAdminMirrorIfConfigured(String subject, String body) {
        String adminEmail = trim(adminNotifyAddress);
        if (adminEmail == null) {
            return;
        }
        sendEmail(adminEmail, subject, body);
    }

    private void sendEmail(String to, String subject, String body) {
        if (to == null || to.isBlank()) {
            return;
        }

        // tac dung code: cho phep chay local khong SMTP, he thong chi log thong bao thay vi throw loi.
        if (!canSendEmail()) {
            log.info("[mail-disabled] to={} subject={} body={}", to, subject, body);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setFrom(fromAddress);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
        } catch (Exception ex) {
            // tac dung code: khong de loi gui mail lam fail luong dat hang/thanh toan.
            log.error("Cannot send email to {}", to, ex);
        }
    }

    private String trim(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }

    private String safe(Object value) {
        return value == null ? "-" : String.valueOf(value);
    }

    private String formatMoney(Double amount) {
        if (amount == null) {
            return "0 VND";
        }
        return String.format("%,.0f VND", amount);
    }
}

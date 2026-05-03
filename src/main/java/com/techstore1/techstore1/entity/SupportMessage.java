package com.techstore1.techstore1.entity;

import com.techstore1.techstore1.enums.Role;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "support_messages",
        indexes = {
                @Index(name = "idx_support_message_customer_created", columnList = "customer_id, created_at"),
                @Index(name = "idx_support_message_sender_role", columnList = "sender_role")
        }
)
@Getter
@Setter
@NoArgsConstructor
public class SupportMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_user_id")
    private User senderUser;

    @Enumerated(EnumType.STRING)
    @Column(name = "sender_role", nullable = false, length = 20)
    private Role senderRole;

    @Column(name = "sender_display_name", nullable = false, length = 120)
    private String senderDisplayName;

    @Column(nullable = false, length = 4000)
    private String content;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "read_by_admin", nullable = false)
    private Boolean readByAdmin;

    @Column(name = "read_by_customer", nullable = false)
    private Boolean readByCustomer;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (readByAdmin == null) {
            readByAdmin = Boolean.FALSE;
        }
        if (readByCustomer == null) {
            readByCustomer = Boolean.FALSE;
        }
    }
}

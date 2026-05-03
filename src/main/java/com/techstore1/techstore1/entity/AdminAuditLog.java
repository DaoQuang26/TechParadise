package com.techstore1.techstore1.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "admin_audit_logs",
        indexes = {
                @Index(name = "idx_admin_audit_created_at", columnList = "createdAt"),
                @Index(name = "idx_admin_audit_action", columnList = "action"),
                @Index(name = "idx_admin_audit_actor", columnList = "actorUsername")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
// tac dung code: luu nhat ky thao tac quan tri de truy vet ai da sua/xoa/cap nhat du lieu.
public class AdminAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String actorUsername;

    @Column(length = 60)
    private String actorRole;

    @Column(nullable = false, length = 120)
    private String action;

    @Column(nullable = false, length = 80)
    private String targetType;

    private Long targetId;

    @Column(length = 1000)
    private String message;

    @Column(length = 64)
    private String ipAddress;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}


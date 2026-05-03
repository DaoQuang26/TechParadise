package com.techstore1.techstore1.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.techstore1.techstore1.enums.Role;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(name = "full_name", length = 120)
    private String fullName;

    @Column(nullable = false, unique = true)
    private String email;

    @JsonIgnore
    @Column(nullable = false)
    private String password;

    @Column(length = 30)
    private String phone;

    private String address;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    private LocalDateTime createdAt;

    // tac dung code: dem so lan dang nhap sai lien tiep de khoa tam thoi tai khoan khi vuot nguong.
    private Integer failedLoginAttempts;

    // tac dung code: khoa dang nhap den thoi diem nay neu nguoi dung nhap sai mat khau qua nhieu lan.
    private LocalDateTime lockoutUntil;

    // tac dung code: luu moc dang nhap thanh cong gan nhat phuc vu audit bao mat.
    private LocalDateTime lastLoginAt;

    // tac dung code: bat/tat tai khoan tu admin; tai khoan bi tat se khong dang nhap duoc.
    private Boolean active;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        if (this.failedLoginAttempts == null) {
            this.failedLoginAttempts = 0;
        }
        if (this.active == null) {
            this.active = true;
        }
    }

    @PreUpdate
    public void preUpdate() {
        if (this.failedLoginAttempts == null) {
            this.failedLoginAttempts = 0;
        }
        if (this.active == null) {
            this.active = true;
        }
    }
}

package com.techstore1.techstore1.entity;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import com.techstore1.techstore1.enums.OnlinePaymentStatus;
import com.techstore1.techstore1.enums.OrderStatus;
import com.techstore1.techstore1.enums.PaymentMethod;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
// tac dung code: entity don hang bo sung trang thai thanh toan online + ma tham chieu webhook.
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Double totalPrice;

    // Tổng tiền trước khi áp khuyến mãi (để hiển thị breakdown rõ rÁ ng).
    private Double subtotalPrice;

    // Số tiền giảm (VND) sau khi áp mã khuyến mãi.
    private Double discountAmount;

    // % giảm tại thời điểm đặt đơn (snapshot để sau nÁ y thay đổi promotion không ảnh hưởng đơn cũ).
    private Integer discountPercent;

    // Mã khuyến mãi đã áp (nếu có).
    private String promotionCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;

    private LocalDateTime createdAt;
    @Column(length = 120)
    private String recipientName;

    @Column(length = 30)
    private String recipientPhone;

    private String shippingAddress;

    @Enumerated(EnumType.STRING)
    private PaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    private OnlinePaymentStatus onlinePaymentStatus;

    // tác dụng code: tham chiếu giao dịch để webhook map ve dung don hang.
    @Column(length = 120, unique = true)
    private String paymentReference;

    // tác dụng code: provider thanh toan hien tai (mock gateway de demo).
    @Column(length = 60)
    private String paymentProvider;

    // tác dụng code: thoi diem cong thanh toan xac nhan da thu tien.
    private LocalDateTime paidAt;

    // tac dung code: han giu hang cho don online, qua moc nay he thong co the tu dong huy neu chua thanh toan.
    private LocalDateTime reservationExpiresAt;

    // Lý do khách gửi khi yêu cầu hủy đơn (admin dùng để duyệt hủy).
    @Column(length = 500)
    private String cancelRequestReason;

    // Thời điểm khách gửi yêu cầu hủy.
    private LocalDateTime cancelRequestedAt;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<OrderItem> items = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (status == null) {
            status = OrderStatus.PENDING;
        }
        if (subtotalPrice == null) {
            subtotalPrice = totalPrice;
        }
        if (discountAmount == null) {
            discountAmount = 0D;
        }
        if (paymentMethod == null) {
            paymentMethod = PaymentMethod.COD;
        }
        if (onlinePaymentStatus == null) {
            // tác dụng code: don dung online gateway thi mac dinh cho webhook, con lai khong can thanh toan online.
            onlinePaymentStatus = OnlinePaymentStatus.PENDING;
        }
        if (totalPrice == null) {
            totalPrice = 0D;
        }
    }
}


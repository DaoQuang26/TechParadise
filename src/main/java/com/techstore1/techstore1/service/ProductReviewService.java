package com.techstore1.techstore1.service;

import com.techstore1.techstore1.dto.ProductReviewRequest;
import com.techstore1.techstore1.dto.ProductReviewResponse;
import com.techstore1.techstore1.dto.ProductReviewSummaryResponse;
import com.techstore1.techstore1.entity.Product;
import com.techstore1.techstore1.entity.ProductReview;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.enums.OrderStatus;
import com.techstore1.techstore1.repository.OrderItemRepository;
import com.techstore1.techstore1.repository.ProductRepository;
import com.techstore1.techstore1.repository.ProductReviewRepository;
import com.techstore1.techstore1.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
// tac dung code: xu ly nghiep vu danh gia san pham (dieu kien da mua, cap nhat, thong ke diem trung binh).
public class ProductReviewService {

    private final ProductRepository productRepository;
    private final ProductReviewRepository productReviewRepository;
    private final UserRepository userRepository;
    private final OrderItemRepository orderItemRepository;

    public ProductReviewService(
            ProductRepository productRepository,
            ProductReviewRepository productReviewRepository,
            UserRepository userRepository,
            OrderItemRepository orderItemRepository
    ) {
        this.productRepository = productRepository;
        this.productReviewRepository = productReviewRepository;
        this.userRepository = userRepository;
        this.orderItemRepository = orderItemRepository;
    }

    @Transactional(readOnly = true)
    public List<ProductReviewResponse> getPublicReviews(Long productId, String currentUsername) {
        ensureProductExists(productId);
        Long currentUserId = resolveUserIdIfAny(currentUsername);

        return productReviewRepository.findByProductIdOrderByCreatedAtDesc(productId)
                .stream()
                .map(review -> toResponse(review, currentUserId))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductReviewSummaryResponse getReviewSummary(Long productId, String currentUsername) {
        ensureProductExists(productId);

        long total = productReviewRepository.countByProductId(productId);
        double avg = productReviewRepository.averageRatingByProductId(productId);

        long oneStar = productReviewRepository.countByProductIdAndRating(productId, 1);
        long twoStar = productReviewRepository.countByProductIdAndRating(productId, 2);
        long threeStar = productReviewRepository.countByProductIdAndRating(productId, 3);
        long fourStar = productReviewRepository.countByProductIdAndRating(productId, 4);
        long fiveStar = productReviewRepository.countByProductIdAndRating(productId, 5);

        Long currentUserId = resolveUserIdIfAny(currentUsername);
        boolean hasReviewed = false;
        boolean canReview = false;

        if (currentUserId != null) {
            hasReviewed = productReviewRepository.findByProductIdAndUserId(productId, currentUserId).isPresent();
            boolean purchased = orderItemRepository.existsByUserAndProductAndOrderStatus(
                    currentUserId,
                    productId,
                    OrderStatus.DELIVERED
            );
            // Da tung review thi van cho phep mo form de sua danh gia.
            canReview = hasReviewed || purchased;
        }

        return new ProductReviewSummaryResponse(
                productId,
                total,
                avg,
                oneStar,
                twoStar,
                threeStar,
                fourStar,
                fiveStar,
                canReview,
                hasReviewed
        );
    }

    @Transactional
    public ProductReviewResponse upsertMyReview(Long productId, String username, ProductReviewRequest request) {
        User user = findUserByUsername(username);
        Product product = findProductById(productId);

        int rating = normalizeRating(request == null ? null : request.getRating());
        String content = normalizeContent(request == null ? null : request.getContent());

        ProductReview review = productReviewRepository.findByProductIdAndUserId(productId, user.getId())
                .orElseGet(() -> {
                    boolean purchased = orderItemRepository.existsByUserAndProductAndOrderStatus(
                            user.getId(),
                            productId,
                            OrderStatus.DELIVERED
                    );
                    if (!purchased) {
                        throw new IllegalArgumentException("Bạn chỉ có thể đánh giá sau khi đã nhận hàng");
                    }
                    ProductReview created = new ProductReview();
                    created.setProduct(product);
                    created.setUser(user);
                    return created;
                });

        review.setRating(rating);
        review.setContent(content);

        ProductReview saved = productReviewRepository.save(review);
        return toResponse(saved, user.getId());
    }

    @Transactional
    public void deleteMyReview(Long productId, String username) {
        User user = findUserByUsername(username);
        ProductReview review = productReviewRepository.findByProductIdAndUserId(productId, user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đánh giá của bạn"));
        productReviewRepository.delete(review);
    }

    @Transactional
    public void deleteByProductId(Long productId) {
        productReviewRepository.deleteByProductId(productId);
    }

    private ProductReviewResponse toResponse(ProductReview review, Long currentUserId) {
        Long reviewUserId = review.getUser() == null ? null : review.getUser().getId();
        return new ProductReviewResponse(
                review.getId(),
                review.getProduct() == null ? null : review.getProduct().getId(),
                reviewUserId,
                review.getUser() == null ? null : review.getUser().getUsername(),
                review.getUser() == null ? null : review.getUser().getFullName(),
                review.getRating(),
                review.getContent(),
                review.getCreatedAt(),
                review.getUpdatedAt(),
                currentUserId != null && currentUserId.equals(reviewUserId)
        );
    }

    private Long resolveUserIdIfAny(String username) {
        if (username == null || username.isBlank() || "anonymousUser".equalsIgnoreCase(username)) {
            return null;
        }
        return userRepository.findByUsername(username).map(User::getId).orElse(null);
    }

    private User findUserByUsername(String username) {
        if (username == null || username.isBlank() || "anonymousUser".equalsIgnoreCase(username)) {
            throw new IllegalArgumentException("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        }
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản"));
    }

    private Product findProductById(Long productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy sản phẩm"));
    }

    private void ensureProductExists(Long productId) {
        if (productId == null || !productRepository.existsById(productId)) {
            throw new IllegalArgumentException("Không tìm thấy sản phẩm");
        }
    }

    private int normalizeRating(Integer rating) {
        if (rating == null || rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Điểm đánh giá phải từ 1 đến 5");
        }
        return rating;
    }

    private String normalizeContent(String rawContent) {
        String content = rawContent == null ? "" : rawContent.trim();
        if (content.length() > 1200) {
            throw new IllegalArgumentException("Nội dung đánh giá tối đa 1200 ký tự");
        }
        return content.isBlank() ? null : content;
    }
}

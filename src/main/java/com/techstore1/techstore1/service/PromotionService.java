package com.techstore1.techstore1.service;

import com.techstore1.techstore1.dto.PromotionValidateResponse;
import com.techstore1.techstore1.entity.Promotion;
import com.techstore1.techstore1.repository.PromotionRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class PromotionService {

    private final PromotionRepository promotionRepository;

    public PromotionService(PromotionRepository promotionRepository) {
        this.promotionRepository = promotionRepository;
    }

    public List<Promotion> findAll() {
        return promotionRepository.findAll();
    }

    public PromotionValidateResponse validateCode(String rawCode) {
        Promotion promotion = findValidPromotionOrThrow(rawCode);
        String normalized = promotion.getCode() == null ? "" : promotion.getCode().trim().toUpperCase();
        return new PromotionValidateResponse(normalized, promotion.getDiscountPercent(), "Áp dụng mã thành công");
    }

    public Promotion findValidPromotionOrThrow(String rawCode) {
        final String code = rawCode == null ? "" : rawCode.trim();
        if (code.isBlank()) {
            throw new IllegalArgumentException("Vui lòng nhập mã khuyến mãi");
        }

        Promotion promotion = promotionRepository.findByCodeIgnoreCase(code)
                .orElseThrow(() -> new IllegalArgumentException("Mã khuyến mãi không tồn tại"));

        if (promotion.getActive() == null || !promotion.getActive()) {
            throw new IllegalArgumentException("Mã khuyến mãi đã bị tắt");
        }

        LocalDate today = LocalDate.now();
        if (promotion.getStartDate() != null && today.isBefore(promotion.getStartDate())) {
            throw new IllegalArgumentException("Mã khuyến mãi chưa đến ngày áp dụng");
        }
        if (promotion.getEndDate() != null && today.isAfter(promotion.getEndDate())) {
            throw new IllegalArgumentException("Mã khuyến mãi đã hết hạn");
        }

        Integer percent = promotion.getDiscountPercent();
        if (percent == null || percent <= 0 || percent > 100) {
            throw new IllegalArgumentException("Mã khuyến mãi không hợp lệ");
        }

        return promotion;
    }

    public Promotion create(Promotion promotion) {
        validatePromotionPayload(promotion);
        if (promotionRepository.existsByCodeIgnoreCase(promotion.getCode())) {
            throw new IllegalArgumentException("Mã khuyến mãi đã tồn tại");
        }
        return promotionRepository.save(promotion);
    }

    public Promotion update(Long id, Promotion request) {
        Promotion promotion = promotionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy khuyến mãi"));

        validatePromotionPayload(request);
        if (promotionRepository.existsByCodeIgnoreCaseAndIdNot(request.getCode(), id)) {
            throw new IllegalArgumentException("Mã khuyến mãi đã tồn tại");
        }

        promotion.setCode(request.getCode());
        promotion.setDiscountPercent(request.getDiscountPercent());
        promotion.setStartDate(request.getStartDate());
        promotion.setEndDate(request.getEndDate());
        promotion.setActive(request.getActive());

        return promotionRepository.save(promotion);
    }

    public void delete(Long id) {
        if (!promotionRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy khuyến mãi");
        }
        promotionRepository.deleteById(id);
    }

    private void validatePromotionPayload(Promotion promotion) {
        if (promotion == null) {
            throw new IllegalArgumentException("Promotion is required");
        }

        String code = promotion.getCode() == null ? "" : promotion.getCode().trim();
        if (code.isBlank()) {
            throw new IllegalArgumentException("Mã khuyến mãi không được để trống");
        }

        Integer percent = promotion.getDiscountPercent();
        if (percent == null || percent <= 0 || percent > 100) {
            throw new IllegalArgumentException("Phần trăm giảm phải nằm trong khoảng 1-100");
        }

        LocalDate startDate = promotion.getStartDate();
        LocalDate endDate = promotion.getEndDate();
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc khuyến mãi");
        }
        if (endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("Ngày kết thúc phải sau ngày bắt đầu");
        }

        promotion.setCode(code.toUpperCase());

        if (promotion.getActive() == null) {
            promotion.setActive(Boolean.TRUE);
        }
    }
}

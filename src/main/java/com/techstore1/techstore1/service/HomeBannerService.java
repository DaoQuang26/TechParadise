package com.techstore1.techstore1.service;

import com.techstore1.techstore1.entity.HomeBanner;
import com.techstore1.techstore1.repository.HomeBannerRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class HomeBannerService {

    private static final String DEFAULT_TARGET_URL = "#market-zones-section";
    private final HomeBannerRepository homeBannerRepository;
    private final AtomicBoolean defaultSeedChecked = new AtomicBoolean(false);

    public HomeBannerService(HomeBannerRepository homeBannerRepository) {
        this.homeBannerRepository = homeBannerRepository;
    }

    public List<HomeBanner> findPublicHomeBanners() {
        ensureDefaultDataOnce();
        return homeBannerRepository.findAllByOrderByIdAsc();
    }

    public List<HomeBanner> findAdminHomeBanners() {
        ensureDefaultDataOnce();
        return homeBannerRepository.findAllByOrderByIdAsc();
    }

    public HomeBanner create(HomeBanner request) {
        ensureDefaultDataOnce();
        if (request == null) {
            throw new IllegalArgumentException("Dữ liệu banner không hợp lệ");
        }

        HomeBanner banner = new HomeBanner();
        banner.setImageUrl(normalizeImageUrl(request.getImageUrl()));
        banner.setTargetUrl(normalizeTargetUrl(request.getTargetUrl()));
        banner.setAltText(normalizeAltText(request.getAltText()));
        return homeBannerRepository.save(banner);
    }

    public HomeBanner update(Long id, HomeBanner request) {
        ensureDefaultDataOnce();
        if (id == null) {
            throw new IllegalArgumentException("Không tìm thấy banner");
        }
        if (request == null) {
            throw new IllegalArgumentException("Dữ liệu banner không hợp lệ");
        }

        HomeBanner banner = homeBannerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy banner"));

        banner.setImageUrl(normalizeImageUrl(request.getImageUrl()));
        banner.setTargetUrl(normalizeTargetUrl(request.getTargetUrl()));
        banner.setAltText(normalizeAltText(request.getAltText()));
        return homeBannerRepository.save(banner);
    }

    public void delete(Long id) {
        ensureDefaultDataOnce();
        if (id == null || !homeBannerRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy banner");
        }
        homeBannerRepository.deleteById(id);
    }

    private void ensureDefaultDataOnce() {
        if (defaultSeedChecked.get()) {
            return;
        }

        synchronized (this) {
            if (defaultSeedChecked.get()) {
                return;
            }

            if (homeBannerRepository.count() == 0) {
                homeBannerRepository.saveAll(List.of(
                        defaultBanner(
                                "https://cdn.hstatic.net/files/200000722513/file/banner_msi.1.jpg",
                                "Banner MSI"
                        ),
                        defaultBanner(
                                "https://cdn.hstatic.net/files/200000722513/file/gigabyte.jpg",
                                "Banner GIGABYTE"
                        )
                ));
            }

            defaultSeedChecked.set(true);
        }
    }

    private HomeBanner defaultBanner(String imageUrl, String altText) {
        HomeBanner banner = new HomeBanner();
        banner.setImageUrl(imageUrl);
        banner.setTargetUrl(DEFAULT_TARGET_URL);
        banner.setAltText(altText);
        return banner;
    }

    private String normalizeImageUrl(String raw) {
        String url = raw == null ? "" : raw.trim();
        if (url.isBlank()) {
            throw new IllegalArgumentException("URL ảnh banner không được để trống");
        }

        if (!(url.startsWith("http://")
                || url.startsWith("https://")
                || url.startsWith("/uploads/"))) {
            throw new IllegalArgumentException("URL ảnh banner phải bắt đầu bằng http://, https:// hoặc /uploads/");
        }
        return url;
    }

    private String normalizeTargetUrl(String raw) {
        String url = raw == null ? "" : raw.trim();
        if (url.isBlank()) {
            return DEFAULT_TARGET_URL;
        }

        if (!(url.startsWith("http://")
                || url.startsWith("https://")
                || url.startsWith("/")
                || url.startsWith("#"))) {
            throw new IllegalArgumentException("Liên kết banner phải bắt đầu bằng http://, https://, / hoặc #");
        }
        return url;
    }

    private String normalizeAltText(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isBlank()) {
            return "Banner khuyến mãi";
        }
        if (value.length() > 180) {
            throw new IllegalArgumentException("Mô tả banner quá dài (tối đa 180 ký tự)");
        }
        return value;
    }
}

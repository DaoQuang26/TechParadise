package com.techstore1.techstore1.repository;

import com.techstore1.techstore1.entity.HomeBanner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HomeBannerRepository extends JpaRepository<HomeBanner, Long> {
    List<HomeBanner> findAllByOrderByIdAsc();
}


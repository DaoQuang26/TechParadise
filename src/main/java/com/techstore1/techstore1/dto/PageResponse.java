package com.techstore1.techstore1.dto;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Generic page response so frontend receives stable fields independent of Spring Page internals.
 */
public record PageResponse<T>(
        List<T> items,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean last
) {
    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.isLast()
        );
    }
}

package com.techstore1.techstore1.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
// tac dung code: payload gui danh gia san pham tu giao dien khach hang.
public class ProductReviewRequest {

    private Integer rating;

    private String content;
}


package com.techstore1.techstore1.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
// tac dung code: payload admin gui len de tao/cap nhat danh sach bien the cua mot san pham.
public class ProductVariantRequest {

    private String name;

    private String sku;

    private Double price;

    private Integer stock;

    private String imageUrl;

    private Integer sortOrder;
}


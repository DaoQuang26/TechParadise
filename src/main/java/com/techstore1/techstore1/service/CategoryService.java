package com.techstore1.techstore1.service;

import com.techstore1.techstore1.entity.Category;
import com.techstore1.techstore1.repository.CategoryRepository;
import com.techstore1.techstore1.repository.ProductRepository;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    public CategoryService(CategoryRepository categoryRepository, ProductRepository productRepository) {
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
    }

    public List<Category> findAll() {
        List<Category> list = categoryRepository.findAll();
        list.sort(Comparator.comparing(Category::getName, String.CASE_INSENSITIVE_ORDER));
        return list;
    }

    public Category create(Category category) {
        String normalizedName = normalizeName(category == null ? null : category.getName());
        if (categoryRepository.existsByNameIgnoreCase(normalizedName)) {
            throw new IllegalArgumentException("Tên danh mục đã tồn tại");
        }
        category.setName(normalizedName);
        category.setDescription(normalizeDescription(category.getDescription()));
        return categoryRepository.save(category);
    }

    public Category update(Long id, Category request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy danh mục"));

        String normalizedName = normalizeName(request == null ? null : request.getName());
        if (categoryRepository.existsByNameIgnoreCaseAndIdNot(normalizedName, id)) {
            throw new IllegalArgumentException("Tên danh mục đã tồn tại");
        }

        category.setName(normalizedName);
        category.setDescription(normalizeDescription(request.getDescription()));

        return categoryRepository.save(category);
    }

    public void delete(Long id) {
        if (!categoryRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy danh mục");
        }

        long usedByProducts = productRepository.countByCategoryId(id);
        if (usedByProducts > 0) {
            throw new IllegalArgumentException("Không thể xóa danh mục vì còn " + usedByProducts + " sản phẩm thuộc danh mục này");
        }

        categoryRepository.deleteById(id);
    }

    private String normalizeName(String rawName) {
        String name = rawName == null ? "" : rawName.trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("Tên danh mục không được để trống");
        }
        if (name.length() > 100) {
            throw new IllegalArgumentException("Tên danh mục quá dài (tối đa 100 ký tự)");
        }
        return name;
    }

    private String normalizeDescription(String rawDescription) {
        String description = rawDescription == null ? "" : rawDescription.trim();
        return description.isBlank() ? null : description;
    }
}

package com.techstore1.techstore1.controller;

import com.techstore1.techstore1.service.AiImageEnhancementService;
import com.techstore1.techstore1.service.AiRateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/uploads")
public class AdminUploadController {

    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".webp", ".gif");
    private final Path productUploadDir;
    private final AiImageEnhancementService aiImageEnhancementService;
    private final AiRateLimitService aiRateLimitService;

    public AdminUploadController(
            @Value("${app.upload.dir:uploads}") String uploadDir,
            AiImageEnhancementService aiImageEnhancementService,
            AiRateLimitService aiRateLimitService
    ) {
        // Product images are saved under uploads/products to keep file structure organized.
        this.productUploadDir = Paths.get(uploadDir, "products").toAbsolutePath().normalize();
        this.aiImageEnhancementService = aiImageEnhancementService;
        this.aiRateLimitService = aiRateLimitService;
    }

    @PostMapping(value = "/product-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> uploadProductImage(@RequestParam("file") MultipartFile file) {
        validateImageFile(file);
        String originalName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String extension = extractExtension(originalName);
        return saveMultipartFile(file, extension, "UPLOAD");
    }

    @PostMapping(value = "/product-image/ai-enhance", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> uploadProductImageWithAi(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "prompt", required = false) String prompt,
            @RequestParam(value = "seed", required = false) String seed,
            Authentication authentication,
            HttpServletRequest request
    ) {
        validateImageFile(file);
        // Protect paid AI endpoint from abuse by limiting requests per actor in a rolling window.
        aiRateLimitService.checkLimitOrThrow(buildThrottleActorKey(authentication, request));

        try {
            AiImageEnhancementService.EnhancedImageResult result = aiImageEnhancementService.enhanceImage(
                    file.getBytes(),
                    file.getContentType(),
                    "COMFYUI",
                    prompt,
                    seed
            );
            return saveImageBytes(result.bytes(), result.extension(), result.provider());
        } catch (IOException ex) {
            throw new RuntimeException("Không thể đọc ảnh gốc để xử lý AI.", ex);
        }
    }

    @PostMapping("/product-image/ai-enhance/cancel")
    public Map<String, String> cancelProductImageEnhance() {
        aiImageEnhancementService.cancelComfyProcessing();
        return Map.of("status", "cancelled");
    }

    private Map<String, String> saveMultipartFile(MultipartFile file, String extension, String source) {
        try {
            return saveImageBytes(file.getBytes(), extension, source);
        } catch (IOException ex) {
            throw new RuntimeException("Không thể lưu ảnh sản phẩm. Vui lòng thử lại.", ex);
        }
    }

    private Map<String, String> saveImageBytes(byte[] bytes, String extension, String source) {
        String ext = extension == null ? "" : extension.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_IMAGE_EXTENSIONS.contains(ext)) {
            throw new IllegalArgumentException("Định dạng ảnh không hỗ trợ. Chỉ chấp nhận: jpg, jpeg, png, webp, gif");
        }

        String generatedFileName = UUID.randomUUID().toString().replace("-", "") + ext;
        Path target = productUploadDir.resolve(generatedFileName).normalize();

        try {
            Files.createDirectories(productUploadDir);
            Files.write(target, bytes);
        } catch (IOException ex) {
            throw new RuntimeException("Không thể lưu ảnh sản phẩm. Vui lòng thử lại.", ex);
        }

        return Map.of(
                "url", "/uploads/products/" + generatedFileName,
                "filename", generatedFileName,
                "source", source
        );
    }

    private void validateImageFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Vui lòng chọn file ảnh để tải lên");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new IllegalArgumentException("File tải lên phải là ảnh");
        }

        String originalName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String extension = extractExtension(originalName);
        if (!ALLOWED_IMAGE_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("Định dạng ảnh không hỗ trợ. Chỉ chấp nhận: jpg, jpeg, png, webp, gif");
        }
    }

    private String extractExtension(String filename) {
        int index = filename.lastIndexOf(".");
        if (index < 0 || index == filename.length() - 1) {
            return "";
        }
        return filename.substring(index).toLowerCase(Locale.ROOT);
    }

    private String buildThrottleActorKey(Authentication authentication, HttpServletRequest request) {
        if (authentication != null && authentication.getName() != null && !authentication.getName().trim().isBlank()) {
            return "user:" + authentication.getName().trim().toLowerCase(Locale.ROOT);
        }

        String ip = request == null ? "" : request.getRemoteAddr();
        if (ip == null || ip.trim().isBlank()) {
            return "ip:unknown";
        }

        return "ip:" + ip.trim();
    }
}

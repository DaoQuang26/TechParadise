package com.techstore1.techstore1.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class StaticResourceConfig implements WebMvcConfigurer {

    private final Path uploadRoot;

    public StaticResourceConfig(@Value("${app.upload.dir:uploads}") String uploadDir) {
        // Chuẩn hóa đường dẫn upload để app có thể đọc file ảnh đã upload.
        this.uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = uploadRoot.toUri().toString();
        if (!location.endsWith("/")) {
            location = location + "/";
        }

        // Map URL /uploads/** -> thư mục vật lý upload trên máy chủ.
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(location);
    }
}

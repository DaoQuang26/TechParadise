package com.techstore1.techstore1.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class PasswordConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        // PasswordEncoder dùng cho:
        // - Đăng ký (encode password trước khi lưu DB)
        // - Đăng nhập (so sánh raw password người dùng nhập với password trong DB)
        //
        // Ghi chú:
        // - Dự án này ưu tiên BCrypt (chuẩn an toàn).
        // - Để hỗ trợ dữ liệu cũ, nếu password trong DB đang là plain-text
        //   (ví dụ do bạn nhập tay vào database), encoder sẽ match theo plain-text
        //   và sau khi đăng nhập thành công sẽ được "upgrade" lên BCrypt ở AuthService.
        return new PasswordEncoder() {
            private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();

            @Override
            public String encode(CharSequence rawPassword) {
                // Luôn encode theo BCrypt cho password mới.
                return bcrypt.encode(rawPassword);
            }

            @Override
            public boolean matches(CharSequence rawPassword, String encodedPassword) {
                if (rawPassword == null || encodedPassword == null) {
                    return false;
                }

                // Nếu nhìn giống BCrypt => dùng BCrypt để so sánh.
                if (looksLikeBcrypt(encodedPassword)) {
                    return bcrypt.matches(rawPassword, encodedPassword);
                }

                // Fallback: dữ liệu legacy đang lưu plain-text trong DB.
                // (Chỉ nên dùng trong môi trường dev; production phải bắt buộc hash).
                return encodedPassword.equals(rawPassword.toString());
            }

            @Override
            public boolean upgradeEncoding(String encodedPassword) {
                // Nếu password trong DB không phải BCrypt => cần upgrade.
                return encodedPassword != null && !looksLikeBcrypt(encodedPassword);
            }

            private boolean looksLikeBcrypt(String value) {
                // BCrypt thường bắt đầu bằng $2a$, $2b$ hoặc $2y$.
                return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
            }
        };
    }
}

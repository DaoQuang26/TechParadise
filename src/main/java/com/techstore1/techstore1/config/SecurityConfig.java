package com.techstore1.techstore1.config;

import com.techstore1.techstore1.security.JwtFilter;
import com.techstore1.techstore1.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.nio.charset.StandardCharsets;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
// tac dung code: cau hinh quyen truy cap route theo role va bao ve API bang JWT filter.
public class SecurityConfig {

    private final JwtFilter jwtFilter;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    public SecurityConfig(JwtFilter jwtFilter, UserService userService, PasswordEncoder passwordEncoder) {
        this.jwtFilter = jwtFilter;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
                // Keep stateless JWT mode for APIs and page access via JWT cookie/header.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authenticationProvider(authenticationProvider())
                .exceptionHandling(ex -> ex
                        // Redirect browser page requests to login, but keep JSON status for APIs.
                        .authenticationEntryPoint((request, response, authException) -> {
                            if (isHtmlPageRequest(request)) {
                                response.sendRedirect("/login");
                                return;
                            }
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                            response.getWriter().write("{\"message\":\"Unauthorized\"}");
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            if (isHtmlPageRequest(request)) {
                                response.sendRedirect("/");
                                return;
                            }
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                            response.getWriter().write("{\"message\":\"Forbidden\"}");
                        })
                )
                .authorizeHttpRequests(auth -> auth
                        // Public HTML pages.
                        .requestMatchers("/", "/login", "/register", "/product/**", "/category/**", "/payments/mock/**", "/payments/vnpay/**", "/payments/momo/**", "/payments/result").permitAll()
                        // Customer HTML pages now require authenticated JWT cookie/header.
                        .requestMatchers("/cart", "/checkout", "/orders", "/orders/**", "/account").authenticated()
                        // Admin HTML pages require admin role.
                        .requestMatchers("/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        // Static assets.
                        .requestMatchers("/css/**", "/js/**", "/img/**", "/images/**", "/uploads/**", "/webjars/**", "/favicon.ico").permitAll()
                        // Auth endpoints.
                        .requestMatchers("/api/auth/**").permitAll()
                        // Public catalog endpoints.
                        .requestMatchers("/api/public/**").permitAll()
                        // Role-based API.
                        .requestMatchers("/api/super-admin/**").hasRole("SUPER_ADMIN")
                        .requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/customer/**").hasAnyRole("CUSTOMER", "ADMIN", "SUPER_ADMIN")
                        .anyRequest().authenticated()
                )
                // Resolve JWT from Authorization header or HttpOnly cookie.
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private boolean isHtmlPageRequest(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri != null && uri.startsWith("/api/")) {
            return false;
        }

        String accept = request.getHeader("Accept");
        return accept != null && accept.contains("text/html");
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        // DAO provider: username/email lookup + password verification.
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        // Reuse Spring-managed AuthenticationManager.
        return config.getAuthenticationManager();
    }
}

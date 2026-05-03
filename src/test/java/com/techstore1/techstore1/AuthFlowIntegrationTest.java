package com.techstore1.techstore1;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.enums.Role;
import com.techstore1.techstore1.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthFlowIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${app.super-admin.username:superadmin}")
    private String superAdminUsername;

    @Value("${app.super-admin.password:123456}")
    private String superAdminPassword;

    private final List<String> cleanupUsers = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (String username : cleanupUsers) {
            userRepository.findByUsernameIgnoreCase(username)
                    .ifPresent(userRepository::delete);
        }
        cleanupUsers.clear();
    }

    @Test
    void registerShouldHashPasswordWithBcryptAndAllowLogin() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String username = "cust_" + suffix;
        String email = "cust_" + suffix + "@mail.local";
        String rawPassword = "123456";

        cleanupUsers.add(username);

        Map<String, Object> registerPayload = Map.of(
                "username", username,
                "email", email,
                "password", rawPassword,
                "confirmPassword", rawPassword,
                "phone", "0909009009",
                "address", "HCM"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(registerPayload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.role").value("CUSTOMER"));

        User stored = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        assertNotEquals(rawPassword, stored.getPassword(), "Password must not be stored as plain text");
        assertTrue(passwordEncoder.matches(rawPassword, stored.getPassword()), "Stored password must match BCrypt");

        Map<String, Object> loginPayload = Map.of(
                "username", username,
                "password", rawPassword
        );

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.role").value("CUSTOMER"));
    }

    @Test
    void loginShouldUpgradeLegacyPlainPasswordInDatabase() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String username = "legacy_" + suffix;
        String email = "legacy_" + suffix + "@mail.local";
        String rawPassword = "123456";

        cleanupUsers.add(username);

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(rawPassword); // legacy plain-text password
        user.setRole(Role.CUSTOMER);
        user.setPhone("0999999999");
        user.setAddress("Ha Noi");
        userRepository.save(user);

        Map<String, Object> loginPayload = Map.of(
                "username", username,
                "password", rawPassword
        );

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.role").value("CUSTOMER"));

        User upgraded = userRepository.findByUsernameIgnoreCase(username).orElseThrow();
        assertNotEquals(rawPassword, upgraded.getPassword(), "Legacy password should be upgraded after login");
        assertTrue(passwordEncoder.matches(rawPassword, upgraded.getPassword()), "Upgraded password must be BCrypt");
    }

    @Test
    void superAdminShouldBeAbleToLoginWithConfiguredCredentials() throws Exception {
        Map<String, Object> loginPayload = Map.of(
                "username", superAdminUsername,
                "password", superAdminPassword
        );

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginPayload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.username").value(superAdminUsername))
                .andExpect(jsonPath("$.role").value("SUPER_ADMIN"));
    }

    @Test
    void loginShouldSetHttpOnlyAuthCookieForServerSideRouteProtection() throws Exception {
        Map<String, Object> loginPayload = Map.of(
                "username", superAdminUsername,
                "password", superAdminPassword
        );

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginPayload)))
                .andExpect(status().isOk())
                // Cookie is used by backend to authorize protected HTML routes (cart/checkout/admin pages).
                .andExpect(header().string("Set-Cookie", containsString("TS_ACCESS_TOKEN=")))
                .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
                .andExpect(header().string("Set-Cookie", containsString("SameSite=Lax")));
    }

    @Test
    void adminDashboardShouldRedirectAnonymousUsersToLogin() throws Exception {
        mockMvc.perform(get("/admin/dashboard").accept(MediaType.TEXT_HTML))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/login"));
    }
}

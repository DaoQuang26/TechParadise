package com.techstore1.techstore1.service;

import com.techstore1.techstore1.dto.AdminCreateUserRequest;
import com.techstore1.techstore1.dto.AdminUpdateUserRequest;
import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.enums.Role;
import com.techstore1.techstore1.repository.CartItemRepository;
import com.techstore1.techstore1.repository.OrderRepository;
import com.techstore1.techstore1.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserManagementService {

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final CartItemRepository cartItemRepository;
    private final PasswordEncoder passwordEncoder;

    public UserManagementService(
            UserRepository userRepository,
            OrderRepository orderRepository,
            CartItemRepository cartItemRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
        this.cartItemRepository = cartItemRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<User> findAllUsers() {
        return userRepository.findAll();
    }

    public Page<User> findUsersPaged(int page, int size, String keyword, String sortDir) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        if (normalizedKeyword.isBlank()) {
            normalizedKeyword = null;
        }
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDir) ? Sort.Direction.DESC : Sort.Direction.ASC;

        // Sort by id for stable paging and easy auditing; direction comes from admin filter.
        PageRequest pageable = PageRequest.of(safePage, safeSize, Sort.by(direction, "id"));
        return userRepository.searchAdminUsers(normalizedKeyword, pageable);
    }

    public User findUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản"));
    }

    @Transactional
    public User createUser(AdminCreateUserRequest request, boolean allowCreateAdminRole) {
        String fullName = normalizeRequired(request.getFullName(), "Họ và tên không được để trống");
        String username = normalizeRequired(request.getUsername(), "Tên đăng nhập không được để trống");
        String email = normalizeRequired(request.getEmail(), "Email không được để trống").toLowerCase();
        String rawPassword = normalizePassword(request.getPassword());
        String phone = normalizeOptional(request.getPhone());
        String address = normalizeOptional(request.getAddress());

        Role role = request.getRole() == null ? Role.CUSTOMER : request.getRole();
        if (role == Role.SUPER_ADMIN) {
            throw new IllegalArgumentException("Không thể tạo tài khoản SUPER_ADMIN từ API");
        }
        if (role == Role.ADMIN && !allowCreateAdminRole) {
            throw new IllegalArgumentException("Bạn không có quyền tạo tài khoản ADMIN");
        }

        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new IllegalArgumentException("Tên đăng nhập đã tồn tại");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email đã tồn tại");
        }

        User user = new User();
        user.setFullName(fullName);
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setPhone(phone);
        user.setAddress(address);
        user.setRole(role);
        user.setFailedLoginAttempts(0);
        user.setLockoutUntil(null);
        user.setLastLoginAt(null);
        user.setActive(true);
        return userRepository.save(user);
    }

    @Transactional
    public User updateUserInfo(Long id, AdminUpdateUserRequest request) {
        User user = findUserById(id);

        String fullName = normalizeRequired(request.getFullName(), "Họ và tên không được để trống");
        String username = normalizeRequired(request.getUsername(), "Tên đăng nhập không được để trống");
        String email = normalizeRequired(request.getEmail(), "Email không được để trống").toLowerCase();
        String phone = normalizeOptional(request.getPhone());
        String address = normalizeOptional(request.getAddress());

        userRepository.findByUsernameIgnoreCase(username)
                .filter(existing -> !existing.getId().equals(user.getId()))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Tên đăng nhập đã tồn tại");
                });

        userRepository.findByEmailIgnoreCase(email)
                .filter(existing -> !existing.getId().equals(user.getId()))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Email đã tồn tại");
                });

        user.setFullName(fullName);
        user.setUsername(username);
        user.setEmail(email);
        user.setPhone(phone);
        user.setAddress(address);
        return userRepository.save(user);
    }

    @Transactional
    public void deleteCustomer(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản"));

        if (user.getRole() != Role.CUSTOMER) {
            throw new IllegalArgumentException("Chỉ được xóa tài khoản khách hàng");
        }

        long orderCount = orderRepository.countByUserId(id);
        if (orderCount > 0) {
            throw new IllegalArgumentException("Không thể xóa tài khoản vì khách hàng đã có đơn hàng");
        }

        // Dọn cart trước để tránh lỗi khóa ngoại khi xóa user.
        cartItemRepository.deleteByUserId(id);
        userRepository.deleteById(id);
    }

    public User updateRole(Long id, Role role) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản"));

        if (role == Role.SUPER_ADMIN) {
            throw new IllegalArgumentException("Không thể gán role SUPER_ADMIN từ API");
        }

        user.setRole(role);
        return userRepository.save(user);
    }

    @Transactional
    public User updateActiveStatus(Long id, boolean active, boolean actorIsSuperAdmin, String actorUsername) {
        User user = findUserById(id);
        ensureStateManageableUser(user, actorIsSuperAdmin);

        if (!active && isSameActor(user, actorUsername)) {
            throw new IllegalArgumentException("Khong the tu tat trang thai hoat dong cua chinh minh.");
        }

        boolean currentActive = !Boolean.FALSE.equals(user.getActive());
        if (currentActive == active) {
            return user;
        }

        user.setActive(active);
        return userRepository.save(user);
    }

    @Transactional
    public User unlockUser(Long id, boolean actorIsSuperAdmin) {
        User user = findUserById(id);
        ensureStateManageableUser(user, actorIsSuperAdmin);

        user.setFailedLoginAttempts(0);
        user.setLockoutUntil(null);
        return userRepository.save(user);
    }

    private void ensureStateManageableUser(User user, boolean actorIsSuperAdmin) {
        if (user.getRole() == Role.SUPER_ADMIN) {
            throw new IllegalArgumentException("Khong cho phep thao tac trang thai tren tai khoan SUPER_ADMIN.");
        }
        if (!actorIsSuperAdmin && user.getRole() != Role.CUSTOMER) {
            throw new IllegalArgumentException("Ban chi co quyen thao tac trang thai voi tai khoan CUSTOMER.");
        }
    }

    private boolean isSameActor(User user, String actorUsername) {
        if (user == null || actorUsername == null) {
            return false;
        }
        String target = user.getUsername() == null ? "" : user.getUsername().trim();
        String actor = actorUsername.trim();
        if (target.isBlank() || actor.isBlank()) {
            return false;
        }
        return target.equalsIgnoreCase(actor);
    }

    private String normalizeRequired(String raw, String message) {
        String value = raw == null ? "" : raw.trim();
        if (value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    private String normalizeOptional(String raw) {
        String value = raw == null ? "" : raw.trim();
        return value.isBlank() ? null : value;
    }

    private String normalizePassword(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.length() < 6 || value.length() > 100) {
            throw new IllegalArgumentException("Mật khẩu phải từ 6 đến 100 ký tự");
        }
        return value;
    }
}

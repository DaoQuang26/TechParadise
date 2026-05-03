package com.techstore1.techstore1.repository;

import com.techstore1.techstore1.entity.User;
import com.techstore1.techstore1.enums.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByUsername(String username);

    Optional<User> findByUsernameIgnoreCase(String username);

    List<User> findByRole(Role role);

    boolean existsByUsername(String username);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);

    @Query("""
            select u
            from User u
            where (
                    :keyword is null
                    or lower(coalesce(u.fullName, '')) like lower(concat('%', :keyword, '%'))
                    or lower(u.username) like lower(concat('%', :keyword, '%'))
                    or lower(u.email) like lower(concat('%', :keyword, '%'))
                    or str(u.id) like concat('%', :keyword, '%')
                  )
            """)
    Page<User> searchAdminUsers(@Param("keyword") String keyword, Pageable pageable);

}

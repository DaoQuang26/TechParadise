package com.techstore1.techstore1.repository;

import com.techstore1.techstore1.entity.AdminAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {

    @Query("""
            select l
            from AdminAuditLog l
            where (:action is null or lower(l.action) = lower(:action))
              and (:targetType is null or lower(l.targetType) = lower(:targetType))
              and (
                    :keyword is null
                    or lower(l.actorUsername) like lower(concat('%', :keyword, '%'))
                    or lower(coalesce(l.message, '')) like lower(concat('%', :keyword, '%'))
                    or str(l.targetId) like concat('%', :keyword, '%')
                  )
            """)
    Page<AdminAuditLog> searchAdminAuditLogs(
            @Param("action") String action,
            @Param("targetType") String targetType,
            @Param("keyword") String keyword,
            Pageable pageable
    );
}


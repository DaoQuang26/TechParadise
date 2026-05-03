package com.techstore1.techstore1.repository;

import com.techstore1.techstore1.entity.SupportMessage;
import com.techstore1.techstore1.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SupportMessageRepository extends JpaRepository<SupportMessage, Long> {

    List<SupportMessage> findByCustomerIdOrderByCreatedAtAscIdAsc(Long customerId);

    Optional<SupportMessage> findTopByCustomerIdOrderByCreatedAtDescIdDesc(Long customerId);

    @Query("""
            select m
            from SupportMessage m
            where m.id in (
                select max(m2.id)
                from SupportMessage m2
                group by m2.customer.id
            )
            order by m.id desc
            """)
    List<SupportMessage> findLatestByCustomerConversation();

    long countByCustomerIdAndSenderRoleAndReadByAdminFalse(Long customerId, Role senderRole);

    @Query("""
            select count(m)
            from SupportMessage m
            where m.customer.id = :customerId
                and m.senderRole in :senderRoles
                and m.readByCustomer = false
            """)
    long countUnreadForCustomer(
            @Param("customerId") Long customerId,
            @Param("senderRoles") Collection<Role> senderRoles
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update SupportMessage m
            set m.readByAdmin = true
            where m.customer.id = :customerId
                and m.senderRole = :senderRole
                and m.readByAdmin = false
            """)
    int markCustomerMessagesReadByAdmin(
            @Param("customerId") Long customerId,
            @Param("senderRole") Role senderRole
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update SupportMessage m
            set m.readByCustomer = true
            where m.customer.id = :customerId
                and m.senderRole in :senderRoles
                and m.readByCustomer = false
            """)
    int markAdminMessagesReadByCustomer(
            @Param("customerId") Long customerId,
            @Param("senderRoles") Collection<Role> senderRoles
    );
}

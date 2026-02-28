package com.example.farmacia_backend.notifications;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface NotificationRepository extends JpaRepository<NotificationEntity, Long> {

    List<NotificationEntity> findByIdUsuarioOrderByCreadoEnDesc(Long idUsuario, Pageable pageable);

    List<NotificationEntity> findByIdUsuarioAndLeidoEnIsNullOrderByCreadoEnDesc(Long idUsuario, Pageable pageable);

    long countByIdUsuarioAndLeidoEnIsNull(Long idUsuario);

    @Modifying
    @Query("""
        update NotificationEntity n
           set n.leidoEn = :now
         where n.idNotificacion = :id
           and n.idUsuario      = :userId
           and n.leidoEn is null
    """)
    int markRead(@Param("userId") Long userId,
                 @Param("id")     Long id,
                 @Param("now")    OffsetDateTime now);

    @Modifying
    @Query("""
        update NotificationEntity n
           set n.leidoEn = :now
         where n.idUsuario = :userId
           and n.leidoEn is null
    """)
    int markAllRead(@Param("userId") Long userId,
                    @Param("now")    OffsetDateTime now);
}
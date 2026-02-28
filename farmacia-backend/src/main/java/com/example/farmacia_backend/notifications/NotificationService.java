package com.example.farmacia_backend.notifications;

import com.example.farmacia_backend.notifications.dto.NotificationDtos.NotificationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository repo;

    @Transactional(readOnly = true)
    public List<NotificationResponse> list(Long userId, boolean unreadOnly, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        var pageable  = PageRequest.of(0, safeLimit);

        List<NotificationEntity> rows = unreadOnly
                ? repo.findByIdUsuarioAndLeidoEnIsNullOrderByCreadoEnDesc(userId, pageable)
                : repo.findByIdUsuarioOrderByCreadoEnDesc(userId, pageable);

        return rows.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        return repo.countByIdUsuarioAndLeidoEnIsNull(userId);
    }

    @Transactional
    public void markRead(Long userId, Long idNotificacion) {
        repo.markRead(userId, idNotificacion, OffsetDateTime.now());
    }

    @Transactional
    public int markAllRead(Long userId) {
        return repo.markAllRead(userId, OffsetDateTime.now());
    }

    /**
     * Crea una notificación ignorando silenciosamente duplicados (misma userId + dedupeKey).
     * Usado tanto por los jobs programados como por eventos internos.
     */
    @Transactional
    public void create(Long userId, NotificationType tipo,
                       String titulo, String mensaje,
                       String actionUrl, String dataJson, String dedupeKey) {
        try {
            repo.save(NotificationEntity.builder()
                    .idUsuario(userId)
                    .tipo(tipo)
                    .titulo(titulo)
                    .mensaje(mensaje)
                    .actionUrl(actionUrl)
                    .dataJson(dataJson)
                    .dedupeKey(dedupeKey)
                    .build());
        } catch (DataIntegrityViolationException ignored) {
            // Notificación duplicada (userId + dedupeKey ya existe) → se ignora silenciosamente
        }
    }

    // ─── Helper privado ───────────────────────────────────────────────────────
    private NotificationResponse toResponse(NotificationEntity n) {
        return new NotificationResponse(
                n.getIdNotificacion(),
                n.getTipo(),
                n.getTitulo(),
                n.getMensaje(),
                n.getDataJson(),
                n.getActionUrl(),
                n.getCreadoEn(),
                n.getLeidoEn()
        );
    }
}
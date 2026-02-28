package com.example.farmacia_backend.notifications.dto;

import com.example.farmacia_backend.notifications.NotificationType;

import java.time.OffsetDateTime;

public class NotificationDtos {

    public record NotificationResponse(
            Long             idNotificacion,
            NotificationType tipo,
            String           titulo,
            String           mensaje,
            String           dataJson,
            String           actionUrl,
            OffsetDateTime   creadoEn,
            OffsetDateTime   leidoEn
    ) {}

    public record UnreadCountResponse(
            long unread
    ) {}
}
package com.example.farmacia_backend.notifications;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@Entity
@Table(
        name = "notificaciones",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_notif_user_dedupe", columnNames = {"id_usuario", "dedupe_key"})
        },
        indexes = {
                @Index(name = "ix_notif_user_created", columnList = "id_usuario, creado_en"),
                @Index(name = "ix_notif_user_read",    columnList = "id_usuario, leido_en")
        }
)
public class NotificationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_notificacion")
    private Long idNotificacion;

    @Column(name = "id_usuario", nullable = false)
    private Long idUsuario;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo", nullable = false, length = 40)
    private NotificationType tipo;

    @Column(name = "titulo", nullable = false, length = 140)
    private String titulo;

    @Column(name = "mensaje", nullable = false, length = 500)
    private String mensaje;

    @Column(name = "data_json", columnDefinition = "text")
    private String dataJson;

    @Column(name = "action_url", length = 255)
    private String actionUrl;

    @Column(name = "dedupe_key", nullable = false, length = 120)
    private String dedupeKey;

    @CreationTimestamp
    @Column(name = "creado_en", nullable = false, updatable = false)
    private OffsetDateTime creadoEn;

    @Column(name = "leido_en")
    private OffsetDateTime leidoEn;
}
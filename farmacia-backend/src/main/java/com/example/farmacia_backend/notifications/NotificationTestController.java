package com.example.farmacia_backend.notifications;

import com.example.farmacia_backend.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * CORRECCIÓN #2: Endpoint de prueba separado en su propio controller con @Profile("dev").
 * Solo existe en el contexto de Spring cuando el perfil activo es "dev".
 * En producción (perfil "prod" o sin perfil) este controller no se registra.
 *
 * Para activarlo: spring.profiles.active=dev en application.yml (local)
 */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Profile("dev")
public class NotificationTestController {

    private final CurrentUserService  currentUser;
    private final NotificationService service;

    @PostMapping("/_test")
    public ResponseEntity<Void> testCreate() {
        service.create(
                currentUser.requireUserId(),
                NotificationType.SISTEMA,
                "Prueba de notificación",
                "Si ves esto en el navbar, ya quedó el backend.",
                "/dashboard",
                "{\"ok\":true}",
                "TEST:ONCE"
        );
        return ResponseEntity.ok().build();
    }
}
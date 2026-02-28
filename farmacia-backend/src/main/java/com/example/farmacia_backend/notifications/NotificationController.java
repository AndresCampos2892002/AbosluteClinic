package com.example.farmacia_backend.notifications;

import com.example.farmacia_backend.notifications.dto.NotificationDtos.NotificationResponse;
import com.example.farmacia_backend.notifications.dto.NotificationDtos.UnreadCountResponse;
import com.example.farmacia_backend.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class NotificationController {

    private final CurrentUserService currentUser;
    private final NotificationService service;

    // Listar notificaciones del usuario autenticado
    @GetMapping
    public ResponseEntity<List<NotificationResponse>> list(
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(defaultValue = "20")    int    limit) {
        return ResponseEntity.ok(service.list(currentUser.requireUserId(), unreadOnly, limit));
    }

    // Contador de no leídas (para el badge del navbar)
    @GetMapping("/unread-count")
    public ResponseEntity<UnreadCountResponse> unreadCount() {
        long count = service.unreadCount(currentUser.requireUserId());
        return ResponseEntity.ok(new UnreadCountResponse(count));
    }

    // Marcar una notificación como leída
    @PostMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable Long id) {
        service.markRead(currentUser.requireUserId(), id);
        return ResponseEntity.ok().build();
    }

    // Marcar todas como leídas
    @PostMapping("/read-all")
    public ResponseEntity<Void> readAll() {
        service.markAllRead(currentUser.requireUserId());
        return ResponseEntity.ok().build();
    }

}
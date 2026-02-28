package com.example.farmacia_backend.users.event;

/**
 * Evento de dominio para desacoplar UserService de EspecialistaService.
 *
 * En lugar de que UserService inyecte directamente EspecialistaService
 * (acoplamiento fuerte entre módulos), publicamos un evento.
 * EspecialistaService escucha ese evento y reacciona de forma independiente.
 *
 * Flujo:
 *   UserService → publica UserStatusChangedEvent
 *   EspecialistaService → @EventListener escucha y actúa
 *
 * Ventaja: UserService no sabe nada de EspecialistaService. Si mañana
 * necesitas notificar a otro módulo (ej: Citas), solo agregas otro listener.
 */
public record UserStatusChangedEvent(Long idUsuario, boolean activo) {}
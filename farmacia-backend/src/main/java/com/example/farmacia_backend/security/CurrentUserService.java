package com.example.farmacia_backend.security;

import com.example.farmacia_backend.users.exception.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserService {

    /**
     * Retorna el principal autenticado del request actual.
     * Lanza 401 si no hay sesión activa.
     */
    public AuthenticatedUser requireAuthenticatedUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !auth.isAuthenticated()
                || !(auth.getPrincipal() instanceof AuthenticatedUser user)) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "No autenticado");
        }
        return user;
    }

    /**
     * Shortcut para obtener solo el idUsuario.
     * El más usado en los servicios.
     */
    public Long requireUserId() {
        return requireAuthenticatedUser().getIdUsuario();
    }

    /**
     * Shortcut para obtener el username (subject del JWT).
     */
    public String requireUsername() {
        return requireAuthenticatedUser().getUsername();
    }

    /**
     * Shortcut para obtener el rol.
     */
    public String requireRol() {
        return requireAuthenticatedUser().getRol();
    }
}
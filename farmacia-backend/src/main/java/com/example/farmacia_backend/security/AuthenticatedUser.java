package com.example.farmacia_backend.security;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.util.List;

/**
 *
 * Se construye en JwtAuthFilter a partir de los claims del token,
 * SIN hacer ninguna consulta a la base de datos.
 *
 * Esto permite que @PreAuthorize use authentication.principal.idUsuario:
 *   @PreAuthorize("hasRole('ESPECIALISTA') and #id == authentication.principal.idUsuario")
 *
 * También permite que CurrentUserService obtenga el idUsuario
 * directamente del contexto de seguridad, sin ir a la BD.
 */
public class AuthenticatedUser extends User {

    private final Long   idUsuario;
    private final String rol;

    public AuthenticatedUser(String username, Long idUsuario, String rol) {
        super(
            username,
            "", // sin password en el contexto de seguridad
            List.of(new SimpleGrantedAuthority("ROLE_" + rol))
        );
        this.idUsuario = idUsuario;
        this.rol       = rol;
    }

    public Long   getIdUsuario() { return idUsuario; }
    public String getRol()       { return rol; }
}
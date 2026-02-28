package com.example.farmacia_backend.users;

/**
 * Roles del sistema.
 * El valor guardado en BD (usuarios.rol) coincide con el nombre del enum.
 * Ej: "SUPER_ADMIN", "ADMIN", "CAJA", "SECRETARIA", "ESPECIALISTA"
 */
public enum Role {
    SUPER_ADMIN,
    ADMIN,
    CAJA,
    SECRETARIA,
    ESPECIALISTA
}
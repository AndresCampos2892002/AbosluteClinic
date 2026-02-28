package com.example.farmacia_backend.users.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Excepción de negocio reutilizable en todo el módulo users.
 * Reemplaza los RuntimeException genéricos que devolvían 500.
 *
 * Uso:
 *   throw new BusinessException(HttpStatus.NOT_FOUND,    "Usuario no encontrado");
 *   throw new BusinessException(HttpStatus.BAD_REQUEST,  "El correo ya existe");
 *   throw new BusinessException(HttpStatus.FORBIDDEN,    "No tienes permiso");
 */
public class BusinessException extends ResponseStatusException {

    public BusinessException(HttpStatus status, String reason) {
        super(status, reason);
    }
}
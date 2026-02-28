package com.example.farmacia_backend.auth.dto;

/**
 * Respuesta del login: token + rol.
 */
public record LoginResponse(String token, String role) {


}

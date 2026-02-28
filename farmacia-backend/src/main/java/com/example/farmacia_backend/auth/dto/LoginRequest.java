package com.example.farmacia_backend.auth.dto;

/**
 * Request de login.
 * { "username":"admin", "password":"Admin123*" }
 * username puede ser usuario o correo.
 */
public record LoginRequest(String usuario, String contrasena) {}
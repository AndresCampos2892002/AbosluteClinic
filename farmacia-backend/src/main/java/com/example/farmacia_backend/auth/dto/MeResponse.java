package com.example.farmacia_backend.auth.dto;

public record MeResponse(
        Long   idUsuario,
        String usuario,
        String correo,
        String nombre,
        String apellido,
        String rol,
        Long   idSucursal,
        String telefono
) {}
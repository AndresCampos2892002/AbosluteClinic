package com.example.farmacia_backend.especialistas.dto;

import java.time.OffsetDateTime;

/**
 * Incluye nombre, apellido y correo del usuario asociado.
 * El frontend no necesita hacer una segunda llamada a /api/users/{id}
 * para mostrar los datos completos del especialista.
 */
public record EspecialistaResponse(
        Long            especialistaId,
        String          especialidad,
        boolean         estado,
        OffsetDateTime  creadoEn,
        OffsetDateTime  actualizadoEn,
        // Datos del usuario asociado
        String          nombre,
        String          apellido,
        String          correo,
        String          telefono
) {}
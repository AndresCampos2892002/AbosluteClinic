package com.example.farmacia_backend.pacientes.expediente.dto;

/**
 * Datos de una cita dentro del expediente del paciente.
 * Los campos de fecha vienen como String desde la query nativa PostgreSQL.
 */
public record ExpedienteCitaDto(
        Long    idCita,
        Long    idSucursal,
        String  sucursalNombre,
        Long    idPaciente,
        Long    idServicio,
        String  servicioNombre,
        Long    idEspecialista,
        String  especialistaNombre,
        String  fechaInicio,
        String  fechaFin,
        Integer duracionMinutos,
        String  estado,
        String  canal,
        String  motivo,
        String  notas
) {}
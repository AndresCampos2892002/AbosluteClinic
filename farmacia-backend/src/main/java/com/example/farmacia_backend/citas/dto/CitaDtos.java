package com.example.farmacia_backend.citas.dto;

import com.example.farmacia_backend.citas.CitaEstado;

import java.time.OffsetDateTime;

public class CitaDtos {
    /**
     * Response de cita — record inmutable.
     */
    public record CitaResponse(
            Long           idCita,
            Long           idSucursal,
            Long           idPaciente,
            Long           idServicio,
            Long           idEspecialista,
            OffsetDateTime fechaInicio,
            OffsetDateTime fechaFin,
            Integer        duracionMinutos,
            CitaEstado     estado,
            String         canal,
            String         motivo,
            String         notas,
            OffsetDateTime creadoEn,
            Long           creadoPor,
            OffsetDateTime actualizadoEn,
            Long           actualizadoPor
    ) {}
    public record CambiarEstadoRequest(
            CitaEstado estado,
            String     nota
    ) {}
}
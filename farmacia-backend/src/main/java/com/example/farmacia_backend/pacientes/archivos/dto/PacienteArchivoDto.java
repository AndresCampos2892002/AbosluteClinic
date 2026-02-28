package com.example.farmacia_backend.pacientes.archivos.dto;

import java.time.OffsetDateTime;

public record PacienteArchivoDto(
        Long           idArchivo,
        Long           idPaciente,
        Long           idCita,
        String         titulo,
        String         tipo,
        String         filename,
        String         mime,
        Long           sizeBytes,
        Boolean        activo,
        Long           creadoPor,
        OffsetDateTime creadoEn
) {}
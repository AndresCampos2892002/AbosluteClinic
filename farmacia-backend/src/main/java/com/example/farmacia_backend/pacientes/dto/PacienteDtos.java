package com.example.farmacia_backend.pacientes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public class PacienteDtos {

    // ─── Create ──────────────────────────────────────────────────────────────

    public record Create(
            @NotBlank(message = "Nombres es obligatorio")
            @Size(min = 2, max = 120)
            String nombres,

            @Size(max = 120)
            String apellidos,

            @Size(max = 20)
            String telefono,

            @Size(max = 160)
            String correo,

            @Size(max = 25)
            String nit,

            @Size(max = 25)
            String dpi,

            @Size(max = 220)
            String direccion
    ) {}

    // ─── Update ───────────────────────────────────────────────────────────────
    // Todos opcionales: si vienen null no se modifican.

    public record Update(
            @Size(min = 2, max = 120)
            String nombres,

            @Size(max = 120)
            String apellidos,

            @Size(max = 20)
            String telefono,

            @Size(max = 160)
            String correo,

            @Size(max = 25)
            String nit,

            @Size(max = 25)
            String dpi,

            @Size(max = 220)
            String direccion
    ) {}

    // ─── Response ─────────────────────────────────────────────────────────────

    public record Response(
            Long           idPaciente,
            String         nombres,
            String         apellidos,
            String         telefono,
            String         correo,
            String         nit,
            String         dpi,
            String         direccion,
            Boolean        activo,
            Long           creadoPor,
            String         creadoPorNombre,
            Long           idSucursalCreado,
            String         sucursalNombre,
            OffsetDateTime creadoEn,     
            OffsetDateTime actualizadoEn   
    ) {}
}
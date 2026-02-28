package com.example.farmacia_backend.servicios.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public class ServicioDtos {

    // ─── Create ──────────────────────────────────────────────────────────────

    public record Create(
            @NotBlank(message = "El nombre es requerido")
            @Size(min = 2, max = 160)
            String nombre,

            @Size(max = 500)
            String descripcion,

            // Opcional: si viene, crea el precio inicial
            BigDecimal precioInicial,
            String moneda // GTQ por defecto
    ) {}

    // ─── Update ───────────────────────────────────────────────────────────────

    public record Update(
            @Size(min = 2, max = 160)
            String nombre,

            @Size(max = 500)
            String descripcion,

            Boolean activo
    ) {}

    // ─── PrecioRequest ────────────────────────────────────────────────────────

    public record PrecioRequest(
            @NotNull(message = "El precio es requerido")
            BigDecimal precio,

            String moneda // GTQ por defecto
    ) {}

    // ─── PrecioResponse ───────────────────────────────────────────────────────

    public record PrecioResponse(
            Long           idServicioPrecio,
            BigDecimal     precio,
            String         moneda,
            OffsetDateTime vigenteDesde,   
            OffsetDateTime vigenteHasta
    ) {}

    // ─── Response ─────────────────────────────────────────────────────────────
    public record Response(
            Long           idServicio,
            String         nombre,
            String         descripcion,
            Boolean        activo,
            BigDecimal     precioActual,
            String         moneda,
            Long           creadoPor,
            OffsetDateTime creadoEn,       
            OffsetDateTime actualizadoEn
    ) {}
}
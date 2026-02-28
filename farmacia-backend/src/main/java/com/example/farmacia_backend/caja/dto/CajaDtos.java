package com.example.farmacia_backend.caja.dto;

import com.example.farmacia_backend.caja.EstadoPago;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * CobroItemDto y CobroPagoDto se mantienen como clases con @Builder porque
 * se construyen en el service con el patrón builder Y se deserializan desde JSON (BD).
 * Los records no soportan bien ambos casos simultáneamente con Jackson sin config extra.
 */
public class CajaDtos {

    // ─── Items del cobro ─────────────────────────────────────────────────────
    /**
     * Un ítem dentro del cobro (servicio prestado).
     * Se serializa a JSONB en la BD y se deserializa al leer.
     * Clase mutable necesaria para Jackson + Builder.
     */
    public static class CobroItemDto {
        public Long       idServicio;
        public String     nombre;
        public Integer    cantidad;
        public BigDecimal precioUnitario;
        public BigDecimal subtotal;

        public CobroItemDto() {}

        public CobroItemDto(Long idServicio, String nombre, Integer cantidad,
                            BigDecimal precioUnitario, BigDecimal subtotal) {
            this.idServicio     = idServicio;
            this.nombre         = nombre;
            this.cantidad       = cantidad;
            this.precioUnitario = precioUnitario;
            this.subtotal       = subtotal;
        }
    }

    // ─── Pagos (abonos) ───────────────────────────────────────────────────────

    /**
     * Un pago/abono registrado. Se serializa a JSONB en la BD.
     */
    public static class CobroPagoDto {
        public OffsetDateTime fecha;
        public BigDecimal     monto;
        public String         metodo;
        public String         referencia;

        public CobroPagoDto() {}

        public CobroPagoDto(OffsetDateTime fecha, BigDecimal monto,
                            String metodo, String referencia) {
            this.fecha      = fecha;
            this.monto      = monto;
            this.metodo     = metodo;
            this.referencia = referencia;
        }
    }

    // ─── Requests ─────────────────────────────────────────────────────────────

    /**
     * Actualizar items del cobro (PUT /caja/citas/{id}/cobro).
     */
    public record CobroUpsertRequest(
            String moneda,
            List<CobroItemDto> items
    ) {}

    /**
     * Registrar un pago/abono (POST /caja/citas/{id}/cobro/pagar).
     */
    public record CobroPagarRequest(
            @NotNull @Positive
            BigDecimal monto,

            String metodo,    // EFECTIVO, TARJETA, TRANSFERENCIA — default EFECTIVO
            String referencia // número de voucher, referencia bancaria, etc.
    ) {}

    // ─── Response ─────────────────────────────────────────────────────────────

    /** * Response completo del cobro de una cita.     */
    public record CobroResponse(
            Long                idCobro,
            Long                idCita,
            String              moneda,
            List<CobroItemDto>  items,
            List<CobroPagoDto>  pagos,
            BigDecimal          total,
            BigDecimal          pagado,
            BigDecimal          saldo,
            EstadoPago          estadoPago,
            OffsetDateTime      actualizadoEn
    ) {}
}
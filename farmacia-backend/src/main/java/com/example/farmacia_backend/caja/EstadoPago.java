package com.example.farmacia_backend.caja;

/**
 * Evita errores como "PAGADOO" o "pagado" que pasarían silenciosamente.
 */
public enum EstadoPago {
    PENDIENTE,
    PARCIAL,
    PAGADO
}
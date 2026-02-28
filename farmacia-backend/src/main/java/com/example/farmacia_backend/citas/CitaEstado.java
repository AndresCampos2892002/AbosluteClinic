package com.example.farmacia_backend.citas;

public enum CitaEstado {
    PENDIENTE,
    CONFIRMADA,
    REPROGRAMADA,
    TERMINADA,
    CANCELADA,
    NO_ASISTIO;

    public static CitaEstado fromLegacy(String v) {
        if (v == null) return PENDIENTE;
        String x = v.trim().toUpperCase();
        return switch (x) {
            case "TERMINADA" -> TERMINADA;
            default          -> CitaEstado.valueOf(x);
        };
    }

    // TODO: implementar lógica de cobro cuando el frontend lo requiera
    public enum CancelacionCobro {
        PAGO_INMEDIATO,
        CUENTA_POR_COBRAR
    }
}
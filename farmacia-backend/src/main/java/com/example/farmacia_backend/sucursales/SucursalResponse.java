package com.example.farmacia_backend.sucursales.dto;

import java.time.OffsetDateTime;

public record SucursalResponse(
        Long           idSucursal,
        String         nombre,
        String         direccion,
        boolean        estado,
        OffsetDateTime creadoEn
) {}
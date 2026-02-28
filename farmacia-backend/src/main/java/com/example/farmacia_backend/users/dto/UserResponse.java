package com.example.farmacia_backend.users.dto;

import com.example.farmacia_backend.users.Role;
import java.time.OffsetDateTime;

public record UserResponse(
        Long            idUsuario,
        String          usuario,
        String          correo,
        Role            rol,
        String          nombre,
        String          apellido,
        String          telefono,
        boolean         estado,
        Long            idSucursal,
        OffsetDateTime  creadoEn,
        OffsetDateTime  actualizadoEn
) {}
package com.example.farmacia_backend.users.dto;

import com.example.farmacia_backend.users.Role;
import jakarta.validation.constraints.*;

/**
 * Request para actualizar usuario.
 * Todos los campos son opcionales: si vienen null, no se modifican.
 */
public record UserUpdateRequest(

        @Email(message = "El correo no tiene un formato válido")
        @Size(max = 120)
        String correo,

        @Size(min = 6, max = 80, message = "La contraseña debe tener entre 6 y 80 caracteres")
        String password,

        Role rol,

        @Size(max = 80)
        String nombre,

        @Size(max = 80)
        String apellido,

        @Size(max = 25)
        String telefono,

        Long idSucursal

) {}
package com.example.farmacia_backend.users.dto;

import com.example.farmacia_backend.users.Role;
import jakarta.validation.constraints.*;

/**
 * Request para crear usuario.
 */
public record UserCreateRequest(

        @NotBlank(message = "El usuario es requerido")
        @Size(min = 3, max = 60, message = "El usuario debe tener entre 3 y 60 caracteres")
        String usuario,

        @NotBlank(message = "El correo es requerido")
        @Email(message = "El correo no tiene un formato válido")
        @Size(max = 120)
        String correo,

        @NotBlank(message = "La contraseña es requerida")
        @Size(min = 6, max = 80, message = "La contraseña debe tener entre 6 caracteres")
        String password,

        @NotNull(message = "El rol es requerido")
        Role rol,

        @NotBlank(message = "El nombre es requerido")
        @Size(max = 80)
        String nombre,

        @NotBlank(message = "El apellido es requerido")
        @Size(max = 80)
        String apellido,

        @Size(max = 25)
        String telefono,

        @NotNull(message = "La sucursal es requerida")
        Long idSucursal

) {}
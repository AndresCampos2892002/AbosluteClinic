package com.example.farmacia_backend.auth.passwordreset.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordResetValidateRequest(
        @NotBlank @Email                  String correo,
        @NotBlank @Size(min = 6, max = 6) String code
) {}
package com.example.farmacia_backend.especialistas.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EspecialistaUpsertRequest(
        @NotBlank(message = "La especialidad es requerida")
        @Size(max = 120, message = "Máximo 120 caracteres")
        String especialidad
) {}
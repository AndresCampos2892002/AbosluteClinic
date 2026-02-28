package com.example.farmacia_backend.pacientes.expediente.dto;

import com.example.farmacia_backend.pacientes.archivos.dto.PacienteArchivoDto;
import com.example.farmacia_backend.pacientes.dto.PacienteDtos;

import java.util.List;

public record PacienteExpedienteDto(
        PacienteDtos.Response       paciente,
        List<ExpedienteCitaDto>     citas,
        List<PacienteArchivoDto>    archivos
) {}
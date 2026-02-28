package com.example.farmacia_backend.pacientes.expediente;

import com.example.farmacia_backend.pacientes.expediente.dto.PacienteExpedienteDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/pacientes")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','ESPECIALISTA')")
public class PacienteExpedienteController {

    private final PacienteExpedienteService service;

    @GetMapping("/{idPaciente}/expediente")
    public ResponseEntity<PacienteExpedienteDto> expediente(
            @PathVariable Long idPaciente,
            @RequestParam(defaultValue = "false") boolean inactivos) {
        return ResponseEntity.ok(service.obtenerExpediente(idPaciente, inactivos));
    }
}
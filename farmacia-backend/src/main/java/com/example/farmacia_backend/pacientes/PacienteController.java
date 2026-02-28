package com.example.farmacia_backend.pacientes;

import com.example.farmacia_backend.pacientes.dto.PacienteDtos;
import com.example.farmacia_backend.pacientes.PacienteService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pacientes")
public class PacienteController {

    private final PacienteService service;

    public PacienteController(PacienteService service) {
        this.service = service;
    }

    // SUPER_ADMIN, ADMIN, ESPECIALISTA ven pacientes
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','ESPECIALISTA')")
    @GetMapping
    public List<PacienteDtos.Response> listarActivos() {
        return service.listarActivos();
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','ESPECIALISTA')")
    @GetMapping("/all")
    public List<PacienteDtos.Response> listarTodos() {
        return service.listarTodos();
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','ESPECIALISTA')")
    @GetMapping("/{id}")
    public PacienteDtos.Response obtener(@PathVariable Long id) {
        return service.obtener(id);
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','ESPECIALISTA')")
    @PostMapping
    public PacienteDtos.Response crear(@Valid @RequestBody PacienteDtos.Create req) {
        return service.crear(req);
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','ESPECIALISTA')")
    @PutMapping("/{id}")
    public PacienteDtos.Response editar(@PathVariable Long id, @Valid @RequestBody PacienteDtos.Update req) {
        return service.editar(id, req);
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','ESPECIALISTA')")
    @PatchMapping("/{id}/inactivar")
    public void inactivar(@PathVariable Long id) {
        service.inactivar(id);
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','ESPECIALISTA')")
    @PatchMapping("/{id}/reactivar")
    public void reactivar(@PathVariable Long id) {
        service.reactivar(id);
    }
}

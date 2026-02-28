package com.example.farmacia_backend.citas;

import com.example.farmacia_backend.citas.dto.CitaDtos.CitaResponse;
import com.example.farmacia_backend.citas.dto.CitaDtos.CambiarEstadoRequest;
import com.example.farmacia_backend.citas.dto.CitaRequest;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/citas")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','ESPECIALISTA','SECRETARIA')")
public class CitasController {

    private final CitaService service;

    public CitasController(CitaService service) {
        this.service = service;
    }

    // GET /api/citas?desde=...&hasta=...&idSucursal=...
    @GetMapping
    public ResponseEntity<List<CitaResponse>> listar(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime hasta,
            @RequestParam(required = false) Long idSucursal) {
        return ResponseEntity.ok(service.listar(desde, hasta, idSucursal));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CitaResponse> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(service.obtener(id));
    }

    @PostMapping
    public ResponseEntity<CitaResponse> crear(@Valid @RequestBody CitaRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.crear(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CitaResponse> editar(
            @PathVariable Long id,
            @Valid @RequestBody CitaRequest req) {
        return ResponseEntity.ok(service.editar(id, req));
    }

    // PATCH /api/citas/{id}/estado  body: { "estado": "CANCELADA", "nota": "..." }
    @PatchMapping("/{id}/estado")
    public ResponseEntity<CitaResponse> cambiarEstado(
            @PathVariable Long id,
            @RequestBody CambiarEstadoRequest req) {
        return ResponseEntity.ok(service.cambiarEstado(id, req.estado(), req.nota()));
    }
}
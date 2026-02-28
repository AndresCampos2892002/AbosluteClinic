package com.example.farmacia_backend.servicios;

import com.example.farmacia_backend.servicios.dto.ServicioDtos;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/servicios")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','ESPECIALISTA')")
public class ServicioController {

    private final ServicioService service;

    public ServicioController(ServicioService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<ServicioDtos.Response>> listarActivos() {
        return ResponseEntity.ok(service.listarActivos());
    }

    @GetMapping("/all")
    public ResponseEntity<List<ServicioDtos.Response>> listarTodos() {
        return ResponseEntity.ok(service.listarTodos());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ServicioDtos.Response> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(service.obtener(id));
    }

    @PostMapping
    public ResponseEntity<ServicioDtos.Response> crear(@Valid @RequestBody ServicioDtos.Create req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.crear(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ServicioDtos.Response> editar(
            @PathVariable Long id,
            @Valid @RequestBody ServicioDtos.Update req) {
        return ResponseEntity.ok(service.editar(id, req));
    }

    // Historial y cambio de precio
    @PostMapping("/{id}/precio")
    public ResponseEntity<ServicioDtos.PrecioResponse> setPrecio(
            @PathVariable Long id,
            @Valid @RequestBody ServicioDtos.PrecioRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.setPrecioActual(id, req));
    }

    @GetMapping("/{id}/precios")
    public ResponseEntity<List<ServicioDtos.PrecioResponse>> historial(@PathVariable Long id) {
        return ResponseEntity.ok(service.historialPrecios(id));
    }
    @PatchMapping("/{id}/inactivar")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public ResponseEntity<ServicioDtos.Response> inactivar(@PathVariable Long id) {
        return ResponseEntity.ok(service.cambiarActivo(id, false));
    }

    @PatchMapping("/{id}/reactivar")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public ResponseEntity<ServicioDtos.Response> reactivar(@PathVariable Long id) {
        return ResponseEntity.ok(service.cambiarActivo(id, true));
    }
}
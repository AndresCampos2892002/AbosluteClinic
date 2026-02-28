package com.example.farmacia_backend.sucursales;

import com.example.farmacia_backend.sucursales.dto.SucursalResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sucursales")
public class SucursalController {

    private final SucursalService service;

    public SucursalController(SucursalService service) {
        this.service = service;
    }

    // Cualquier usuario autenticado puede ver las sucursales activas
    // (necesario para asignar pacientes, citas, usuarios, etc.)
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<SucursalResponse>> listarActivas() {
        return ResponseEntity.ok(service.listarActivas());
    }

    // Útil para obtener datos de una sucursal específica
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<SucursalResponse> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(service.obtener(id));
    }
}
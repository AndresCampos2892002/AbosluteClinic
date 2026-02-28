package com.example.farmacia_backend.caja;

import com.example.farmacia_backend.caja.dto.CajaDtos.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/caja/citas")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','CAJA','SECRETARIA')")
public class CajaController {

    private final CajaService service;

    public CajaController(CajaService service) {
        this.service = service;
    }

    /**
     * GET — Obtiene el cobro de la cita. Si no existe, lo crea vacío.
     * Usado por el frontend al abrir la pantalla de caja para una cita.
     */
    @GetMapping("/{idCita}/cobro")
    public ResponseEntity<CobroResponse> obtenerCobro(@PathVariable Long idCita) {
        return ResponseEntity.ok(service.obtenerOCrear(idCita));
    }

    /**
     * PUT — Actualiza los items (servicios) del cobro y recalcula el total.
     * Bloqueado si el cobro ya está en estado PAGADO.
     */
    @PutMapping("/{idCita}/cobro")
    public ResponseEntity<CobroResponse> guardarCobro(
            @PathVariable Long idCita,
            @RequestBody CobroUpsertRequest req) {
        return ResponseEntity.ok(service.upsert(idCita, req));
    }

    /**
     * POST — Registra un pago o abono sobre el cobro.
     * Los abonos se acumulan hasta que saldo = 0 → estado PAGADO.
     * Bloqueado si el cobro ya está en estado PAGADO.
     */
    @PostMapping("/{idCita}/cobro/pagar")
    public ResponseEntity<CobroResponse> pagar(
            @PathVariable Long idCita,
            @Valid @RequestBody CobroPagarRequest req) {
        return ResponseEntity.status(HttpStatus.OK).body(service.pagar(idCita, req));
    }
}
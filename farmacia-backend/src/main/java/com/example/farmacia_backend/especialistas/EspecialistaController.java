package com.example.farmacia_backend.especialistas;

import com.example.farmacia_backend.especialistas.dto.EspecialistaResponse;
import com.example.farmacia_backend.especialistas.dto.EspecialistaUpsertRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * CORRECCIÓN #4: @PreAuthorize agregado con lógica diferenciada por endpoint.
 *
 * GET  /api/especialistas/{id} → SUPER_ADMIN, ADMIN o el propio ESPECIALISTA
 * PUT  /api/especialistas/{id} → SUPER_ADMIN, ADMIN o el propio ESPECIALISTA
 *      (el propio especialista solo puede editar su propio perfil, no el de otros)
 */
@RestController
@RequestMapping("/api/especialistas")
@RequiredArgsConstructor
public class EspecialistaController {

    private final EspecialistaService service;
    /**
     * SUPER_ADMIN y ADMIN pueden ver cualquier especialista.
     * El propio ESPECIALISTA solo puede ver su perfil.
     * La validación de "su propio perfil" se hace comparando el id del token
     * con el {idUsuario} del path. Si no coincide y no es admin, se deniega.
     */
    @GetMapping("/{idUsuario}")
    @PreAuthorize(
        "hasAnyRole('SUPER_ADMIN','ADMIN') or " +
        "(hasRole('ESPECIALISTA') and #idUsuario == authentication.principal.idUsuario)"
    )
    public ResponseEntity<EspecialistaResponse> obtener(
            @PathVariable Long idUsuario,
            Authentication authentication) {
        return ResponseEntity.ok(service.obtener(idUsuario));
    }
    /**
     * SUPER_ADMIN y ADMIN pueden editar cualquier especialista.
     * El propio ESPECIALISTA solo puede editar su propio perfil.
     */
    @PutMapping("/{idUsuario}")
    @PreAuthorize(
        "hasAnyRole('SUPER_ADMIN','ADMIN') or " +
        "(hasRole('ESPECIALISTA') and #idUsuario == authentication.principal.idUsuario)"
    )
    public ResponseEntity<EspecialistaResponse> upsert(
            @PathVariable Long idUsuario,
            @Valid @RequestBody EspecialistaUpsertRequest req,
            Authentication authentication) {
        return ResponseEntity.ok(service.upsert(idUsuario, req));
    }
}
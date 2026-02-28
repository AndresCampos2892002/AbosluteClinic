package com.example.farmacia_backend.users;

import com.example.farmacia_backend.users.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * CRUD de usuarios (borrado lógico con 'estado').
 * Solo accesible por SUPER_ADMIN.
 */
@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class UserController {

    private final UserService service;

    public UserController(UserService service) {
        this.service = service;
    }

    // Listar solo activos (vista normal)
    @GetMapping
    public ResponseEntity<List<UserResponse>> listarActivos() {
        return ResponseEntity.ok(service.listarActivos());
    }

    // Listar todos (incluye anulados)
    @GetMapping("/all")
    public ResponseEntity<List<UserResponse>> listarTodos() {
        return ResponseEntity.ok(service.listarTodos());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(service.obtener(id));
    }

    @PostMapping
    public ResponseEntity<UserResponse> crear(@Valid @RequestBody UserCreateRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.crear(req));
    }

    // @Valid activa las validaciones opcionales del DTO de actualización
    @PutMapping("/{id}")
    public ResponseEntity<UserResponse> editar(@PathVariable Long id,
                                               @Valid @RequestBody UserUpdateRequest req) {
        return ResponseEntity.ok(service.editar(id, req));
    }

    // Borrado lógico
    @PatchMapping("/{id}/anular")
    public ResponseEntity<UserResponse> anular(@PathVariable Long id) {
        return ResponseEntity.ok(service.anular(id));
    }

    @PatchMapping("/{id}/reactivar")
    public ResponseEntity<UserResponse> reactivar(@PathVariable Long id) {
        return ResponseEntity.ok(service.reactivar(id));
    }
}
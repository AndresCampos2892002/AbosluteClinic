package com.example.farmacia_backend.auth.passwordreset;

import com.example.farmacia_backend.auth.passwordreset.dto.MsgResponse;
import com.example.farmacia_backend.auth.passwordreset.dto.PasswordResetConfirmRequest;
import com.example.farmacia_backend.auth.passwordreset.dto.PasswordResetRequest;
import com.example.farmacia_backend.auth.passwordreset.dto.PasswordResetValidateRequest;
import com.example.farmacia_backend.auth.passwordreset.service.PasswordResetService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Endpoints de recuperación de contraseña.
 * POST /api/auth/password-reset/request   → solicita código por correo
 * POST /api/auth/password-reset/validate  → valida que el código sea correcto
 * POST /api/auth/password-reset/confirm   → cambia la contraseña
 */
@RestController
@RequestMapping("/api/auth/password-reset")
public class PasswordResetController {

    private final PasswordResetService service;

    public PasswordResetController(PasswordResetService service) {
        this.service = service;
    }

    @PostMapping("/request")
    public ResponseEntity<MsgResponse> request(@Valid @RequestBody PasswordResetRequest req) {
        service.requestCode(req.correo());
        return ResponseEntity.ok(new MsgResponse("Te enviamos un código de recuperación a tu correo."));
    }

    @PostMapping("/validate")
    public ResponseEntity<MsgResponse> validate(@Valid @RequestBody PasswordResetValidateRequest req) {
        service.validate(req.correo(), req.code());
        return ResponseEntity.ok(new MsgResponse("Código válido."));
    }

    @PostMapping("/confirm")
    public ResponseEntity<MsgResponse> confirm(@Valid @RequestBody PasswordResetConfirmRequest req) {
        service.confirm(req.correo(), req.code(), req.nuevaContrasena());
        return ResponseEntity.ok(new MsgResponse("Contraseña actualizada."));
    }
}
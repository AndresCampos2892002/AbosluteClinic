package com.example.farmacia_backend.auth;
import com.example.farmacia_backend.auth.dto.LoginRequest;
import com.example.farmacia_backend.auth.dto.LoginResponse;
import com.example.farmacia_backend.auth.dto.MeResponse;
import com.example.farmacia_backend.security.JwtService;
import com.example.farmacia_backend.users.UserEntity;
import com.example.farmacia_backend.users.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/**
 * Endpoints de autenticación.
 * POST /api/auth/login
 * GET  /api/auth/me
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authManager;
    private final UserRepository userRepo;
    private final JwtService jwt;

    public AuthController(AuthenticationManager authManager,
                          UserRepository userRepo,
                          JwtService jwt) {
        this.authManager = authManager;
        this.userRepo    = userRepo;
        this.jwt         = jwt;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        try {
            Authentication auth = authManager.authenticate(
                   new UsernamePasswordAuthenticationToken(req.usuario(), req.contrasena())
            );

            String usuario = ((UserDetails) auth.getPrincipal()).getUsername();

            UserEntity u = userRepo.findByUsuarioIgnoreCaseOrCorreoIgnoreCase(usuario, usuario)
                    .orElseThrow(() -> new BadCredentialsException("Credenciales incorrectas"));

            String token = jwt.generate(
                    u.getUsuario(),
                    Map.of("role", u.getRol().name(), "userId", u.getIdUsuario())
            );

            return ResponseEntity.ok(new LoginResponse(token, u.getRol().name()));

        } catch (AuthenticationException ex) {
            return ResponseEntity.status(401).body(Map.of(
                    "error",   ex.getClass().getSimpleName(),
                    "message", ex.getMessage()
            ));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of(
                    "error",   ex.getClass().getSimpleName(),
                    "message", ex.getMessage(),
                    "cause",   ex.getCause() != null ? ex.getCause().getMessage() : "Sin detalle"
            ));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<MeResponse> me(Authentication auth) {
        String usuario = auth.getName();

        UserEntity u = userRepo.findByUsuarioIgnoreCaseOrCorreoIgnoreCase(usuario, usuario)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        return ResponseEntity.ok(new MeResponse(
                u.getIdUsuario(),
                u.getUsuario(),
                u.getCorreo(),
                u.getNombre(),
                u.getApellido(),
                u.getRol().name(),
                u.getIdSucursal(),
                u.getTelefono()
        ));
    }
}
package com.example.farmacia_backend.users;

import com.example.farmacia_backend.sucursales.SucursalRepository;
import com.example.farmacia_backend.users.dto.*;
import com.example.farmacia_backend.users.event.UserStatusChangedEvent;
import com.example.farmacia_backend.users.exception.BusinessException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository          repo;
    private final PasswordEncoder         encoder;
    private final SucursalRepository      sucursalRepo;
    private final ApplicationEventPublisher eventPublisher; 

    public UserService(UserRepository repo,
                       PasswordEncoder encoder,
                       SucursalRepository sucursalRepo,
                       ApplicationEventPublisher eventPublisher) {
        this.repo           = repo;
        this.encoder        = encoder;
        this.sucursalRepo   = sucursalRepo;
        this.eventPublisher = eventPublisher;
    }

    // ─── Consultas ───────────────────────────────────────────────────────────
    public List<UserResponse> listarActivos() {
        return repo.findAllByEstadoTrue().stream()
                .map(this::toResponse)
                .toList();
    }

    public List<UserResponse> listarTodos() {
        return repo.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    public UserResponse obtener(Long id) {
        return toResponse(findOrThrow(id));
    }

    // ─── Crear ───────────────────────────────────────────────────────────────
    @Transactional
    public UserResponse crear(UserCreateRequest req) {
        validarSucursalActiva(req.idSucursal());

        if (repo.existsByUsuarioIgnoreCase(req.usuario().trim())) {
            throw new BusinessException(HttpStatus.CONFLICT, "El usuario ya existe");
        }
        if (repo.existsByCorreoIgnoreCase(req.correo().trim())) {
            throw new BusinessException(HttpStatus.CONFLICT, "El correo ya está registrado");
        }

        UserEntity u = UserEntity.builder()
                .usuario(req.usuario().trim())
                .correo(req.correo().trim().toLowerCase())
                .contrasena(encoder.encode(req.password()))
                .rol(req.rol())
                .nombre(req.nombre().trim())
                .apellido(req.apellido().trim())
                .telefono(req.telefono() != null ? req.telefono().trim() : null)
                .estado(true)
                .idSucursal(req.idSucursal())
                .build();
        repo.save(u);
        return toResponse(u);
    }

    // ─── Editar ───────────────────────────────────────────────────────────────
    @Transactional
    public UserResponse editar(Long id, UserUpdateRequest req) {
        UserEntity u = findOrThrow(id);

        if (req.correo() != null && !req.correo().isBlank()) {
            String nuevoCorreo = req.correo().trim().toLowerCase();
            if (!nuevoCorreo.equalsIgnoreCase(u.getCorreo())
                    && repo.existsByCorreoIgnoreCase(nuevoCorreo)) {
                throw new BusinessException(HttpStatus.CONFLICT, "El correo ya está registrado");
            }
            u.setCorreo(nuevoCorreo);
        }

        if (req.rol()      != null)               u.setRol(req.rol());
        if (req.nombre()   != null && !req.nombre().isBlank())   u.setNombre(req.nombre().trim());
        if (req.apellido() != null && !req.apellido().isBlank()) u.setApellido(req.apellido().trim());
        if (req.telefono() != null)                u.setTelefono(req.telefono().trim());

        if (req.idSucursal() != null) {
            validarSucursalActiva(req.idSucursal());
            u.setIdSucursal(req.idSucursal());
        }

        if (req.password() != null && !req.password().isBlank()) {
            u.setContrasena(encoder.encode(req.password()));
        }
        return toResponse(u);
    }

    // ─── Anular / Reactivar ───────────────────────────────────────────────────
    @Transactional
    public UserResponse anular(Long id) {
        UserEntity u = findOrThrow(id);
        if (!u.isEstado()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "El usuario ya está anulado");
        }
        u.setEstado(false);
        eventPublisher.publishEvent(new UserStatusChangedEvent(id, false));

        return toResponse(u);
    }

    @Transactional
    public UserResponse reactivar(Long id) {
        UserEntity u = findOrThrow(id);
        if (u.isEstado()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "El usuario ya está activo");
        }
        u.setEstado(true);

        eventPublisher.publishEvent(new UserStatusChangedEvent(id, true));

        return toResponse(u);
    }

    // ─── Helpers privados ────────────────────────────────────────────────────
    private UserEntity findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
    }

    private void validarSucursalActiva(Long idSucursal) {
        if (!sucursalRepo.existsByIdSucursalAndEstadoTrue(idSucursal)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Sucursal inválida o inactiva");
        }
    }

    private UserResponse toResponse(UserEntity u) {
        return new UserResponse(
                u.getIdUsuario(),
                u.getUsuario(),
                u.getCorreo(),
                u.getRol(),
                u.getNombre(),
                u.getApellido(),
                u.getTelefono(),
                u.isEstado(),
                u.getIdSucursal(),
                u.getCreadoEn(),
                u.getActualizadoEn()
        );
    }
}
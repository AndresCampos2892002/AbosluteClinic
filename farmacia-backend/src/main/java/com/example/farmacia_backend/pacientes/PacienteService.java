package com.example.farmacia_backend.pacientes;

import com.example.farmacia_backend.pacientes.dto.PacienteDtos;
import com.example.farmacia_backend.security.AuthenticatedUser;
import com.example.farmacia_backend.security.CurrentUserService;
import com.example.farmacia_backend.sucursales.SucursalEntity;
import com.example.farmacia_backend.sucursales.SucursalRepository;
import com.example.farmacia_backend.users.UserEntity;
import com.example.farmacia_backend.users.UserRepository;
import com.example.farmacia_backend.users.exception.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PacienteService {

    private final PacienteRepository repo;
    private final UserRepository     userRepo;
    private final SucursalRepository sucursalRepo;
    private final CurrentUserService currentUserService;

    public PacienteService(PacienteRepository repo,
                           UserRepository userRepo,
                           SucursalRepository sucursalRepo,
                           CurrentUserService currentUserService) {
        this.repo               = repo;
        this.userRepo           = userRepo;
        this.sucursalRepo       = sucursalRepo;
        this.currentUserService = currentUserService;
    }

    // ─── Consultas ───────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<PacienteDtos.Response> listarActivos() {
        return listarInternal(true);
    }

    @Transactional(readOnly = true)
    public List<PacienteDtos.Response> listarTodos() {
        return listarInternal(false);
    }

    @Transactional(readOnly = true)
    public PacienteDtos.Response obtener(Long id) {
        return mapOne(findOrThrow(id));
    }

    // ─── Crear ───────────────────────────────────────────────────────────────
    @Transactional
    public PacienteDtos.Response crear(PacienteDtos.Create req) {
        String nombres   = norm(req.nombres());
        String apellidos = norm(req.apellidos());

        if (nombres == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Nombres es obligatorio");
        }

        // Validar duplicado por nombres + apellidos
        if (apellidos != null
                && repo.existsByNombresIgnoreCaseAndApellidosIgnoreCase(nombres, apellidos)) {
            throw new BusinessException(HttpStatus.CONFLICT,
                    "Ya existe un paciente con esos nombres y apellidos");
        }
        AuthenticatedUser authUser = currentUserService.requireAuthenticatedUser();
        Long idUsuario = authUser.getIdUsuario();

        // idSucursal no está en el token, hacemos UNA sola query para obtenerla.
        // (La sucursal del usuario es estable, no cambia por request)
        UserEntity user = userRepo.findById(idUsuario)
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "Usuario no encontrado"));

        Long idSucursal = user.getIdSucursal();
        if (idSucursal == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "El usuario no tiene sucursal asignada");
        }

        PacienteEntity e = PacienteEntity.builder()
                .nombres(nombres)
                .apellidos(apellidos)
                .telefono(norm(req.telefono()))
                .correo(norm(req.correo()))
                .nit(norm(req.nit()))
                .dpi(norm(req.dpi()))
                .direccion(norm(req.direccion()))
                .activo(true)
                .creadoPor(idUsuario)
                .idSucursalCreado(idSucursal)
                .build();

        return mapOne(repo.save(e));
    }

    // ─── Editar ───────────────────────────────────────────────────────────────

    @Transactional
    public PacienteDtos.Response editar(Long id, PacienteDtos.Update req) {
        PacienteEntity e = findOrThrow(id);

        String nombresFinal   = req.nombres()   != null ? norm(req.nombres())   : e.getNombres();
        String apellidosFinal = req.apellidos()  != null ? norm(req.apellidos()) : e.getApellidos();

        if (nombresFinal == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Nombres es obligatorio");
        }

        // Duplicado excluyendo el mismo ID
        if (apellidosFinal != null
                && repo.existsByNombresIgnoreCaseAndApellidosIgnoreCaseAndIdPacienteNot(
                        nombresFinal, apellidosFinal, id)) {
            throw new BusinessException(HttpStatus.CONFLICT,
                    "Ya existe un paciente con esos nombres y apellidos");
        }

        e.setNombres(nombresFinal);
        e.setApellidos(apellidosFinal);

        if (req.telefono()  != null) e.setTelefono(norm(req.telefono()));
        if (req.correo()    != null) e.setCorreo(norm(req.correo()));
        if (req.nit()       != null) e.setNit(norm(req.nit()));
        if (req.dpi()       != null) e.setDpi(norm(req.dpi()));
        if (req.direccion() != null) e.setDireccion(norm(req.direccion()));

        return mapOne(repo.save(e));
    }

    // ─── Inactivar / Reactivar ────────────────────────────────────────────────

    @Transactional
    public PacienteDtos.Response inactivar(Long id) {  // CORRECCIÓN #7: devuelve Response
        PacienteEntity e = findOrThrow(id);
        if (!e.getActivo()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "El paciente ya está inactivo");
        }
        e.setActivo(false);
        return mapOne(repo.save(e));
    }

    @Transactional
    public PacienteDtos.Response reactivar(Long id) {  // CORRECCIÓN #7: devuelve Response
        PacienteEntity e = findOrThrow(id);
        if (e.getActivo()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "El paciente ya está activo");
        }
        e.setActivo(true);
        return mapOne(repo.save(e));
    }

    // ─── Helpers privados ─────────────────────────────────────────────────────
    private PacienteEntity findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "Paciente no encontrado"));
    }

    /**
     * Listado con cache para evitar N+1.
     * Solo 3 queries para cualquier cantidad de pacientes:
     *   1. SELECT pacientes
     *   2. SELECT usuarios WHERE id IN (...)
     *   3. SELECT sucursales WHERE id IN (...)
     */
    private List<PacienteDtos.Response> listarInternal(boolean soloActivos) {
        List<PacienteEntity> all = soloActivos
                ? repo.findAllByActivoTrue()
                : repo.findAll();

        // Recolectar IDs únicos para batch queries
        Set<Long> userIds = all.stream()
                .map(PacienteEntity::getCreadoPor)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Set<Long> sucIds = all.stream()
                .map(PacienteEntity::getIdSucursalCreado)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // Batch queries → Maps de cache
        Map<Long, String> userNameById = new HashMap<>();
        if (!userIds.isEmpty()) {
            userRepo.findAllById(userIds).forEach(u ->
                    userNameById.put(u.getIdUsuario(), userDisplay(u)));
        }

        Map<Long, String> sucursalNameById = new HashMap<>();
        if (!sucIds.isEmpty()) {
            sucursalRepo.findAllById(sucIds).forEach(s ->
                    sucursalNameById.put(s.getIdSucursal(), s.getNombre()));
        }

        return all.stream()
                .map(e -> mapWithCache(e, userNameById, sucursalNameById))
                .toList();
    }

    /**
     * Mapeo para listas (usa cache de nombres, 0 queries adicionales por entidad).
     */
    private PacienteDtos.Response mapWithCache(PacienteEntity e,
                                               Map<Long, String> userNameById,
                                               Map<Long, String> sucursalNameById) {
        return new PacienteDtos.Response(
                e.getIdPaciente(),
                e.getNombres(),
                e.getApellidos(),
                e.getTelefono(),
                e.getCorreo(),
                e.getNit(),
                e.getDpi(),
                e.getDireccion(),
                e.getActivo(),
                e.getCreadoPor(),
                userNameById.getOrDefault(e.getCreadoPor(), null),
                e.getIdSucursalCreado(),
                sucursalNameById.getOrDefault(e.getIdSucursalCreado(), null),
                e.getCreadoEn(),
                e.getActualizadoEn()
        );
    }

    /**
     * Mapeo para operaciones individuales (crear/editar/obtener).
     * Hace queries puntuales solo para los IDs de esa entidad.
     */
    private PacienteDtos.Response mapOne(PacienteEntity e) {
        String creadoPorNombre = null;
        if (e.getCreadoPor() != null) {
            creadoPorNombre = userRepo.findById(e.getCreadoPor())
                    .map(this::userDisplay)
                    .orElse(null);
        }

        String sucursalNombre = null;
        if (e.getIdSucursalCreado() != null) {
            sucursalNombre = sucursalRepo.findById(e.getIdSucursalCreado())
                    .map(SucursalEntity::getNombre)
                    .orElse(null);
        }

        return new PacienteDtos.Response(
                e.getIdPaciente(),
                e.getNombres(),
                e.getApellidos(),
                e.getTelefono(),
                e.getCorreo(),
                e.getNit(),
                e.getDpi(),
                e.getDireccion(),
                e.getActivo(),
                e.getCreadoPor(),
                creadoPorNombre,
                e.getIdSucursalCreado(),
                sucursalNombre,
                e.getCreadoEn(),
                e.getActualizadoEn()
        );
    }

    /**
     * Nombre para mostrar del usuario: "Nombre Apellido" → usuario → #id
     */
    private String userDisplay(UserEntity u) {
        if (u == null) return null;
        String full = ((u.getNombre() != null ? u.getNombre().trim() : "") + " "
                + (u.getApellido() != null ? u.getApellido().trim() : "")).trim();
        if (!full.isEmpty()) return full;
        if (u.getUsuario() != null) return u.getUsuario();
        return "#" + u.getIdUsuario();
    }

    /**
     * Normaliza strings: null → null, blank → null, trim.
     */
    private String norm(String v) {
        if (v == null) return null;
        String t = v.trim();
        return t.isEmpty() ? null : t;
    }
}
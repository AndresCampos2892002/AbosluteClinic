package com.example.farmacia_backend.servicios;

import com.example.farmacia_backend.security.CurrentUserService;
import com.example.farmacia_backend.servicios.dto.ServicioDtos;
import com.example.farmacia_backend.users.exception.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;


@Service
public class ServicioService {

    private final ServicioRepository      repo;
    private final ServicioPrecioRepository precioRepo;
    private final CurrentUserService      currentUserService;

    public ServicioService(ServicioRepository repo,
                           ServicioPrecioRepository precioRepo,
                           CurrentUserService currentUserService) {
        this.repo               = repo;
        this.precioRepo         = precioRepo;
        this.currentUserService = currentUserService;
    }

    // ─── Consultas ───────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<ServicioDtos.Response> listarActivos() {
        return listarInternal(repo.findAllByActivoTrue());
    }

    @Transactional(readOnly = true)
    public List<ServicioDtos.Response> listarTodos() {
        return listarInternal(repo.findAll());
    }

    @Transactional(readOnly = true)
    public ServicioDtos.Response obtener(Long id) {
        return toResponse(findOrThrow(id));
    }

    // ─── Crear ───────────────────────────────────────────────────────────────
    @Transactional
    public ServicioDtos.Response crear(ServicioDtos.Create req) {
        if (repo.existsByNombreIgnoreCase(req.nombre().trim())) {
            throw new BusinessException(HttpStatus.CONFLICT, "Ya existe un servicio con ese nombre");
        }

        Long userId = currentUserService.requireUserId();

        ServicioEntity s = ServicioEntity.builder()
                .nombre(req.nombre().trim())
                .descripcion(req.descripcion() != null ? req.descripcion().trim() : null)
                .activo(true)
                .creadoPor(userId)
                .build();

        s = repo.save(s);

        // Si viene precio inicial, lo creamos
        if (req.precioInicial() != null) {
            OffsetDateTime ahora = OffsetDateTime.now();
            precioRepo.cerrarVigentes(s.getIdServicio(), ahora); // por seguridad

            ServicioPrecioEntity p = ServicioPrecioEntity.builder()
                    .servicio(s)
                    .precio(req.precioInicial())
                    .moneda(req.moneda() != null && !req.moneda().isBlank() ? req.moneda().trim() : "GTQ")
                    .vigenteDesde(ahora)
                    .vigenteHasta(null)
                    .creadoPor(userId)
                    .build();

            precioRepo.save(p);
        }

        return toResponse(s);
    }

    // ─── Editar ───────────────────────────────────────────────────────────────
    @Transactional
    public ServicioDtos.Response editar(Long id, ServicioDtos.Update req) {
        ServicioEntity s = findOrThrow(id);

        if (req.nombre() != null) {
            String nombre = req.nombre().trim();
            if (!nombre.equalsIgnoreCase(s.getNombre())) {
                repo.findFirstByNombreIgnoreCase(nombre).ifPresent(otro -> {
                    if (!otro.getIdServicio().equals(id)) {
                        throw new BusinessException(HttpStatus.CONFLICT,
                                "Ya existe un servicio con ese nombre");
                    }
                });
            }
            s.setNombre(nombre);
        }

        if (req.descripcion() != null) s.setDescripcion(req.descripcion().trim());
        if (req.activo()      != null) s.setActivo(req.activo());

        return toResponse(repo.save(s));
    }

    // ─── Inactivar / Reactivar ────────────────────────────────────────────────
    @Transactional
    public ServicioDtos.Response cambiarActivo(Long id, boolean activo) {
        ServicioEntity s = findOrThrow(id);
        if (s.getActivo() == activo) {
            String msg = activo ? "El servicio ya está activo" : "El servicio ya está inactivo";
            throw new BusinessException(HttpStatus.BAD_REQUEST, msg);
        }
        s.setActivo(activo);
        return toResponse(repo.save(s));
    }

    // ─── Precios ─────────────────────────────────────────────────────────────
    @Transactional
    public ServicioDtos.PrecioResponse setPrecioActual(Long idServicio, ServicioDtos.PrecioRequest req) {
        ServicioEntity s   = findOrThrow(idServicio);
        OffsetDateTime now = OffsetDateTime.now();

        precioRepo.cerrarVigentes(idServicio, now);

        ServicioPrecioEntity nuevo = ServicioPrecioEntity.builder()
                .servicio(s)
                .precio(req.precio())
                .moneda(req.moneda() != null && !req.moneda().isBlank() ? req.moneda().trim() : "GTQ")
                .vigenteDesde(now)
                .vigenteHasta(null)
                .creadoPor(currentUserService.requireUserId())
                .build();

        return toPrecioResponse(precioRepo.save(nuevo));
    }

    @Transactional(readOnly = true)
    public List<ServicioDtos.PrecioResponse> historialPrecios(Long idServicio) {
        if (!repo.existsById(idServicio)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "Servicio no encontrado");
        }
        return precioRepo.findHistorial(idServicio).stream()
                .map(this::toPrecioResponse)
                .toList();
    }

    // ─── Helpers privados ─────────────────────────────────────────────────────
    private ServicioEntity findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "Servicio no encontrado"));
    }

  
    private List<ServicioDtos.Response> listarInternal(List<ServicioEntity> servicios) {
        if (servicios.isEmpty()) return List.of();

        List<Long> ids = servicios.stream()
                .map(ServicioEntity::getIdServicio)
                .toList();

        // Batch: obtiene el precio actual de todos los servicios en 1 sola query
        Map<Long, ServicioPrecioEntity> precioByServicioId = precioRepo
                .findPreciosActualesByIds(ids)
                .stream()
                // Si hay más de uno por servicio (no debería), quedamos con el primero
                .collect(Collectors.toMap(
                        p -> p.getServicio().getIdServicio(),
                        p -> p,
                        (a, b) -> a
                ));

        return servicios.stream()
                .map(s -> toResponseWithPrecio(s, precioByServicioId.get(s.getIdServicio())))
                .toList();
    }

    /**
     * Mapeo para operaciones individuales (obtener/crear/editar).
     * Hace 1 query puntual al precio actual.
     */
    private ServicioDtos.Response toResponse(ServicioEntity s) {
        var precio = precioRepo.findPrecioActual(s.getIdServicio()).orElse(null);
        return toResponseWithPrecio(s, precio);
    }

    private ServicioDtos.Response toResponseWithPrecio(ServicioEntity s, ServicioPrecioEntity precio) {
        return new ServicioDtos.Response(
                s.getIdServicio(),
                s.getNombre(),
                s.getDescripcion(),
                s.getActivo(),
                precio != null ? precio.getPrecio() : null,
                precio != null ? precio.getMoneda()  : null,
                s.getCreadoPor(),
                s.getCreadoEn(),       
                s.getActualizadoEn()
        );
    }

    private ServicioDtos.PrecioResponse toPrecioResponse(ServicioPrecioEntity p) {
        return new ServicioDtos.PrecioResponse(
                p.getIdServicioPrecio(),
                p.getPrecio(),
                p.getMoneda(),
                p.getVigenteDesde(),    
                p.getVigenteHasta()
        );
    }
}
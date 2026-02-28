package com.example.farmacia_backend.citas;

import com.example.farmacia_backend.citas.dto.CitaDtos.CitaResponse;
import com.example.farmacia_backend.citas.dto.CitaRequest;
import com.example.farmacia_backend.security.CurrentUserService;
import com.example.farmacia_backend.users.exception.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;

@Service
public class CitaService {

    private final CitaRepository    repo;
    private final CurrentUserService currentUserService;

    public CitaService(CitaRepository repo, CurrentUserService currentUserService) {
        this.repo               = repo;
        this.currentUserService = currentUserService;
    }

    // ─── Consultas ────────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<CitaResponse> listar(OffsetDateTime desde, OffsetDateTime hasta, Long idSucursal) {
        if (desde == null || hasta == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "Los parámetros desde y hasta son requeridos");
        }

        List<CitaEntity> list = (idSucursal != null)
                ? repo.findByIdSucursalAndFechaInicioBetweenOrderByFechaInicioAsc(idSucursal, desde, hasta)
                : repo.findByFechaInicioBetweenOrderByFechaInicioAsc(desde, hasta);

        return list.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public CitaResponse obtener(Long id) {
        return toResponse(findOrThrow(id));
    }

    // ─── Crear ───────────────────────────────────────────────────────────────
    @Transactional
    public CitaResponse crear(CitaRequest req) {
        Range r = normalizeRange(req.getFechaInicio(), req.getFechaFin(), req.getDuracionMinutos());

        if (req.getIdEspecialista() != null
                && repo.existeSolapeEspecialista(req.getIdEspecialista(), r.inicio(), r.fin())) {
            throw new BusinessException(HttpStatus.CONFLICT,
                    "El especialista ya tiene una cita en ese horario");
        }

        Long userId = currentUserService.requireUserId();

        CitaEntity e = CitaEntity.builder()
                .idSucursal(req.getIdSucursal())
                .idPaciente(req.getIdPaciente())
                .idServicio(req.getIdServicio())
                .idEspecialista(req.getIdEspecialista())
                .fechaInicio(r.inicio())
                .fechaFin(r.fin())
                .duracionMinutos(r.duracionMinutos())
                .estado(req.getEstado() != null ? req.getEstado() : CitaEstado.PENDIENTE)
                .canal(norm(req.getCanal()))
                .motivo(norm(req.getMotivo()))
                .notas(norm(req.getNotas()))
                .creadoPor(userId)
                .actualizadoPor(userId)
                .build();

        return toResponse(repo.save(e));
    }

    // ─── Editar ───────────────────────────────────────────────────────────────

    @Transactional
    public CitaResponse editar(Long id, CitaRequest req) {
        CitaEntity e = findOrThrow(id);

        // TODO: descomentar cuando se implemente cancelacionCobro en el frontend
        // if (req.getEstado() == CitaEstado.TERMINADA && req.getCancelacionCobro() == null) {
        //     throw new BusinessException(HttpStatus.BAD_REQUEST,
        //         "Al terminar debes indicar si paga inmediato o es cuenta por cobrar.");
        // }

        OffsetDateTime oldInicio = e.getFechaInicio();
        OffsetDateTime oldFin    = e.getFechaFin();
        Long           oldEsp    = e.getIdEspecialista();

        // Aplicar cambios de IDs
        if (req.getIdSucursal()  != null) e.setIdSucursal(req.getIdSucursal());
        if (req.getIdPaciente()  != null) e.setIdPaciente(req.getIdPaciente());
        if (req.getIdServicio()  != null) e.setIdServicio(req.getIdServicio());
        e.setIdEspecialista(req.getIdEspecialista()); // null = quitar especialista

        if (req.getCanal()  != null) e.setCanal(norm(req.getCanal()));
        if (req.getMotivo() != null) e.setMotivo(norm(req.getMotivo()));
        if (req.getNotas()  != null) e.setNotas(norm(req.getNotas()));

        // ─── Normalizar horario ───────────────────────────────────────────────
        boolean tocaHorario = req.getFechaInicio() != null
                || req.getFechaFin() != null
                || req.getDuracionMinutos() != null;

        OffsetDateTime newInicio = oldInicio;
        OffsetDateTime newFin    = oldFin;
        int            newDur    = e.getDuracionMinutos() != null ? e.getDuracionMinutos() : 30;

        if (tocaHorario) {
            OffsetDateTime inicio = req.getFechaInicio() != null ? req.getFechaInicio() : e.getFechaInicio();
            Range r = normalizeRange(inicio, req.getFechaFin(), req.getDuracionMinutos());
            newInicio = r.inicio();
            newFin    = r.fin();
            newDur    = r.duracionMinutos();
        }

        boolean horarioCambio    = tocaHorario && (!Objects.equals(newInicio, oldInicio) || !Objects.equals(newFin, oldFin));
        boolean especialistaCambio = !Objects.equals(oldEsp, e.getIdEspecialista());

        // Regla: REPROGRAMADA exige cambio de horario
        if (req.getEstado() == CitaEstado.REPROGRAMADA && !horarioCambio) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "Para marcar REPROGRAMADA debes cambiar fecha, hora o duración");
        }

        // Validar solape solo si hay especialista y cambió horario o especialista
        if (e.getIdEspecialista() != null && (horarioCambio || especialistaCambio)) {
            if (repo.existeSolapeEspecialistaExcluyendo(e.getIdCita(), e.getIdEspecialista(), newInicio, newFin)) {
                throw new BusinessException(HttpStatus.CONFLICT,
                        "El especialista ya tiene una cita en ese horario");
            }
        }

        if (tocaHorario) {
            e.setFechaInicio(newInicio);
            e.setFechaFin(newFin);
            e.setDuracionMinutos(newDur);
        }

        // Estado: si viene en el request úsalo, si cambió horario → auto REPROGRAMADA
        if (req.getEstado() != null) {
            e.setEstado(req.getEstado());
        } else if (horarioCambio) {
            e.setEstado(CitaEstado.REPROGRAMADA);
        }

        e.setActualizadoPor(currentUserService.requireUserId());

        return toResponse(repo.save(e));
    }

    // ─── Cambiar estado ───────────────────────────────────────────────────────

    @Transactional
    public CitaResponse cambiarEstado(Long id, CitaEstado nuevoEstado, String notaOpcional) {
        CitaEntity e = findOrThrow(id);

        if (nuevoEstado == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "El estado es requerido");
        }

        e.setEstado(nuevoEstado);

        // Acumular nota en el campo notas si viene
        if (notaOpcional != null && !notaOpcional.isBlank()) {
            String prev = e.getNotas() == null ? "" : e.getNotas().trim() + "\n";
            e.setNotas(prev + notaOpcional.trim());
        }

        e.setActualizadoPor(currentUserService.requireUserId());

        return toResponse(repo.save(e));
    }

    // ─── Helpers privados ─────────────────────────────────────────────────────
    private CitaEntity findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "Cita no encontrada"));
    }

    /**
     * Normaliza el rango de fechas aceptando duracionMinutos O fechaFin.
     * Si vienen ambos, duracionMinutos tiene prioridad.
     */
    private static Range normalizeRange(OffsetDateTime inicio, OffsetDateTime fin, Integer duracionMin) {
        if (inicio == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fechaInicio es requerida");
        }
        if (duracionMin != null && duracionMin > 0) {
            return new Range(inicio, inicio.plusMinutes(duracionMin), duracionMin);
        }
        if (fin != null) {
            if (!fin.isAfter(inicio)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST,
                        "fechaFin debe ser mayor a fechaInicio");
            }
            int mins = (int) Math.max(1, Duration.between(inicio, fin).toMinutes());
            return new Range(inicio, fin, mins);
        }
        throw new BusinessException(HttpStatus.BAD_REQUEST,
                "Debes enviar duracionMinutos o fechaFin");
    }

    private CitaResponse toResponse(CitaEntity e) {
        return new CitaResponse(
                e.getIdCita(),
                e.getIdSucursal(),
                e.getIdPaciente(),
                e.getIdServicio(),
                e.getIdEspecialista(),
                e.getFechaInicio(),
                e.getFechaFin(),
                e.getDuracionMinutos(),
                e.getEstado(),
                e.getCanal(),
                e.getMotivo(),
                e.getNotas(),
                e.getCreadoEn(),
                e.getCreadoPor(),
                e.getActualizadoEn(),
                e.getActualizadoPor()
        );
    }

    private static String norm(String v) {
        if (v == null) return null;
        String s = v.trim().replaceAll("\\s+", " ");
        return s.isBlank() ? null : s;
    }

    private record Range(OffsetDateTime inicio, OffsetDateTime fin, int duracionMinutos) {}
}
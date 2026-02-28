package com.example.farmacia_backend.caja;

import com.example.farmacia_backend.caja.dto.CajaDtos.*;
import com.example.farmacia_backend.security.CurrentUserService;
import com.example.farmacia_backend.users.exception.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.farmacia_backend.citas.CitaRepository;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class CajaService {

    private final CitaCobroRepository cobroRepo;
    private final CitaRepository      citaRepo;
    private final CurrentUserService  currentUserService;
    private final ObjectMapper        om;

    public CajaService(CitaCobroRepository cobroRepo,
                       CitaRepository citaRepo,
                       CurrentUserService currentUserService,
                       ObjectMapper om) {
        this.cobroRepo          = cobroRepo;
        this.citaRepo           = citaRepo;
        this.currentUserService = currentUserService;
        this.om                 = om;
    }

    // ─── Obtener o crear cobro ────────────────────────────────────────────────

    @Transactional
    public CobroResponse obtenerOCrear(Long idCita) {
        citaRepo.findById(idCita)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "Cita no encontrada"));

        CitaCobroEntity cobro = cobroRepo.findByIdCita(idCita)
                .orElseGet(() -> crearVacio(idCita));

        return toResponse(cobro);
    }

    // ─── Actualizar items del cobro ───────────────────────────────────────────

    @Transactional
    public CobroResponse upsert(Long idCita, CobroUpsertRequest req) {
        CitaCobroEntity cobro = cobroRepo.findByIdCita(idCita)
                .orElseGet(() -> crearVacio(idCita));

        // CORRECCIÓN #7: Bloquear edición si ya está PAGADO
        if (cobro.getEstadoPago() == EstadoPago.PAGADO) {
            throw new BusinessException(HttpStatus.CONFLICT,
                    "El cobro ya está pagado y no puede modificarse");
        }

        List<CobroItemDto> items = (req != null && req.items() != null)
                ? normalizarItems(req.items())
                : List.of();

        BigDecimal total  = items.stream()
                .map(i -> nz(i.subtotal))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pagado = nz(cobro.getPagado());
        BigDecimal saldo  = total.subtract(pagado).max(BigDecimal.ZERO);

        if (req != null && req.moneda() != null && !req.moneda().isBlank()) {
            cobro.setMoneda(req.moneda().trim().toUpperCase());
        }
        cobro.setItems(toJson(items));
        cobro.setTotal(total);
        cobro.setSaldo(saldo);
        cobro.setEstadoPago(calcEstado(total, pagado));
        cobro.setActualizadoPor(currentUserService.requireUserId());

        return toResponse(cobroRepo.save(cobro));
    }

    // ─── Registrar pago / abono ───────────────────────────────────────────────

    @Transactional
    public CobroResponse pagar(Long idCita, CobroPagarRequest req) {
        CitaCobroEntity cobro = cobroRepo.findByIdCita(idCita)
                .orElseGet(() -> crearVacio(idCita));

        if (cobro.getEstadoPago() == EstadoPago.PAGADO) {
            throw new BusinessException(HttpStatus.CONFLICT,
                    "El cobro ya está completamente pagado");
        }

        if (req == null || req.monto() == null || req.monto().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "El monto debe ser mayor a 0");
        }

        // Acumular el nuevo abono al historial
        List<CobroPagoDto> pagos = fromJson(cobro.getPagos(),
                new TypeReference<List<CobroPagoDto>>() {});

        pagos.add(new CobroPagoDto(
                OffsetDateTime.now(),
                req.monto(),
                req.metodo() != null && !req.metodo().isBlank()
                        ? req.metodo().trim().toUpperCase()
                        : "EFECTIVO",
                req.referencia()
        ));

        BigDecimal pagado = nz(cobro.getPagado()).add(req.monto());
        BigDecimal total  = nz(cobro.getTotal());
        BigDecimal saldo  = total.subtract(pagado).max(BigDecimal.ZERO);

        cobro.setPagos(toJson(pagos));
        cobro.setPagado(pagado);
        cobro.setSaldo(saldo);
        cobro.setEstadoPago(calcEstado(total, pagado));
        cobro.setActualizadoPor(currentUserService.requireUserId());

        return toResponse(cobroRepo.save(cobro));
    }

    // ─── Helpers privados ─────────────────────────────────────────────────────

    /**
     * Crea un cobro vacío para la cita — estado PENDIENTE, sin items ni pagos.
     */
    private CitaCobroEntity crearVacio(Long idCita) {
        Long userId = currentUserService.requireUserId();

        CitaCobroEntity e = CitaCobroEntity.builder()
                .idCita(idCita)
                .moneda("GTQ")
                .items("[]")
                .pagos("[]")
                .total(BigDecimal.ZERO)
                .pagado(BigDecimal.ZERO)
                .saldo(BigDecimal.ZERO)
                .estadoPago(EstadoPago.PENDIENTE)
                .creadoPor(userId)
                .actualizadoPor(userId)
                .build();

        return cobroRepo.save(e);
    }

    /**
     * Calcula el estado de pago según total y pagado acumulado.
     */
    private EstadoPago calcEstado(BigDecimal total, BigDecimal pagado) {
        total  = nz(total);
        pagado = nz(pagado);

        if (total.compareTo(BigDecimal.ZERO) <= 0) return EstadoPago.PENDIENTE;
        if (pagado.compareTo(BigDecimal.ZERO) <= 0) return EstadoPago.PENDIENTE;
        if (pagado.compareTo(total) >= 0)           return EstadoPago.PAGADO;
        return EstadoPago.PARCIAL;
    }

    /**
     * Normaliza los items: recalcula subtotales y filtra nulos.
     */
    private List<CobroItemDto> normalizarItems(List<CobroItemDto> items) {
        List<CobroItemDto> out = new ArrayList<>();
        for (CobroItemDto i : items) {
            if (i == null) continue;
            int       cant = (i.cantidad == null || i.cantidad <= 0) ? 1 : i.cantidad;
            BigDecimal pu  = nz(i.precioUnitario);
            out.add(new CobroItemDto(
                    i.idServicio,
                    i.nombre,
                    cant,
                    pu,
                    pu.multiply(BigDecimal.valueOf(cant))
            ));
        }
        return out;
    }

    private CobroResponse toResponse(CitaCobroEntity e) {
        return new CobroResponse(
                e.getIdCobro(),
                e.getIdCita(),
                e.getMoneda(),
                fromJson(e.getItems(), new TypeReference<List<CobroItemDto>>() {}),
                fromJson(e.getPagos(), new TypeReference<List<CobroPagoDto>>()  {}),
                e.getTotal(),
                e.getPagado(),
                e.getSaldo(),
                e.getEstadoPago(),
                e.getActualizadoEn()
        );
    }

    private String toJson(Object obj) {
        try {
            return om.writeValueAsString(obj);
        } catch (Exception ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "Error serializando JSON");
        }
    }

    private <T> List<T> fromJson(String json, TypeReference<List<T>> type) {
        try {
            if (json == null || json.isBlank()) return new ArrayList<>();
            return om.readValue(json, type);
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
package com.example.farmacia_backend.sucursales;

import com.example.farmacia_backend.sucursales.dto.SucursalResponse;
import com.example.farmacia_backend.users.exception.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
@Service
public class SucursalService {

    private final SucursalRepository repo;

    public SucursalService(SucursalRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public List<SucursalResponse> listarActivas() {
        return repo.findAllByEstadoTrueOrderByNombreAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public SucursalResponse obtener(Long id) {
        return repo.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "Sucursal no encontrada"));
    }

    // ─── Helper privado ───────────────────────────────────────────────────────

    private SucursalResponse toResponse(SucursalEntity e) {
        return new SucursalResponse(
                e.getIdSucursal(),
                e.getNombre(),
                e.getDireccion(),
                e.isEstado(),
                e.getCreadoEn()
        );
    }
}
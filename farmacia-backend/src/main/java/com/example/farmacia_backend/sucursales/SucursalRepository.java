package com.example.farmacia_backend.sucursales;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SucursalRepository extends JpaRepository<SucursalEntity, Long> {
    List<SucursalEntity> findAllByEstadoTrueOrderByNombreAsc();
    boolean existsByIdSucursalAndEstadoTrue(Long idSucursal);
}
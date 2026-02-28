package com.example.farmacia_backend.servicios;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ServicioRepository extends JpaRepository<ServicioEntity, Long> {
    boolean existsByNombreIgnoreCase(String nombre);
    Optional<ServicioEntity> findFirstByNombreIgnoreCase(String nombre);
    List<ServicioEntity> findAllByActivoTrue();
    List<ServicioEntity> findByActivoTrueOrderByNombreAsc();
}
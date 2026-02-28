package com.example.farmacia_backend.caja;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CitaCobroRepository extends JpaRepository<CitaCobroEntity, Long> {
    Optional<CitaCobroEntity> findByIdCita(Long idCita);
}
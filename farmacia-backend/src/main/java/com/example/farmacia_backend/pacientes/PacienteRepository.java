package com.example.farmacia_backend.pacientes;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PacienteRepository extends JpaRepository<PacienteEntity, Long> {

    boolean existsByNombresIgnoreCaseAndApellidosIgnoreCase(String nombres, String apellidos);

    boolean existsByNombresIgnoreCaseAndApellidosIgnoreCaseAndIdPacienteNot(
            String nombres, String apellidos, Long idPaciente);

    List<PacienteEntity> findAllByActivoTrue();
}
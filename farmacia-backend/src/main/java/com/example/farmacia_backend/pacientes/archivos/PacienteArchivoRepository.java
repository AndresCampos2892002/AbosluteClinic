package com.example.farmacia_backend.pacientes.archivos;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PacienteArchivoRepository extends JpaRepository<PacienteArchivoEntity, Long> {

    List<PacienteArchivoEntity> findByIdPacienteAndActivoTrueOrderByCreadoEnDesc(Long idPaciente);

    List<PacienteArchivoEntity> findByIdPacienteOrderByCreadoEnDesc(Long idPaciente);

    Optional<PacienteArchivoEntity> findByIdArchivoAndIdPaciente(Long idArchivo, Long idPaciente);
}
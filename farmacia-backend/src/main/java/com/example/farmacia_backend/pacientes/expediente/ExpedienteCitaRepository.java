package com.example.farmacia_backend.pacientes.expediente.repo;

import com.example.farmacia_backend.citas.CitaEntity;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

/**
 * Repository de solo lectura para el expediente.
 * Usa query nativa para obtener citas con todos sus datos relacionados
 * en una sola consulta (sucursal, servicio, especialista).
 */
public interface ExpedienteCitaRepository extends Repository<CitaEntity, Long> {

    interface Row {
        Long    getIdCita();
        Long    getIdSucursal();
        String  getSucursalNombre();
        Long    getIdPaciente();
        Long    getIdServicio();
        String  getServicioNombre();
        Long    getIdEspecialista();
        String  getEspecialistaNombre();
        String  getFechaInicio();
        String  getFechaFin();
        Integer getDuracionMinutos();
        String  getEstado();
        String  getCanal();
        String  getMotivo();
        String  getNotas();
    }

    @Query(value = """
        SELECT
          c.id_cita                         AS idCita,
          c.id_sucursal                     AS idSucursal,
          s.nombre                          AS sucursalNombre,
          c.id_paciente                     AS idPaciente,
          c.id_servicio                     AS idServicio,
          sv.nombre                         AS servicioNombre,
          c.id_especialista                 AS idEspecialista,
          CASE
            WHEN c.id_especialista IS NULL THEN NULL
            ELSE CONCAT(u.nombre, ' ', u.apellido)
          END                               AS especialistaNombre,
          CAST(c.fecha_inicio AS text)      AS fechaInicio,
          CAST(c.fecha_fin    AS text)      AS fechaFin,
          c.duracion_minutos                AS duracionMinutos,
          c.estado                          AS estado,
          c.canal                           AS canal,
          c.motivo                          AS motivo,
          c.notas                           AS notas
        FROM citas c
        JOIN sucursales s  ON s.id_sucursal  = c.id_sucursal
        JOIN servicios  sv ON sv.id_servicio = c.id_servicio
        LEFT JOIN usuarios u ON u.id_usuario = c.id_especialista
        WHERE c.id_paciente = :idPaciente
        ORDER BY c.fecha_inicio DESC
    """, nativeQuery = true)
    List<Row> findExpediente(@Param("idPaciente") Long idPaciente);
}
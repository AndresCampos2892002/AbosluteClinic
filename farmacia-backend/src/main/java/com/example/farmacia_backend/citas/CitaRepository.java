package com.example.farmacia_backend.citas;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface CitaRepository extends JpaRepository<CitaEntity, Long> {

    List<CitaEntity> findByIdSucursalAndFechaInicioBetweenOrderByFechaInicioAsc(
            Long idSucursal, OffsetDateTime desde, OffsetDateTime hasta);

    List<CitaEntity> findByIdPacienteOrderByFechaInicioDesc(Long idPaciente);

    List<CitaEntity> findByFechaInicioBetweenOrderByFechaInicioAsc(
            OffsetDateTime desde, OffsetDateTime hasta);

    @Query("select u.idUsuario from UserEntity u where u.estado = true " +
           "and u.rol in ('SUPER_ADMIN','ADMIN','ESPECIALISTA')")
    List<Long> findClinicUserIds();

    // Detecta solape de horario para un especialista
    @Query("""
        select (count(c) > 0)
          from CitaEntity c
         where c.idEspecialista = :idEspecialista
           and c.estado <> com.example.farmacia_backend.citas.CitaEstado.CANCELADA
           and c.fechaInicio < :fin
           and c.fechaFin    > :inicio
    """)
    boolean existeSolapeEspecialista(
            @Param("idEspecialista") Long idEspecialista,
            @Param("inicio") OffsetDateTime inicio,
            @Param("fin") OffsetDateTime fin);

    // Igual pero excluye la cita actual (para editar)
    @Query("""
        select (count(c) > 0)
          from CitaEntity c
         where c.idEspecialista = :idEspecialista
           and c.idCita         <> :idCita
           and c.estado         <> com.example.farmacia_backend.citas.CitaEstado.CANCELADA
           and c.fechaInicio    < :fin
           and c.fechaFin       > :inicio
    """)
    boolean existeSolapeEspecialistaExcluyendo(
            @Param("idCita") Long idCita,
            @Param("idEspecialista") Long idEspecialista,
            @Param("inicio") OffsetDateTime inicio,
            @Param("fin") OffsetDateTime fin);

    @Query("""
        select c from CitaEntity c
        where c.fechaInicio >= :from
          and c.fechaInicio  < :to
          and c.estado in :estados
    """)
    List<CitaEntity> findForReminder(
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to,
            @Param("estados") List<CitaEstado> estados);

    long countByFechaInicioBetween(OffsetDateTime start, OffsetDateTime end);

    long countByEstadoAndFechaInicioBetween(
            CitaEstado estado, OffsetDateTime start, OffsetDateTime end);
}
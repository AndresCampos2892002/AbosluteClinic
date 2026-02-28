package com.example.farmacia_backend.citas;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Duration;
import java.time.OffsetDateTime;

/**
 * Nota: @PrePersist se mantiene SOLO para la lógica de negocio de normalización
 * de fechas (fechaFin y duracionMinutos), que no tiene equivalente en Hibernate.
 */
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@Entity
@Table(name = "citas")
public class CitaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cita")
    private Long idCita;

    @Column(name = "id_sucursal", nullable = false)
    private Long idSucursal;

    @Column(name = "id_paciente", nullable = false)
    private Long idPaciente;

    @Column(name = "id_servicio", nullable = false)
    private Long idServicio;

    @Column(name = "id_especialista")
    private Long idEspecialista;

    @Column(name = "fecha_inicio", nullable = false)
    private OffsetDateTime fechaInicio;

    @Column(name = "fecha_fin", nullable = false)
    private OffsetDateTime fechaFin;

    @Column(name = "duracion_minutos", nullable = false)
    private Integer duracionMinutos;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", nullable = false, length = 20)
    private CitaEstado estado;

    @Column(name = "canal", length = 20)
    private String canal;

    @Column(name = "motivo", length = 200)
    private String motivo;

    @Column(name = "notas", columnDefinition = "text")
    private String notas;

    @Column(name = "creado_por")
    private Long creadoPor;

    @Column(name = "actualizado_por")
    private Long actualizadoPor;

    @CreationTimestamp
    @Column(name = "creado_en", nullable = false, updatable = false)
    private OffsetDateTime creadoEn;

    @UpdateTimestamp
    @Column(name = "actualizado_en")
    private OffsetDateTime actualizadoEn;

    // @PrePersist se mantiene SOLO para normalización de fechas de negocio
    @PrePersist
    void prePersist() {
        if (estado == null) estado = CitaEstado.PENDIENTE;

        // Si mandan duracion pero no fechaFin → calcular fechaFin
        if (fechaInicio != null && duracionMinutos != null && duracionMinutos > 0 && fechaFin == null) {
            fechaFin = fechaInicio.plusMinutes(duracionMinutos);
        }
        // Si mandan fechaFin pero no duracion → calcular duracion
        if (fechaInicio != null && fechaFin != null && (duracionMinutos == null || duracionMinutos <= 0)) {
            long mins = Duration.between(fechaInicio, fechaFin).toMinutes();
            duracionMinutos = (int) Math.max(1, mins);
        }
    }
}
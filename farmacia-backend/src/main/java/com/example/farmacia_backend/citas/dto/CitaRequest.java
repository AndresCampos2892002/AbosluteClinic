package com.example.farmacia_backend.citas.dto;

import com.example.farmacia_backend.citas.CitaEstado;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.OffsetDateTime;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CitaRequest {

    @NotNull(message = "idSucursal es requerido")
    private Long idSucursal;

    @NotNull(message = "idPaciente es requerido")
    private Long idPaciente;

    @NotNull(message = "idServicio es requerido")
    private Long idServicio;

    private Long idEspecialista; 

    @NotNull(message = "fechaInicio es requerida")
    private OffsetDateTime fechaInicio;

    /**
     * Puedes mandar duracionMinutos O fechaFin — el service calcula el que falta.
     * Si mandas ambos, duracionMinutos tiene prioridad.
     */
    private Integer        duracionMinutos;
    private OffsetDateTime fechaFin;

    private String canal;
    private String motivo;
    private String notas;

    private CitaEstado estado;

    // TODO: pendiente de implementar en frontend
    private CitaEstado.CancelacionCobro cancelacionCobro;
}
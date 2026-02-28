package com.example.farmacia_backend.pacientes;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@Entity
@Table(name = "pacientes")
public class PacienteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_paciente")
    private Long idPaciente;

    @Column(nullable = false, length = 120)
    private String nombres;

    @Column(length = 120)
    private String apellidos;

    @Column(length = 20)
    private String telefono;

    @Column(length = 160)
    private String correo;

    @Column(length = 25)
    private String nit;

    @Column(length = 25)
    private String dpi;

    @Column(length = 220)
    private String direccion;

    @Column(nullable = false)
    private Boolean activo = true;

    @Column(name = "creado_por")
    private Long creadoPor;

    @Column(name = "id_sucursal_creado")
    private Long idSucursalCreado;

    @CreationTimestamp
    @Column(name = "creado_en", nullable = false, updatable = false)
    private OffsetDateTime creadoEn;

    @UpdateTimestamp
    @Column(name = "actualizado_en", nullable = false)
    private OffsetDateTime actualizadoEn;
}
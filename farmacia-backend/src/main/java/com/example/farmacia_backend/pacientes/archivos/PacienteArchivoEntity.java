package com.example.farmacia_backend.pacientes.archivos;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "paciente_archivos")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PacienteArchivoEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_archivo")
    private Long idArchivo;

    @Column(name = "id_paciente", nullable = false)
    private Long idPaciente;

    @Column(name = "id_cita")
    private Long idCita;

    @Column(name = "titulo", length = 140)
    private String titulo;

    @Column(name = "tipo", length = 30, nullable = false)
    private String tipo; // DOCUMENTO, LAB, RX, FOTO, OTRO

    @Column(name = "filename", length = 255, nullable = false)
    private String filename;

    @Column(name = "mime", length = 120)
    private String mime;

    @Column(name = "size_bytes")
    private Long sizeBytes;

    @Column(name = "storage_key", length = 500, nullable = false)
    private String storageKey;

    @Builder.Default
    @Column(name = "activo", nullable = false)
    private Boolean activo = true;

    @Column(name = "creado_por")
    private Long creadoPor;

    @CreationTimestamp
    @Column(name = "creado_en", nullable = false, updatable = false)
    private OffsetDateTime creadoEn;
}
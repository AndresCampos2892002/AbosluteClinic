package com.example.farmacia_backend.especialistas;

import com.example.farmacia_backend.users.UserEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.OffsetDateTime;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@Entity
@Table(name = "especialistas")
public class EspecialistaEntity {

    @Id
    @Column(name = "especialista_id")
    private Long especialistaId;

    /**
     * Relación 1:1 con usuarios, compartiendo PK.
     * especialistas.especialista_id = usuarios.id_usuario
     */
    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "especialista_id", referencedColumnName = "id_usuario")
    private UserEntity usuario;

    @Column(nullable = false, length = 120)
    private String especialidad;

    @Column(nullable = false)
    private boolean estado = true;

    @CreationTimestamp
    @Column(name = "creado_en", nullable = false, updatable = false)
    private OffsetDateTime creadoEn;

    @UpdateTimestamp
    @Column(name = "actualizado_en", nullable = false)
    private OffsetDateTime actualizadoEn;
}
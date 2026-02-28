package com.example.farmacia_backend.users;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

/**
 * Entidad para la tabla: usuarios
 */
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@Entity
@Table(name = "usuarios")
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_usuario")
    private Long idUsuario;

    @Column(name = "usuario", nullable = false, length = 60, unique = true)
    private String usuario;

    @Column(name = "correo", nullable = false, length = 120, unique = true)
    private String correo;

    @Column(name = "contrasena", nullable = false, length = 255)
    private String contrasena;

    @Enumerated(EnumType.STRING)
    @Column(name = "rol", nullable = false, length = 30)
    private Role rol;

    @Column(name = "nombre", nullable = false, length = 80)
    private String nombre;

    @Column(name = "apellido", nullable = false, length = 80)
    private String apellido;

    @Column(name = "telefono", length = 25)
    private String telefono;

    @Column(name = "estado", nullable = false)
    private boolean estado;

    @Column(name = "id_sucursal", nullable = false)
    private Long idSucursal;

    @Column(name = "creado_por")
    private Long creadoPor;

    @Column(name = "actualizado_por")
    private Long actualizadoPor;

    @CreationTimestamp
    @Column(name = "creado_en", nullable = false, updatable = false)
    private OffsetDateTime creadoEn;

    @UpdateTimestamp
    @Column(name = "actualizado_en", nullable = false)
    private OffsetDateTime actualizadoEn;
}
package com.example.farmacia_backend.servicios;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@Entity
@Table(name = "servicios_precios")
public class ServicioPrecioEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_servicio_precio")
    private Long idServicioPrecio;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_servicio", nullable = false)
    private ServicioEntity servicio;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal precio;

    @Column(nullable = false, length = 10)
    private String moneda;

    @Column(name = "vigente_desde", nullable = false, columnDefinition = "timestamptz")
    private OffsetDateTime vigenteDesde;

    @Column(name = "vigente_hasta", columnDefinition = "timestamptz")
    private OffsetDateTime vigenteHasta;

    @Column(name = "creado_por")
    private Long creadoPor;

    @CreationTimestamp
    @Column(name = "creado_en", nullable = false, updatable = false)
    private OffsetDateTime creadoEn;

    // @PrePersist se mantiene SOLO para defaults de negocio
    @PrePersist
    public void prePersist() {
        if (vigenteDesde == null) vigenteDesde = OffsetDateTime.now();
        if (moneda == null || moneda.isBlank()) moneda = "GTQ";
    }
}
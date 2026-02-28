package com.example.farmacia_backend.caja;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@Entity
@Table(
        name = "cita_cobro",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_cita_cobro_id_cita", columnNames = "id_cita")
        }
)
public class CitaCobroEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_cobro")
    private Long idCobro;

    @Column(name = "id_cita", nullable = false)
    private Long idCita;

    @Column(name = "moneda", nullable = false, length = 3)
    private String moneda;

    @Column(name = "items", nullable = false, columnDefinition = "jsonb")
    private String items;

    @Column(name = "pagos", nullable = false, columnDefinition = "jsonb")
    private String pagos;

    @Column(name = "total", nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @Column(name = "pagado", nullable = false, precision = 12, scale = 2)
    private BigDecimal pagado;

    @Column(name = "saldo", nullable = false, precision = 12, scale = 2)
    private BigDecimal saldo;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_pago", nullable = false, length = 20)
    private EstadoPago estadoPago;

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
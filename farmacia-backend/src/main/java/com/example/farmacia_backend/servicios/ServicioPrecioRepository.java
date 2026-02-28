package com.example.farmacia_backend.servicios;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface ServicioPrecioRepository extends JpaRepository<ServicioPrecioEntity, Long> {

    // Precio actual: vigente_hasta IS NULL → el más reciente
    @Query("""
        select p
          from ServicioPrecioEntity p
         where p.servicio.idServicio = :idServicio
           and p.vigenteHasta is null
         order by p.vigenteDesde desc
    """)
    Optional<ServicioPrecioEntity> findPrecioActual(@Param("idServicio") Long idServicio);

    // Historial completo (más reciente primero)
    @Query("""
        select p
          from ServicioPrecioEntity p
         where p.servicio.idServicio = :idServicio
         order by p.vigenteDesde desc
    """)
    List<ServicioPrecioEntity> findHistorial(@Param("idServicio") Long idServicio);

    // Cierra todos los precios vigentes antes de insertar uno nuevo
    @Modifying
    @Transactional
    @Query("""
        update ServicioPrecioEntity p
           set p.vigenteHasta = :ahora
         where p.servicio.idServicio = :idServicio
           and p.vigenteHasta is null
    """)
    int cerrarVigentes(@Param("idServicio") Long idServicio, @Param("ahora") OffsetDateTime ahora);

    // Lista de precios vigentes (para CajaService u otros consumidores)
    @Query("""
        select p.precio
          from ServicioPrecioEntity p
         where p.servicio.idServicio = :idServicio
           and (p.vigenteDesde is null or p.vigenteDesde <= CURRENT_TIMESTAMP)
           and (p.vigenteHasta is null or p.vigenteHasta >= CURRENT_TIMESTAMP)
         order by p.vigenteDesde desc nulls last, p.idServicioPrecio desc
    """)
    List<BigDecimal> findPreciosVigentes(@Param("idServicio") Long idServicio);

    // Shortcut usado por CajaService
    default Optional<BigDecimal> findPrecioVigente(Long idServicio) {
        var list = findPreciosVigentes(idServicio);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    // CORRECCIÓN #4: Batch query para obtener precio actual de múltiples servicios
    // Evita el problema N+1 en listarActivos() y listarTodos()
    @Query("""
        select p
          from ServicioPrecioEntity p
         where p.servicio.idServicio in :ids
           and p.vigenteHasta is null
         order by p.vigenteDesde desc
    """)
    List<ServicioPrecioEntity> findPreciosActualesByIds(@Param("ids") List<Long> ids);
}
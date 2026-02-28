package com.example.farmacia_backend.users;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<UserEntity, Long> {

    Optional<UserEntity> findByUsuarioIgnoreCaseOrCorreoIgnoreCase(String usuario, String correo);

    boolean existsByUsuarioIgnoreCase(String usuario);
    boolean existsByCorreoIgnoreCase(String correo);

    Optional<UserEntity> findByUsuarioIgnoreCase(String usuario);
    Optional<UserEntity> findByCorreoIgnoreCase(String correo);

    List<UserEntity> findAllByEstadoTrue();
}
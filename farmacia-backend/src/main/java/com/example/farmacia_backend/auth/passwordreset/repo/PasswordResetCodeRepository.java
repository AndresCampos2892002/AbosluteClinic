package com.example.farmacia_backend.auth.passwordreset.repo;

import com.example.farmacia_backend.auth.passwordreset.entity.PasswordResetCodeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PasswordResetCodeRepository extends JpaRepository<PasswordResetCodeEntity, Long> {
    Optional<PasswordResetCodeEntity> findTopByIdUsuarioAndUsedAtIsNullOrderByCreatedAtDesc(Long idUsuario);
}
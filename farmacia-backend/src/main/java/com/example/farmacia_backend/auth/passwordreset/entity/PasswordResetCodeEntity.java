package com.example.farmacia_backend.auth.passwordreset.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "password_reset_codes")
public class PasswordResetCodeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "id_usuario", nullable = false)
  private Long idUsuario;

  @Column(name = "code_hash", nullable = false, length = 255)
  private String codeHash;

  @Column(name = "expires_at", nullable = false)
  private OffsetDateTime expiresAt;

  @Column(name = "used_at")
  private OffsetDateTime usedAt;

  @Column(name = "attempts", nullable = false)
  private int attempts = 0;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt = OffsetDateTime.now();

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }

  public Long getIdUsuario() { return idUsuario; }
  public void setIdUsuario(Long idUsuario) { this.idUsuario = idUsuario; }

  public String getCodeHash() { return codeHash; }
  public void setCodeHash(String codeHash) { this.codeHash = codeHash; }

  public OffsetDateTime getExpiresAt() { return expiresAt; }
  public void setExpiresAt(OffsetDateTime expiresAt) { this.expiresAt = expiresAt; }

  public OffsetDateTime getUsedAt() { return usedAt; }
  public void setUsedAt(OffsetDateTime usedAt) { this.usedAt = usedAt; }

  public int getAttempts() { return attempts; }
  public void setAttempts(int attempts) { this.attempts = attempts; }

  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}

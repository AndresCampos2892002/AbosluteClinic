package com.example.farmacia_backend.auth.passwordreset.service;

import com.example.farmacia_backend.auth.passwordreset.entity.PasswordResetCodeEntity;
import com.example.farmacia_backend.auth.passwordreset.repo.PasswordResetCodeRepository;
import com.example.farmacia_backend.users.UserEntity;
import com.example.farmacia_backend.users.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.OffsetDateTime;

@Service
public class PasswordResetService {

  private final UserRepository userRepository;
  private final PasswordResetCodeRepository resetRepo;
  private final PasswordEncoder passwordEncoder;
  private final MailService mailService;

  public PasswordResetService(UserRepository userRepository,
                              PasswordResetCodeRepository resetRepo,
                              PasswordEncoder passwordEncoder,
                              MailService mailService) {
    this.userRepository = userRepository;
    this.resetRepo = resetRepo;
    this.passwordEncoder = passwordEncoder;
    this.mailService = mailService;
  }

  public void requestCode(String correo) {
    var user = userRepository.findByCorreoIgnoreCase(correo)
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "Este correo no está registrado."
        ));

    if (!user.isEstado()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tu usuario está inactivo. Contacta a soporte.");
    }

    String code = String.format("%06d", new SecureRandom().nextInt(1_000_000));

    PasswordResetCodeEntity e = new PasswordResetCodeEntity();
    e.setIdUsuario(user.getIdUsuario());
    e.setCodeHash(passwordEncoder.encode(code));
    e.setExpiresAt(OffsetDateTime.now().plusMinutes(10));
    e.setAttempts(0);
    resetRepo.save(e);

    mailService.sendResetCode(user.getCorreo(), code);
  }

  @Transactional(readOnly = true)
  public void validate(String correo, String code) {
    var user = userRepository.findByCorreoIgnoreCase(correo)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Este correo no está registrado."));

    if (!user.isEstado()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tu usuario está inactivo. Contacta a soporte.");
    }

    PasswordResetCodeEntity reset = resetRepo
        .findTopByIdUsuarioAndUsedAtIsNullOrderByCreatedAtDesc(user.getIdUsuario())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Código inválido o vencido"));

    if (reset.getExpiresAt().isBefore(OffsetDateTime.now())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Código inválido o vencido");
    }

    if (reset.getAttempts() >= 5) {
      throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Demasiados intentos. Solicita un nuevo código.");
    }

    if (!passwordEncoder.matches(code, reset.getCodeHash())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Código inválido o vencido");
    }
  }

  @Transactional
  public void confirm(String correo, String code, String nuevaContrasena) {
    UserEntity user = userRepository.findByCorreoIgnoreCase(correo)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Código inválido o vencido"));

    if (!user.isEstado()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tu usuario está inactivo. Contacta a soporte.");
    }

    PasswordResetCodeEntity reset = resetRepo
        .findTopByIdUsuarioAndUsedAtIsNullOrderByCreatedAtDesc(user.getIdUsuario())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Código inválido o vencido"));

    if (reset.getExpiresAt().isBefore(OffsetDateTime.now())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Código inválido o vencido");
    }

    if (reset.getAttempts() >= 5) {
      throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Demasiados intentos. Solicita un nuevo código.");
    }

    // si falla, incrementa intentos
    if (!passwordEncoder.matches(code, reset.getCodeHash())) {
      reset.setAttempts(reset.getAttempts() + 1);
      resetRepo.save(reset);
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Código inválido o vencido");
    }

    // marcar usado
    reset.setUsedAt(OffsetDateTime.now());
    resetRepo.save(reset);

    // actualizar password
    user.setContrasena(passwordEncoder.encode(nuevaContrasena));
    userRepository.save(user);
  }
}

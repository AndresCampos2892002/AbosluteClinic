package com.example.farmacia_backend.especialistas;

import com.example.farmacia_backend.especialistas.dto.EspecialistaResponse;
import com.example.farmacia_backend.especialistas.dto.EspecialistaUpsertRequest;
import com.example.farmacia_backend.users.UserEntity;
import com.example.farmacia_backend.users.UserRepository;
import com.example.farmacia_backend.users.event.UserStatusChangedEvent;
import com.example.farmacia_backend.users.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EspecialistaService {
    private final EspecialistaRepository repo;
    private final UserRepository         userRepo;

    // ─── Consulta ────────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public EspecialistaResponse obtener(Long idUsuario) {
        EspecialistaEntity e = findOrThrow(idUsuario);
        return toResponse(e);
    }
    // ─── Upsert ───────────────────────────────────────────────────────────────
    /**
     * Crea o actualiza el perfil de especialista para ese usuario.
     * Si no existe la fila, la crea. Si ya existe, la actualiza.
     */
    @Transactional
    public EspecialistaResponse upsert(Long idUsuario, EspecialistaUpsertRequest req) {
        UserEntity user = userRepo.findById(idUsuario)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "Usuario no encontrado con id=" + idUsuario));

        if (!user.isEstado()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "No se puede asignar especialidad a un usuario inactivo");
        }

        EspecialistaEntity e = repo.findById(idUsuario).orElseGet(() ->
                EspecialistaEntity.builder()
                        .usuario(user)
                        .estado(true)
                        .build()
        );
        e.setUsuario(user);
        e.setEspecialidad(req.especialidad().trim());
        e.setEstado(true);
        return toResponse(repo.save(e));
    }

    // ─── Listener de eventos de usuario ──────────────────────────────────────
    @EventListener
    @Transactional
    public void onUserStatusChanged(UserStatusChangedEvent event) {
        if (event.activo()) {
            activarSiExiste(event.idUsuario());
        } else {
            desactivarSiExiste(event.idUsuario());
        }
    }
    // ─── Helpers de estado ───────────────────────────────────────────────────
    @Transactional
    public void desactivarSiExiste(Long idUsuario) {
        repo.findById(idUsuario).ifPresent(e -> {
            e.setEstado(false);
            repo.save(e);
        });
    }

    @Transactional
    public void activarSiExiste(Long idUsuario) {
        repo.findById(idUsuario).ifPresent(e -> {
            e.setEstado(true);
            repo.save(e);
        });
    }

    // ─── Helpers privados ─────────────────────────────────────────────────────
    private EspecialistaEntity findOrThrow(Long idUsuario) {
        return repo.findById(idUsuario)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "No existe perfil de especialista para el usuario id=" + idUsuario));
    }

    private EspecialistaResponse toResponse(EspecialistaEntity e) {
        UserEntity u = e.getUsuario();
        return new EspecialistaResponse(
                e.getEspecialistaId(),
                e.getEspecialidad(),
                e.isEstado(),
                e.getCreadoEn(),
                e.getActualizadoEn(),
                u.getNombre(),
                u.getApellido(),
                u.getCorreo(),
                u.getTelefono()
        );
    }
}
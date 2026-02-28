package com.example.farmacia_backend.pacientes.archivos;

import com.example.farmacia_backend.pacientes.archivos.dto.PacienteArchivoDto;
import com.example.farmacia_backend.security.CurrentUserService;
import com.example.farmacia_backend.users.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PacienteArchivoService {

    private final PacienteArchivoRepository repo;
    private final CurrentUserService        currentUserService;

    @Value("${app.uploads.dir:uploads}")
    private String uploadsDir;

    // ─── Listar ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PacienteArchivoDto> listar(Long idPaciente, boolean incluirInactivos) {
        var list = incluirInactivos
                ? repo.findByIdPacienteOrderByCreadoEnDesc(idPaciente)
                : repo.findByIdPacienteAndActivoTrueOrderByCreadoEnDesc(idPaciente);

        return list.stream().map(this::toDto).toList();
    }

    // ─── Subir ────────────────────────────────────────────────────────────────

    @Transactional
    public PacienteArchivoDto subir(Long idPaciente, Long idCita,
                                    String titulo, String tipo,
                                    MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "El archivo no puede estar vacío");
        }
        Long creadoPor = currentUserService.requireUserId();

        String original = sanitize(file.getOriginalFilename());
        String ext      = getExt(original);
        String key      = "pacientes/" + idPaciente + "/" + UUID.randomUUID() + ext;

        Path base   = Paths.get(uploadsDir).toAbsolutePath().normalize();
        Path target = base.resolve(key).normalize();

        // Seguridad: evitar path traversal
        if (!target.startsWith(base)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Ruta de archivo inválida");
        }

        Files.createDirectories(target.getParent());
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        PacienteArchivoEntity e = PacienteArchivoEntity.builder()
                .idPaciente(idPaciente)
                .idCita(idCita)
                .titulo(blankToNull(titulo))
                .tipo(blankToNull(tipo) != null ? blankToNull(tipo) : "OTRO")
                .filename(original)
                .mime(blankToNull(file.getContentType()))
                .sizeBytes(file.getSize())
                .storageKey(key.replace("\\", "/"))
                .activo(true)
                .creadoPor(creadoPor)
                .build();

        return toDto(repo.save(e));
    }

    // ─── Descargar ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Resource descargar(Long idPaciente, Long idArchivo) {
        PacienteArchivoEntity e = findOrThrow(idPaciente, idArchivo);

        if (!Boolean.TRUE.equals(e.getActivo())) {
            throw new BusinessException(HttpStatus.GONE, "El archivo está inactivo");
        }

        Path base   = Paths.get(uploadsDir).toAbsolutePath().normalize();
        Path target = base.resolve(e.getStorageKey()).normalize();

        try {
            Resource r = new UrlResource(target.toUri());
            if (!r.exists()) {
                throw new BusinessException(HttpStatus.NOT_FOUND, "Archivo no encontrado en disco");
            }
            return r;
        } catch (MalformedURLException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "Ruta de archivo inválida");
        }
    }

    // ─── Anular ───────────────────────────────────────────────────────────────
    @Transactional
    public PacienteArchivoDto anular(Long idPaciente, Long idArchivo) {
        // CORRECCIÓN #7: devuelve el dto actualizado en lugar de void
        PacienteArchivoEntity e = findOrThrow(idPaciente, idArchivo);

        if (!Boolean.TRUE.equals(e.getActivo())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "El archivo ya está anulado");
        }

        e.setActivo(false);
        return toDto(repo.save(e));
    }
    // ─── Helpers privados ─────────────────────────────────────────────────────
    private PacienteArchivoEntity findOrThrow(Long idPaciente, Long idArchivo) {
        return repo.findByIdArchivoAndIdPaciente(idArchivo, idPaciente)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "Archivo no encontrado"));
    }

    private PacienteArchivoDto toDto(PacienteArchivoEntity e) {
        return new PacienteArchivoDto(
                e.getIdArchivo(),
                e.getIdPaciente(),
                e.getIdCita(),
                e.getTitulo(),
                e.getTipo(),
                e.getFilename(),
                e.getMime(),
                e.getSizeBytes(),
                e.getActivo(),
                e.getCreadoPor(),
                e.getCreadoEn()
        );
    }

    private static String sanitize(String name) {
        if (name == null) return "archivo";
        return name.replaceAll("[\\\\/\\n\\r\\t]", "_").trim();
    }

    private static String getExt(String name) {
        int i = (name == null) ? -1 : name.lastIndexOf('.');
        return (i >= 0) ? name.substring(i).toLowerCase() : "";
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        s = s.trim();
        return s.isEmpty() ? null : s;
    }
}
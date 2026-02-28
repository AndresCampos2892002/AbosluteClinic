package com.example.farmacia_backend.pacientes.archivos;

import com.example.farmacia_backend.pacientes.archivos.dto.PacienteArchivoDto;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/pacientes/{idPaciente}/archivos")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','ESPECIALISTA')")
public class PacienteArchivoController {

    private final PacienteArchivoService service;

    @GetMapping
    public ResponseEntity<List<PacienteArchivoDto>> listar(
            @PathVariable Long idPaciente,
            @RequestParam(defaultValue = "false") boolean inactivos) {
        return ResponseEntity.ok(service.listar(idPaciente, inactivos));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PacienteArchivoDto> subir(
            @PathVariable Long idPaciente,
            @RequestParam(required = false) Long idCita,
            @RequestParam(required = false) String titulo,
            @RequestParam(required = false) String tipo,
            @RequestPart("file") MultipartFile file) throws IOException {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.subir(idPaciente, idCita, titulo, tipo, file));
    }

    @GetMapping("/{idArchivo}/download")
    public ResponseEntity<Resource> download(
            @PathVariable Long idPaciente,
            @PathVariable Long idArchivo) {
        Resource r = service.descargar(idPaciente, idArchivo);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + idArchivo + "\"")
                .body(r);
    }

    @PatchMapping("/{idArchivo}/anular")
    public ResponseEntity<PacienteArchivoDto> anular(
            @PathVariable Long idPaciente,
            @PathVariable Long idArchivo) {
        return ResponseEntity.ok(service.anular(idPaciente, idArchivo));
    }
}
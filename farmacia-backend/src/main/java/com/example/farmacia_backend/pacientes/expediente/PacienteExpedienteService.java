package com.example.farmacia_backend.pacientes.expediente;

import com.example.farmacia_backend.pacientes.PacienteService;
import com.example.farmacia_backend.pacientes.archivos.PacienteArchivoService;
import com.example.farmacia_backend.pacientes.expediente.dto.ExpedienteCitaDto;
import com.example.farmacia_backend.pacientes.expediente.dto.PacienteExpedienteDto;
import com.example.farmacia_backend.pacientes.expediente.repo.ExpedienteCitaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PacienteExpedienteService {

    private final PacienteService           pacienteService;
    private final ExpedienteCitaRepository  expedienteCitaRepo;
    private final PacienteArchivoService    archivoService;

    @Transactional(readOnly = true)
    public PacienteExpedienteDto obtenerExpediente(Long idPaciente, boolean inactivos) {
        // 1. Datos del paciente (reutilizamos PacienteService — sin duplicar lógica)
        var paciente = pacienteService.obtener(idPaciente);

        // 2. Historial de citas con join nativo (1 sola query)
        var citas = expedienteCitaRepo
                .findExpediente(idPaciente)
                .stream()
                .map(this::toCitaDto)
                .toList();

        // 3. Archivos del paciente
        var archivos = archivoService.listar(idPaciente, inactivos);

        return new PacienteExpedienteDto(paciente, citas, archivos);
    }

    private ExpedienteCitaDto toCitaDto(ExpedienteCitaRepository.Row r) {
        return new ExpedienteCitaDto(
                r.getIdCita(),
                r.getIdSucursal(),
                r.getSucursalNombre(),
                r.getIdPaciente(),
                r.getIdServicio(),
                r.getServicioNombre(),
                r.getIdEspecialista(),
                r.getEspecialistaNombre(),
                r.getFechaInicio(),
                r.getFechaFin(),
                r.getDuracionMinutos(),
                r.getEstado(),
                r.getCanal(),
                r.getMotivo(),
                r.getNotas()
        );
    }
}
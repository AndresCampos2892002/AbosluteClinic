package com.example.farmacia_backend.notifications;

import com.example.farmacia_backend.citas.CitaEntity;
import com.example.farmacia_backend.citas.CitaEstado;
import com.example.farmacia_backend.citas.CitaRepository;
import com.example.farmacia_backend.users.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Component
@RequiredArgsConstructor
public class NotificationJobs {

    private final CitaRepository      citaRepo;
    private final UserRepository      userRepo;
    private final NotificationService notifications;

    @Value("${absolute.notifications.reminder-minutes:20}")
    private int reminderMinutes;

    private static final ZoneId           GT   = ZoneId.of("America/Guatemala");
    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm");

    // ─── Recordatorio previo a la cita ───────────────────────────────────────

    /**
     * Se ejecuta cada minuto y envía recordatorio a todos los usuarios clínica
     * para citas que están a `reminderMinutes` minutos de comenzar.
     */
    @Scheduled(fixedDelayString = "${absolute.notifications.reminder-poll-ms:60000}")
    @Transactional
    public void remindUpcoming() {
        OffsetDateTime now  = OffsetDateTime.now();
        OffsetDateTime from = now.plusMinutes(reminderMinutes);
        OffsetDateTime to   = from.plusMinutes(1);

        List<CitaEntity> citas = citaRepo.findForReminder(from, to,
                List.of(CitaEstado.CONFIRMADA, CitaEstado.PENDIENTE));

        if (citas.isEmpty()) return;

        List<Long> clinicUserIds = citaRepo.findClinicUserIds();

        for (CitaEntity c : citas) {
            String hora      = c.getFechaInicio().atZoneSameInstant(GT).toLocalTime().format(HHMM);
            String titulo    = "Cita en " + reminderMinutes + " min";
            String mensaje   = "Tienes una cita a las " + hora + " (ID " + c.getIdCita() + ").";
            String actionUrl = "/citas";
            String dataJson  = "{\"idCita\":" + c.getIdCita() + "}";
            String dedupeKey = "REM" + reminderMinutes + ":CITA:" + c.getIdCita()
                             + ":" + c.getFechaInicio();

            for (Long userId : clinicUserIds) {
                notifications.create(userId, NotificationType.CITA_PROXIMA,
                        titulo, mensaje, actionUrl, dataJson, dedupeKey);
            }
        }
    }

    // ─── Resumen del día siguiente (18:00) ───────────────────────────────────

    @Scheduled(
            cron     = "${absolute.notifications.tomorrow-summary-cron:0 0 18 * * *}",
            zone     = "America/Guatemala"
    )
    @Transactional
    public void tomorrowSummary() {
        LocalDate      tomorrow = LocalDate.now(GT).plusDays(1);
        OffsetDateTime start    = tomorrow.atStartOfDay(GT).toOffsetDateTime();
        OffsetDateTime end      = tomorrow.plusDays(1).atStartOfDay(GT).toOffsetDateTime();

        long total   = citaRepo.countByFechaInicioBetween(start, end);
        // CORRECCIÓN #1: PENDIENTE en lugar de PENDIENTE_CONFIRMAR
        long pending = citaRepo.countByEstadoAndFechaInicioBetween(CitaEstado.PENDIENTE, start, end);

        if (total == 0 && pending == 0) return;

        List<Long> clinicUserIds = citaRepo.findClinicUserIds();

        String titulo    = "Citas de mañana";
        String mensaje   = "Mañana hay " + total + " cita(s). Pendientes de confirmar: " + pending + ".";
        String actionUrl = "/citas";
        String dataJson  = "{\"date\":\"" + tomorrow + "\",\"total\":" + total
                         + ",\"pending\":" + pending + "}";
        String dedupeKey = "RESUMEN_MANANA:" + tomorrow;

        for (Long userId : clinicUserIds) {
            notifications.create(userId, NotificationType.SISTEMA,
                    titulo, mensaje, actionUrl, dataJson, dedupeKey);
        }
    }

    // ─── Recordatorio de pendientes del día (09:00) ──────────────────────────

    @Scheduled(
            cron = "${absolute.notifications.pending-confirm-cron:0 0 9 * * *}",
            zone = "America/Guatemala"
    )
    @Transactional
    public void pendingConfirmReminder() {
        LocalDate      today = LocalDate.now(GT);
        OffsetDateTime start = today.atStartOfDay(GT).toOffsetDateTime();
        OffsetDateTime end   = today.plusDays(1).atStartOfDay(GT).toOffsetDateTime();

        long pendingHoy = citaRepo.countByEstadoAndFechaInicioBetween(CitaEstado.PENDIENTE, start, end);
        if (pendingHoy <= 0) return;

        List<Long> clinicUserIds = citaRepo.findClinicUserIds();

        String titulo    = "Citas pendientes de confirmar";
        String mensaje   = "Tienes " + pendingHoy + " cita(s) pendientes de confirmar hoy.";
        String actionUrl = "/citas";
        String dataJson  = "{\"pending\":" + pendingHoy + "}";
        String dedupeKey = "PENDIENTES_HOY:" + today;

        for (Long userId : clinicUserIds) {
            notifications.create(userId, NotificationType.CITA_PENDIENTE_CONFIRMAR,
                    titulo, mensaje, actionUrl, dataJson, dedupeKey);
        }
    }
}
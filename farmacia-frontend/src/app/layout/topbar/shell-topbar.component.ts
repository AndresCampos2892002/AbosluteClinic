// src/app/layout/shell/topbar/shell-topbar.component.ts
import {
  Component, EventEmitter, HostListener,
  OnDestroy, OnInit, Output, inject, isDevMode,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, timer, of, firstValueFrom } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

import { AuthService } from '../../core/auth/auth.service';
import {
  NotificationsApiService,
  NotificationResponse,
  NotificationType,
} from '../../core/api/notifications-api.service';

// ── Interfaz para el cambio de contraseña ─────────────────────────────────────
// Conectar a tu endpoint cuando esté disponible:
// POST /api/usuarios/me/password  { contrasenaActual, contrasenaNueva }
// ──────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-shell-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shell-topbar.component.html',
  styleUrls: ['./shell-topbar.component.scss'],
})
export class ShellTopbarComponent implements OnInit, OnDestroy {

  @Output() menuClick = new EventEmitter<void>();

  // ── Servicios ──────────────────────────────────────────────────────────────
  readonly auth     = inject(AuthService);
  private readonly router   = inject(Router);
  private readonly notifApi = inject(NotificationsApiService);

  private sub = new Subscription();


  // ── Notificaciones ─────────────────────────────────────────────────────────
  notifOpen    = false;
  notifLoading = false;
  notifs: NotificationResponse[] = [];
  unread = 0;

  // ── Perfil / ajustes ───────────────────────────────────────────────────────
  profileMenuOpen = false;
  settingsOpen    = false;
  settingsTab: 'perfil' | 'password' | 'soporte' = 'perfil';

  // ── Cambio de contraseña ───────────────────────────────────────────────────
  currentPassword = '';
  newPassword     = '';
  confirmPassword = '';
  passwordMsg     = '';
  passwordSaving  = false;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Polling cada 25 s — solo si hay sesión activa.
    this.sub.add(
      timer(0, 25_000).pipe(
        switchMap(() => {
          if (!this.auth.getToken()) return of(null);

          return this.notifApi.unreadCount().pipe(
            tap(r => (this.unread = r?.unread ?? 0)),
            switchMap(() => this.notifOpen ? this.loadNotifs$() : of(null)),
            catchError(() => of(null)),
          );
        }),
      ).subscribe(),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── Getters de usuario ─────────────────────────────────────────────────────

  get user() { return this.auth.getUser(); }

  get initials(): string {
    const u = this.user;
    if (!u) return 'U';
    const n = (u.nombre   ?? '').trim();
    const a = (u.apellido ?? '').trim();
    if (n || a) return ((n[0] ?? '') + (a[0] ?? '')).toUpperCase() || 'U';
    return (u.usuario ?? 'U').slice(0, 2).toUpperCase();
  }

  get displayName(): string {
    const u = this.user;
    if (!u) return '';
    const full = `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim();
    return full || u.usuario;
  }

  // ── Acciones header ────────────────────────────────────────────────────────

  onMenuClick(): void {
    this.menuClick.emit();
  }

  // ── Notificaciones ─────────────────────────────────────────────────────────

  toggleNotif(ev?: Event): void {
    ev?.stopPropagation();
    this.notifOpen = !this.notifOpen;
    if (this.notifOpen) void this.loadNotifs();
  }

  private loadNotifs$() {
    this.notifLoading = true;
    return this.notifApi.list({ unreadOnly: true, limit: 15 }).pipe(
      tap(list => {
        this.notifs       = Array.isArray(list) ? list : [];
        this.notifLoading = false;
      }),
      catchError(() => {
        this.notifLoading = false;
        this.notifs = [];
        return of(null);
      }),
    );
  }

  async loadNotifs(): Promise<void> {
    await firstValueFrom(this.loadNotifs$()).catch(() => {});
  }

  async markRead(n: NotificationResponse, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    await firstValueFrom(this.notifApi.markRead(n.idNotificacion)).catch(() => {});

    // Actualización optimista
    this.notifs = this.notifs.filter(x => x.idNotificacion !== n.idNotificacion);
    this.unread = Math.max(0, this.unread - 1);

    if (n.actionUrl) this.openAction(n.actionUrl);
  }

  async markAllRead(ev?: Event): Promise<void> {
    ev?.stopPropagation();
    await firstValueFrom(this.notifApi.markAllRead()).catch(() => {});
    this.notifs    = [];
    this.unread    = 0;
    this.notifOpen = false;
  }



  openAction(url: string): void {
    if (/^https?:\/\//i.test(url)) { window.open(url, '_blank'); return; }
    this.router.navigateByUrl(url);
  }

  tipoLabel(t: NotificationType): string {
    const map: Record<NotificationType, string> = {
      CITA_PROXIMA:            'Cita próxima',
      CITA_PENDIENTE_CONFIRMAR: 'Pendiente',
      SISTEMA:                  'Sistema',
    };
    return map[t] ?? t;
  }

  // ── Perfil / menú ──────────────────────────────────────────────────────────

  toggleProfileMenu(ev: Event): void {
    ev.stopPropagation();
    this.profileMenuOpen = !this.profileMenuOpen;
  }

  openSettings(tab: 'perfil' | 'password' | 'soporte'): void {
    this.profileMenuOpen = false;
    this.settingsTab     = tab;
    this.settingsOpen    = true;
    this.passwordMsg     = '';
  }

  closeSettings(): void {
    this.settingsOpen   = false;
    this.passwordSaving = false;
    this.currentPassword = '';
    this.newPassword     = '';
    this.confirmPassword = '';
    this.passwordMsg     = '';
  }

  // ── Cambio de contraseña ───────────────────────────────────────────────────

  savePassword(): void {
    const cur = this.currentPassword.trim();
    const nw  = this.newPassword.trim();
    const cf  = this.confirmPassword.trim();

    if (!cur || !nw || !cf)
      { this.passwordMsg = 'Completa todos los campos.'; return; }
    if (nw !== cf)
      { this.passwordMsg = 'La confirmación no coincide.'; return; }
    if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(nw))
      { this.passwordMsg = 'Mínimo 8 caracteres, 1 mayúscula y 1 número.'; return; }

    // TODO: conectar endpoint cuando esté listo en el backend.
    // Ejemplo:
    // this.passwordSaving = true;
    // this.usersApi.cambiarPassword({ contrasenaActual: cur, contrasenaNueva: nw })
    //   .pipe(finalize(() => (this.passwordSaving = false)))
    //   .subscribe({
    //     next: () => { this.passwordMsg = 'Contraseña actualizada.'; this.closeSettings(); },
    //     error: (err) => { this.passwordMsg = httpErrorMessage(err, 'No se pudo cambiar la contraseña.'); },
    //   });

    this.passwordMsg = 'Pendiente: endpoint de cambio de contraseña no configurado aún.';
  }

  // ── Soporte ────────────────────────────────────────────────────────────────

  contactSupport(): void {
    window.location.href = 'mailto:soporte@tudominio.com?subject=Soporte%20Absolute%20Panel';
  }

  contactWhatsApp(): void {
    window.open('https://wa.me/50233355691?text=Hola%20soporte%20Absolute,%20necesito%20ayuda', '_blank');
  }

  // ── Click fuera cierra menús ───────────────────────────────────────────────

  @HostListener('document:click')
  onDocClick(): void {
    if (this.notifOpen)     this.notifOpen = false;
    if (this.profileMenuOpen) this.profileMenuOpen = false;
  }
}
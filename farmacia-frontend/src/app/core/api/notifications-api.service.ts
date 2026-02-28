// src/app/core/api/notifications-api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ── Tipos ──────────────────────────────────────────────────────────────────────
export type NotificationType =
  | 'CITA_PROXIMA'
  | 'CITA_PENDIENTE_CONFIRMAR'
  | 'SISTEMA';

export interface NotificationResponse {
  idNotificacion: number;
  tipo:           NotificationType;
  titulo:         string;
  mensaje:        string;
  dataJson?:      string | null;
  actionUrl?:     string | null;
  creadoEn:       string;
  leidoEn?:       string | null;
}

export interface UnreadCountResponse {
  unread: number;
}

// ── Servicio ───────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class NotificationsApiService {

  private readonly http = inject(HttpClient);
  private readonly api  = (environment.apiUrl || '').replace(/\/+$/, '');
  private readonly base = `${this.api}/api/notifications`;

  /** Lista de notificaciones. Por defecto trae solo las no leídas (unreadOnly=true). */
  list(opts?: { unreadOnly?: boolean; limit?: number }): Observable<NotificationResponse[]> {
    let params = new HttpParams();
    if (opts?.unreadOnly !== undefined)
      params = params.set('unreadOnly', String(opts.unreadOnly));
    if (opts?.limit !== undefined)
      params = params.set('limit', String(opts.limit));
    return this.http.get<NotificationResponse[]>(this.base, { params });
  }

  /** Conteo de no leídas — endpoint ligero para el polling del topbar. */
  unreadCount(): Observable<UnreadCountResponse> {
    return this.http.get<UnreadCountResponse>(`${this.base}/unread-count`);
  }

  /** Marca una notificación como leída. */
  markRead(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/read`, {});
  }

  /** Marca todas las notificaciones del usuario como leídas. */
  markAllRead(): Observable<void> {
    return this.http.post<void>(`${this.base}/read-all`, {});
  }

  /**
   * Solo en dev: crea una notificación de prueba sin necesitar Postman.
   * El backend debe proteger este endpoint con @Profile("dev") o similar.
   */
  testCreate(): Observable<void> {
    return this.http.post<void>(`${this.base}/_test`, {});
  }
}
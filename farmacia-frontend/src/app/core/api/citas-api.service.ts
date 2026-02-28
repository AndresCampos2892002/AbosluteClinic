// src/app/core/api/citas-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export type EstadoCita =
  'PENDIENTE'|'CONFIRMADA'|'TERMINADA'|'CANCELADA'|'NO_ASISTIO'|'REPROGRAMADA';

export type CanalCita = 'WHATSAPP'|'LLAMADA'|'WEB'|'RECEPCION'|string;
export type CancelacionCobro = 'PAGO_INMEDIATO' | 'CUENTA_POR_COBRAR';
export interface CitaResponse {
  idCita: number;

  idSucursal: number;
  idSucursalCreado?: number | null;

  idPaciente: number;
  idServicio: number;
  idEspecialista?: number | null;

  fechaInicio: string; // OffsetDateTime string
  fechaFin?: string | null;
  duracionMinutos?: number | null;

  estado: EstadoCita;

  cancelacionCobro?: CancelacionCobro | null;

  canal?: string | null;
  motivo?: string | null;
  notas?: string | null;

  creadoEn?: string | null;
  creadoPor?: number | null;

  actualizadoEn?: string | null;
  actualizadoPor?: number | null;
}

export interface CitaRequest {
  idSucursal: number;
  idPaciente: number;
  idServicio: number;
  idEspecialista: number | null;

  fechaInicio: string;          // ISO con offset
  duracionMinutos?: number | null;
  fechaFin?: string | null;

  canal?: string | null;
  motivo?: string | null;
  notas?: string | null;

  // SOLO cuando TERMINADA (pago)
  cancelacionCobro?: CancelacionCobro | null;

  estado?: EstadoCita | null;
}

@Injectable({ providedIn: 'root' })
export class CitasApiService {
  private base = `${environment.apiUrl}/api/citas`;

  constructor(private http: HttpClient) {}

  listar(params?: {
    idSucursal?: number;
    desde?: string;
    hasta?: string;
  }) {
    let hp = new HttpParams();
    if (params?.idSucursal != null) hp = hp.set('idSucursal', String(params.idSucursal));
    if (params?.desde) hp = hp.set('desde', params.desde);
    if (params?.hasta) hp = hp.set('hasta', params.hasta);

    return this.http.get<CitaResponse[]>(this.base, { params: hp });
  }

  crear(req: CitaRequest) {
    return this.http.post<CitaResponse>(this.base, req);
  }

  editar(idCita: number, req: CitaRequest) {
    return this.http.put<CitaResponse>(`${this.base}/${idCita}`, req);
  }

  // tu backend usa PATCH /{id}/estado con {estado, nota}
  cambiarEstado(idCita: number, estado: EstadoCita, nota?: string | null) {
    return this.http.patch<CitaResponse>(`${this.base}/${idCita}/estado`, {
      estado,
      nota: nota ?? null
    });
  }

  // cancelar = cambiar estado a CANCELADA
  cancelar(idCita: number, motivo?: string | null) {
    return this.cambiarEstado(idCita, 'CANCELADA', motivo ?? null);
  }

  // tu backend NO tiene /especialista. Lo más simple: usar PUT /{id} mandando solo idEspecialista
  asignarEspecialista(idCita: number, idEspecialista: number | null) {
    return this.http.put<CitaResponse>(`${this.base}/${idCita}`, { idEspecialista });
  }
}

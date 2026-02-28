// src/app/core/api/servicios-api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ServicioResponse {
  idServicio: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;

  precioActual?: number | null;
  moneda?: string | null;

  creadoPor?: number | null;
  creadoEn?: string | null;
  actualizadoEn?: string | null;
}

export interface ServicioCreateRequest {
  nombre: string;
  descripcion?: string | null;
  precioInicial?: number | null;
  moneda?: string | null; // GTQ default
}

export interface ServicioUpdateRequest {
  nombre?: string | null;
  descripcion?: string | null;
  activo?: boolean | null;
}

export interface ServicioPrecioRequest {
  precio: number;
  moneda?: string | null;
}

export interface ServicioPrecioResponse {
  idServicioPrecio: number;
  precio: number;
  moneda: string;
  vigenteDesde?: string | null;
  vigenteHasta?: string | null;
}

export interface ExpedienteCitaResponse {
  idCita: number;

  idSucursal: number;
  sucursalNombre?: string | null;

  idPaciente: number;

  idServicio: number;
  servicioNombre?: string | null;

  idEspecialista?: number | null;
  especialistaNombre?: string | null;

  fechaInicio: string;
  fechaFin: string;
  duracionMinutos: number;
  estado: any;
  canal?: string | null;
  motivo?: string | null;
  notas?: string | null;
}


@Injectable({ providedIn: 'root' })
export class ServiciosApiService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/servicios`;

  listarActivos(): Observable<ServicioResponse[]> {
    return this.http.get<ServicioResponse[]>(this.baseUrl);
  }

  listarTodos(): Observable<ServicioResponse[]> {
    return this.http.get<ServicioResponse[]>(`${this.baseUrl}/all`);
  }
  obtener(id: number): Observable<ServicioResponse> {
    return this.http.get<ServicioResponse>(`${this.baseUrl}/${id}`);
  }

  crear(payload: ServicioCreateRequest): Observable<ServicioResponse> {
    return this.http.post<ServicioResponse>(this.baseUrl, payload);
  }

  editar(id: number, payload: ServicioUpdateRequest): Observable<ServicioResponse> {
    return this.http.put<ServicioResponse>(`${this.baseUrl}/${id}`, payload);
  }

  setPrecio(idServicio: number, payload: ServicioPrecioRequest): Observable<ServicioPrecioResponse> {
    return this.http.post<ServicioPrecioResponse>(`${this.baseUrl}/${idServicio}/precio`, payload);
  }

  historialPrecios(idServicio: number): Observable<ServicioPrecioResponse[]> {
    return this.http.get<ServicioPrecioResponse[]>(`${this.baseUrl}/${idServicio}/precios`);
  }

  inactivar(id: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/inactivar`, {});
  }

  reactivar(id: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/reactivar`, {});
  }
}

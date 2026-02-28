// src/app/core/api/pacientes-api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PacienteResponse {
  idPaciente: number;
  nombres: string;
  apellidos?: string | null;
  telefono?: string | null;
  correo?: string | null;
  nit?: string | null;
  dpi?: string | null;
  direccion?: string | null;
  activo: boolean;

  creadoPor?: number | null;
  creadoPorNombre?: string | null;
  idSucursalCreado?: number | null;
  sucursalNombre?: string | null;

  creadoEn?: string | null;
  actualizadoEn?: string | null;
}

export interface PacienteCreateRequest {
  nombres: string;
  apellidos?: string | null;
  telefono?: string | null;
  correo?: string | null;
  nit?: string | null;
  dpi?: string | null;
  direccion?: string | null;
}

export interface PacienteUpdateRequest {
  nombres?: string | null;
  apellidos?: string | null;
  telefono?: string | null;
  correo?: string | null;
  nit?: string | null;
  dpi?: string | null;
  direccion?: string | null;
  activo?: boolean | null;
}

/** ====== ARCHIVOS ====== */
export interface PacienteArchivoResponse {
  idArchivo: number;
  idPaciente: number;
  idCita?: number | null;
  titulo?: string | null;
  tipo: string; // DOCUMENTO, LAB, RX, FOTO, OTRO
  filename: string;
  mime?: string | null;
  sizeBytes?: number | null;
  activo: boolean;
  creadoEn?: string | null;
}

/** ====== CITAS (para expediente) ====== */
export interface ExpedienteCitaResponse {
  idCita: number;
  idSucursal: number;
  idPaciente: number;
  idServicio: number;
  idEspecialista?: number | null;
  fechaInicio: string;
  fechaFin: string;
  duracionMinutos: number;
  estado: any;        
  canal?: string | null;
  motivo?: string | null;
  notas?: string | null;
}

/** ====== EXPEDIENTE ====== */
export interface PacienteExpedienteResponse {
  paciente: PacienteResponse;
  citas: ExpedienteCitaResponse[];
  archivos: PacienteArchivoResponse[];
}

@Injectable({ providedIn: 'root' })
export class PacientesApiService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/pacientes`;

  // Activos (GET /api/pacientes)
  listar(): Observable<PacienteResponse[]> {
    return this.http.get<PacienteResponse[]>(this.baseUrl);
  }

  // Todos (GET /api/pacientes/all)
  listarTodos(): Observable<PacienteResponse[]> {
    return this.http.get<PacienteResponse[]>(`${this.baseUrl}/all`);
  }

  obtener(id: number): Observable<PacienteResponse> {
    return this.http.get<PacienteResponse>(`${this.baseUrl}/${id}`);
  }

  crear(payload: PacienteCreateRequest): Observable<PacienteResponse> {
    return this.http.post<PacienteResponse>(this.baseUrl, payload);
  }

  editar(id: number, payload: PacienteUpdateRequest): Observable<PacienteResponse> {
    return this.http.put<PacienteResponse>(`${this.baseUrl}/${id}`, payload);
  }

  inactivar(id: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/inactivar`, {});
  }

  reactivar(id: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/reactivar`, {});
  }

  // =========================
  // EXPEDIENTE (Paciente + Citas + Archivos)
  // GET /api/pacientes/{idPaciente}/expediente?inactivos=true|false
  // =========================
  obtenerExpediente(idPaciente: number, inactivos = false): Observable<PacienteExpedienteResponse> {
    const params = new HttpParams().set('inactivos', String(inactivos));
    return this.http.get<PacienteExpedienteResponse>(`${this.baseUrl}/${idPaciente}/expediente`, { params });
  }

  // =========================
  // ARCHIVOS
  // /api/pacientes/{idPaciente}/archivos
  // =========================
  listarArchivos(idPaciente: number, inactivos = false): Observable<PacienteArchivoResponse[]> {
    const params = new HttpParams().set('inactivos', String(inactivos));
    return this.http.get<PacienteArchivoResponse[]>(`${this.baseUrl}/${idPaciente}/archivos`, { params });
  }

  subirArchivo(
    idPaciente: number,
    file: File,
    data?: { idCita?: number | null; titulo?: string | null; tipo?: string | null; }
  ): Observable<PacienteArchivoResponse> {
    const fd = new FormData();
    fd.append('file', file);

    if (data?.idCita != null) fd.append('idCita', String(data.idCita));
    if (data?.titulo != null) fd.append('titulo', String(data.titulo));
    if (data?.tipo != null) fd.append('tipo', String(data.tipo));

    return this.http.post<PacienteArchivoResponse>(`${this.baseUrl}/${idPaciente}/archivos`, fd);
  }

  anularArchivo(idPaciente: number, idArchivo: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${idPaciente}/archivos/${idArchivo}/anular`, {});
  }

  descargarArchivo(idPaciente: number, idArchivo: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${idPaciente}/archivos/${idArchivo}/download`, {
      responseType: 'blob',
    });
  }
}

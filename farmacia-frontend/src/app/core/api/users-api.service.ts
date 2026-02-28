// src/app/core/api/users-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'CAJA' | 'SECRETARIA' | 'ESPECIALISTA';

export interface UserResponse {
  idUsuario: number;
  usuario: string;
  correo: string;
  rol: Role;
  nombre: string;
  apellido: string;
  telefono: string;
  estado: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface UserDetailResponse extends UserResponse {
  idSucursal: number | null;
  sucursalNombre?: string | null;
}

export interface UserCreateRequest {
  usuario: string;
  correo: string;
  password: string;
  rol: Role;
  nombre?: string | null;
  apellido?: string | null;
  telefono?: string | null;
  idSucursal: number;
}

export interface UserUpdateRequest {
  correo?: string | null;
  password?: string | null;
  rol?: Role | null;
  nombre?: string | null;
  apellido?: string | null;
  telefono?: string | null;
  idSucursal?: number | null;
}

export interface SucursalResponse {
  idSucursal: number;
  nombre: string;
}

export interface EspecialistaResponse {
  especialistaId: number;   // igual a idUsuario
  especialidad: string;
  estado: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface EspecialistaUpsertRequest {
  especialidad: string;
}

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly baseUrl = environment.apiUrl; // ej: http://localhost:8081

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('jwt') ||
      '';

    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  listarActivos(): Observable<UserResponse[]> {
    return this.http.get<UserResponse[]>(
      `${this.baseUrl}/api/users`,
      { headers: this.authHeaders() }
    );
  }

  listarTodos(): Observable<UserResponse[]> {
    return this.http.get<UserResponse[]>(
      `${this.baseUrl}/api/users/all`,
      { headers: this.authHeaders() }
    );
  }

  obtener(id: number): Observable<UserDetailResponse> {
    return this.http.get<UserDetailResponse>(
      `${this.baseUrl}/api/users/${id}`,
      { headers: this.authHeaders() }
    );
  }

  crear(payload: UserCreateRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(
      `${this.baseUrl}/api/users`,
      payload,
      { headers: this.authHeaders() }
    );
  }

  editar(id: number, payload: UserUpdateRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(
      `${this.baseUrl}/api/users/${id}`,
      payload,
      { headers: this.authHeaders() }
    );
  }

  anular(id: number): Observable<UserResponse> {
    return this.http.patch<UserResponse>(
      `${this.baseUrl}/api/users/${id}/anular`,
      {},
      { headers: this.authHeaders() }
    );
  }

  reactivar(id: number): Observable<UserResponse> {
    return this.http.patch<UserResponse>(
      `${this.baseUrl}/api/users/${id}/reactivar`,
      {},
      { headers: this.authHeaders() }
    );
  }

  listarSucursales(): Observable<SucursalResponse[]> {
    return this.http.get<SucursalResponse[]>(
      `${this.baseUrl}/api/sucursales`,
      { headers: this.authHeaders() }
    );
  }

  obtenerEspecialista(idUsuario: number): Observable<EspecialistaResponse> {
    return this.http.get<EspecialistaResponse>(
      `${this.baseUrl}/api/especialistas/${idUsuario}`,
      { headers: this.authHeaders() }
    );
  }

  upsertEspecialista(idUsuario: number, especialidad: string): Observable<EspecialistaResponse> {
    const payload: EspecialistaUpsertRequest = { especialidad };
    return this.http.put<EspecialistaResponse>(
      `${this.baseUrl}/api/especialistas/${idUsuario}`,
      payload,
      { headers: this.authHeaders() }
    );
  }
}

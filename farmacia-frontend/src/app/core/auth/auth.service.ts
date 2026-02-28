import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { BehaviorSubject, Observable, EMPTY, tap } from 'rxjs';

// ── Tipos alineados con el backend ──────────────────────────────────────────
/** Payload que espera POST /api/auth/login */
export interface LoginRequest {
  usuario: string;
  contrasena: string;
}

/** Respuesta de POST /api/auth/login */
export interface LoginResponse {
  token: string;
  usuario: StoredUser;
}

/** Roles definidos en el backend */
export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'ESPECIALISTA'
  | 'SECRETARIA'
  | 'CAJA';

/** Perfil completo que devuelve GET /api/auth/me */
export interface MeResponse {
  idUsuario: number;
  usuario: string;
  correo: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  telefono?: string;
  idSucursal?: number;
  estado?: string;
}

/** Lo que guardamos en localStorage después de /me */
export interface StoredUser {
  idUsuario: number;
  usuario: string;
  correo: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  telefono?: string;
  idSucursal?: number;
}
// ── Claves de storage ────────────────────────────────────────────────────────

const TOKEN_KEY = 'af_token';
const USER_KEY  = 'af_user';

// ── Servicio ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AuthService {

  private _isLoggedIn$ = new BehaviorSubject<boolean>(this.hasToken());
  readonly isLoggedIn$ = this._isLoggedIn$.asObservable();

  constructor(private http: HttpClient) {}

  // ── Auth ──────────────────────────────────────────────────────────────────

  /**
   * Login: guarda el token de forma inmediata.
   * Siempre encadenar con refreshUserFromMe() para poblar el perfil completo.
   */
  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/api/auth/login`, payload)
      .pipe(
        tap(res => {
          localStorage.setItem(TOKEN_KEY, res.token);
          this._isLoggedIn$.next(true);
        })
      );
  }

  /** Obtiene el perfil completo del usuario autenticado. */
  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${environment.apiUrl}/api/auth/me`);
  }

  /**
   * Llama a /me y persiste los datos reales en localStorage.
   * Retorna EMPTY si no hay token (no emite nada, el subscribe no ejecuta next).
   */
  refreshUserFromMe(): Observable<MeResponse> {
    if (!this.hasToken()) return EMPTY;

    return this.me().pipe(
      tap(me => {
        const stored: StoredUser = {
          idUsuario:  me.idUsuario,
          usuario:    me.usuario,
          correo:     me.correo,
          nombre:     me.nombre,
          apellido:   me.apellido,
          rol:        me.rol,
          telefono:   me.telefono,
          idSucursal: me.idSucursal,
        };
        localStorage.setItem(USER_KEY, JSON.stringify(stored));
      })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._isLoggedIn$.next(false);
  }

  // ── Helpers de storage ────────────────────────────────────────────────────
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getUser(): StoredUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  }

  hasToken(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  /** Devuelve el rol del usuario guardado, o null si no hay sesión. */
  getRole(): UserRole | null {
    return this.getUser()?.rol ?? null;
  }

  // ── Password reset ────────────────────────────────────────────────────────
  /** Paso 1 — envía el código al correo */
  requestPasswordReset(correo: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${environment.apiUrl}/api/auth/password-reset/request`,
      { correo }
    );
  }

  /** Paso 2 — valida el código recibido por email */
  validatePasswordReset(correo: string, code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${environment.apiUrl}/api/auth/password-reset/validate`,
      { correo, code }
    );
  }

  /** Paso 3 — establece la nueva contraseña */
  confirmPasswordReset(
    correo: string,
    code: string,
    nuevaContrasena: string
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${environment.apiUrl}/api/auth/password-reset/confirm`,
      { correo, code, nuevaContrasena }
    );
  }
}
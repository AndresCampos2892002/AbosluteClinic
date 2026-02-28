// src/app/core/api/caja.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map, switchMap, of } from 'rxjs';
import { environment } from '../../../environments/environment';

// ─── DTOs del backend ─────────────────────────────────────────────────────────

export interface CobroItemDto {
  idServicio: number | null;
  nombre:     string | null;
  cantidad:   number;
  precioUnitario: number;
  subtotal:   number;
}

export interface CobroPagoDto {
  fecha:       string;          // ISO OffsetDateTime del backend
  monto:       number;
  metodo:      string;          // EFECTIVO | TARJETA | TRANSFERENCIA | OTRO
  referencia?: string | null;
}

export type EstadoPago = 'PENDIENTE' | 'PARCIAL' | 'PAGADO';

export interface CobroResponse {
  idCobro:      number;
  idCita:       number;
  moneda:       string;
  items:        CobroItemDto[];
  pagos:        CobroPagoDto[];
  total:        number;
  pagado:       number;
  saldo:        number;
  estadoPago:   EstadoPago;
  actualizadoEn: string;
}

export interface CobroUpsertRequest {
  moneda?: string | null;
  items: Array<{
    idServicio:     number | null;
    nombre?:        string | null;
    cantidad?:      number | null;
    precioUnitario?: number | null;
    subtotal?:      number | null;
  }>;
}

export interface CobroPagarRequest {
  monto:       number;
  metodo?:     string | null;
  referencia?: string | null;
}

// ─── Modelo enriquecido para el panel de caja ─────────────────────────────────
// Combina CitaResponse + datos del paciente + cobro para tener todo en un lugar

export interface CitaCajaVm {
  // Datos de la cita
  idCita:          number;
  idPaciente:      number;
  idServicio:      number;
  idEspecialista:  number | null;
  idSucursal:      number;
  fechaInicio:     string;
  duracionMinutos: number | null;
  estado:          string;
  canal:           string | null;
  motivo:          string | null;

  // Datos enriquecidos (resueltos desde otros endpoints)
  paciente:        string;           // "Nombre Apellido"
  pacienteTel:     string | null;
  pacienteCorreo:  string | null;
  servicio:        string;
  especialista:    string | null;
  sucursal:        string;

  // Estado de pago (se carga al seleccionar la cita)
  estadoPago?:     EstadoPago;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CajaService {

  private readonly http = inject(HttpClient);
  private readonly baseApi  = `${environment.apiUrl}/api`;
  private readonly baseCaja = `${this.baseApi}/caja/citas`;

  // ─── Cobro CRUD ─────────────────────────────────────────────────────────────

  obtenerCobro(idCita: number): Observable<CobroResponse> {
    return this.http.get<CobroResponse>(`${this.baseCaja}/${idCita}/cobro`);
  }

  guardarCobro(idCita: number, req: CobroUpsertRequest): Observable<CobroResponse> {
    return this.http.put<CobroResponse>(`${this.baseCaja}/${idCita}/cobro`, req);
  }

  pagar(idCita: number, req: CobroPagarRequest): Observable<CobroResponse> {
    return this.http.post<CobroResponse>(`${this.baseCaja}/${idCita}/cobro/pagar`, req);
  }

  // ─── Cargar citas enriquecidas para la lista ─────────────────────────────

  /**
   * Carga las citas del rango dado y las enriquece con nombres de
   * paciente, servicio y especialista en paralelo (3 GETs simultáneos).
   *
   * El backend de citas solo devuelve IDs, así que resolvemos los nombres
   * con forkJoin para no hacer N+1 en el frontend.
   */
  cargarCitasCaja(params: {
    idSucursal: number;
    desde: string;   // ISO con offset
    hasta: string;
  }): Observable<CitaCajaVm[]> {

    // 1. Traer citas + catálogos en paralelo
    let hp = new HttpParams()
      .set('idSucursal', String(params.idSucursal))
      .set('desde', params.desde)
      .set('hasta', params.hasta);

    return forkJoin({
      citas:      this.http.get<any[]>(`${this.baseApi}/citas`, { params: hp }),
      pacientes:  this.http.get<any[]>(`${this.baseApi}/pacientes`),
      servicios:  this.http.get<any[]>(`${this.baseApi}/servicios`),
      usuarios:   this.http.get<any[]>(`${this.baseApi}/users`),   // filtramos ESPECIALISTA en memoria
      sucursales: this.http.get<any[]>(`${this.baseApi}/sucursales`),
    }).pipe(
      map(({ citas, pacientes, servicios, usuarios, sucursales }) => {

        // Mapas para lookup O(1)
        const pacMap = new Map(pacientes.map((p: any) =>
          [p.idPaciente, p]));
        const srvMap = new Map(servicios.map((s: any) =>
          [s.idServicio, s.nombre ?? '—']));
        // Especialistas = usuarios con rol ESPECIALISTA
        const espMap = new Map(
          usuarios
            .filter((u: any) => u.rol === 'ESPECIALISTA')
            .map((u: any) => [u.idUsuario, `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim()])
        );
        const sucMap = new Map(sucursales.map((s: any) =>
          [s.idSucursal, s.nombre ?? '—']));

        return citas.map((c: any): CitaCajaVm => {
          const pac = pacMap.get(c.idPaciente);
          return {
            idCita:          c.idCita,
            idPaciente:      c.idPaciente,
            idServicio:      c.idServicio,
            idEspecialista:  c.idEspecialista ?? null,
            idSucursal:      c.idSucursal,
            fechaInicio:     c.fechaInicio,
            duracionMinutos: c.duracionMinutos ?? null,
            estado:          c.estado,
            canal:           c.canal ?? null,
            motivo:          c.motivo ?? null,

            // Nombres resueltos desde los mapas
            paciente:       pac
              ? `${pac.nombres ?? ''} ${pac.apellidos ?? ''}`.trim()
              : `Paciente #${c.idPaciente}`,
            pacienteTel:    pac?.telefono ?? null,
            pacienteCorreo: pac?.correo   ?? null,
            servicio:       srvMap.get(c.idServicio)      ?? `Servicio #${c.idServicio}`,
            especialista:   c.idEspecialista
              ? (espMap.get(c.idEspecialista) || `Esp. #${c.idEspecialista}`)
              : null,
            sucursal:       sucMap.get(c.idSucursal)      ?? `Sucursal #${c.idSucursal}`,
          };
        });
      }),
    );
  }

  /**
   * Enriquece UNA cita con su cobro al seleccionarla.
   * Hace 1 solo GET al backend de cobro.
   */
  cargarCobroDeCita(idCita: number): Observable<CobroResponse> {
    return this.obtenerCobro(idCita);
  }
}
import { Injectable, inject } from '@angular/core';
import { forkJoin, Observable, shareReplay, map } from 'rxjs';

import { ServiciosApiService } from '../../core/api/servicios-api.service';
import { PacientesApiService } from '../../core/api/pacientes-api.service';
import { UsersApiService } from '../../core/api/users-api.service';
// import { SucursalesApiService } from '../../core/api/sucursales-api.service';

export type CatalogoSucursal = { id: number; nombre: string };
export type CatalogoServicio = { id: number; nombre: string };
export type CatalogoPaciente = { id: number; nombre: string; telefono?: string | null };
export type CatalogoEspecialista = { id: number; nombre: string };

export interface ListadosCitas {
  sucursales: CatalogoSucursal[];
  servicios: CatalogoServicio[];
  pacientes: CatalogoPaciente[];
  especialistas: CatalogoEspecialista[];
}

@Injectable({ providedIn: 'root' })
export class ListadosService {
  private serviciosApi = inject(ServiciosApiService);
  private pacientesApi = inject(PacientesApiService);
  private usersApi = inject(UsersApiService);
  // private sucursalesApi = inject(SucursalesApiService);

  private cache$?: Observable<ListadosCitas>;

  /**
   * Devuelve todos los listados necesarios para Citas.
   * - Con cache (shareReplay) para no pegarle al backend 10 veces.
   * - force=true => recarga.
   */
  getListadosCitas(force = false): Observable<ListadosCitas> {
    if (force || !this.cache$) {
      this.cache$ = forkJoin({

        servicios: this.serviciosApi.listarActivos(),
        pacientes: (this.pacientesApi as any).listarActivos
          ? (this.pacientesApi as any).listarActivos()
          : (this.pacientesApi as any).listar(),

        users: (this.usersApi as any).listarActivos
          ? (this.usersApi as any).listarActivos()
          : (this.usersApi as any).listar(),

      }).pipe(
        map((r: any) => {
          const servicios: CatalogoServicio[] = (r.servicios ?? []).map((s: any) => ({
            id: Number(s.idServicio ?? s.id_servicio ?? s.id),
            nombre: String(s.nombre ?? '')
          }));

          const pacientes: CatalogoPaciente[] = (r.pacientes ?? []).map((p: any) => ({
            id: Number(p.idPaciente ?? p.id_paciente ?? p.id),
            nombre: String(p.nombreCompleto ?? `${p.nombres ?? ''} ${p.apellidos ?? ''}`.trim()),
            telefono: p.telefono ?? null
          }));

          const especialistas: CatalogoEspecialista[] = (r.users ?? [])
            .filter((u: any) => String(u.rol ?? '').toUpperCase() === 'ESPECIALISTA')
            .map((u: any) => ({
              id: Number(u.idUsuario ?? u.id_usuario ?? u.id),
              nombre: String(`${u.nombre ?? ''} ${u.apellido ?? ''}`.trim() || u.usuario || 'Especialista')
            }));
          const sucursales: CatalogoSucursal[] = []; //reemplazar cuando tengas API real

          return { sucursales, servicios, pacientes, especialistas } as ListadosCitas;
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.cache$;
  }

  invalidate(): void {
    this.cache$ = undefined;
  }
}

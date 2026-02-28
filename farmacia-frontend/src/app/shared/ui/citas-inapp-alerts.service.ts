import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CitaInAppAlert {
  citaId: number;
  focusYmd: string;   // yyyy-MM-dd (para navegar)
  startAtIso: string; // ISO
  hora: string;       // HH:mm
  minLeft: number;    // minutos restantes
  paciente: string;
  servicio: string;
  sucursal: string;
  estado: string;
}

@Injectable({ providedIn: 'root' })
export class CitasInAppAlertsService {
  private readonly _alerts$ = new BehaviorSubject<CitaInAppAlert[]>([]);
  readonly alerts$ = this._alerts$.asObservable();

  setAlerts(list: CitaInAppAlert[]) {
    this._alerts$.next(Array.isArray(list) ? list : []);
  }

  clear() {
    this._alerts$.next([]);
  }
}

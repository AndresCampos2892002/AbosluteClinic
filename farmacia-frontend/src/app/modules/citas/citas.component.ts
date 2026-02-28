// src/app/modules/citas/citas.component.ts
import { Component, OnInit, OnDestroy, inject, TrackByFunction } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, forkJoin, Subscription } from 'rxjs';
import { finalize, map } from 'rxjs/operators';
import { Router } from '@angular/router';

import {
  CitasApiService,
  EstadoCita,
  CitaResponse,
  CitaRequest,
} from '../../core/api/citas-api.service';

import {
  PacientesApiService,
  PacienteResponse,
  PacienteCreateRequest,
} from '../../core/api/pacientes-api.service';

import { ServiciosApiService, ServicioResponse } from '../../core/api/servicios-api.service';
import { UsersApiService, SucursalResponse, UserResponse } from '../../core/api/users-api.service';
import { UiToastService } from '../../shared/ui/toast/ui-toast.service';
import { httpErrorMessage } from '../../shared/ui/http-error.util';
import { httpErrorCitasMessage } from '../../shared/ui/http-error-citas.util';

// ── Tipos ──────────────────────────────────────────────────────────────────────
type CanalCita = 'WHATSAPP' | 'LLAMADA' | 'WEB' | 'RECEPCION' | 'FACEBOOK';
type TipoPago  = 'PAGO_INMEDIATO' | 'CUENTA_POR_COBRAR';

/** Vista-modelo enriquecida con nombres desde los catálogos. */
interface CitaVM {
  id_cita: number;
  id_sucursal: number;
  sucursal_nombre: string;
  id_paciente: number;
  paciente_nombre: string;
  telefono: string | null;
  id_servicio: number;
  servicio_nombre: string;
  id_especialista: number | null;
  especialista_nombre: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  duracion_minutos: number;
  estado: EstadoCita;
  canal: string | null;
  cancelacion_cobro: TipoPago | null;
  motivo: string | null;
  notas: string | null;
}

interface FiltrosState {
  idSucursal:    number;           // 0 = todas
  idEspecialista: number | null;   // null = todos
  estado:        EstadoCita | '';
  q:             string;
}

@Component({
  selector: 'app-citas',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: 'citas.component.html',
  styleUrls: ['citas.component.scss'],
})
export class CitasComponent implements OnInit, OnDestroy {

  // ── Inyecciones ────────────────────────────────────────────────────────────
  private readonly fb          = inject(FormBuilder);
  private readonly citasApi    = inject(CitasApiService);
  private readonly pacientesApi = inject(PacientesApiService);
  private readonly serviciosApi = inject(ServiciosApiService);
  private readonly usersApi    = inject(UsersApiService);
  private readonly toast       = inject(UiToastService);
  private readonly router      = inject(Router);

  private subs = new Subscription();

  // ── UI states ──────────────────────────────────────────────────────────────
  loadingCatalogos = false;
  loadingCitas     = false;
  saving           = false;
  msg              = '';
  modo: 'CREAR' | 'EDITAR' = 'CREAR';
  editId: number | null = null;
  private editOriginalInicioIso: string | null = null;

  // ── Filtros ────────────────────────────────────────────────────────────────
  filtersOpen    = false;
  fSucursal      = 0;
  fEspecialista: number | null = null;
  fEstado: EstadoCita | '' = '';
  q              = '';

  // ── Catálogos ──────────────────────────────────────────────────────────────
  store = {
    sucursales:   [] as SucursalResponse[],
    pacientes:    [] as PacienteResponse[],
    servicios:    [] as ServicioResponse[],
    especialistas: [] as UserResponse[],
  };

  // ── Formularios ────────────────────────────────────────────────────────────
  form!: FormGroup;
  pacienteForm!: FormGroup;
  archivoForm!: FormGroup; // para compatibilidad con el expediente si lo necesitas

  // ── Modal cita ─────────────────────────────────────────────────────────────
  modalOpen    = false;
  selectedDate: Date = new Date();

  // ── Modal confirm anular cita ──────────────────────────────────────────────
  confirmAnularOpen    = false;
  confirmAnularLoading = false;
  private confirmAnularTarget: CitaVM | null = null;

  // ── Calendario mensual ─────────────────────────────────────────────────────
  monthCursor: Date = this.firstDayOfMonth(new Date());
  monthDays: Date[] = [];
  weekDayNames = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  selectedCita: CitaVM | null = null;

  get monthLabel(): string {
    return this.monthCursor.toLocaleDateString('es', { month: 'long', year: 'numeric' });
  }

  // ── Submenú acciones agenda ────────────────────────────────────────────────
  openCitaMenuId: number | null = null;

  // ── Quick create paciente ──────────────────────────────────────────────────
  pacienteModalOpen = false;
  pacienteSaving    = false;
  pacienteMsg       = '';

  // ── Data streams ───────────────────────────────────────────────────────────
  private catalogosReady = false;

  private citasSubject   = new BehaviorSubject<CitaVM[]>([]);
  private filtrosSubject = new BehaviorSubject<FiltrosState>({
    idSucursal: 1, idEspecialista: null, estado: '', q: '',
  });

  citasFiltradas$ = combineLatest([
    this.citasSubject.asObservable(),
    this.filtrosSubject.asObservable(),
  ]).pipe(
    map(([all, f]) => {
      const qn = (f.q || '').trim().toLowerCase();
      return (all || [])
        .filter(c => f.idSucursal === 0 || c.id_sucursal === f.idSucursal)
        .filter(c => f.idEspecialista === null || c.id_especialista === f.idEspecialista)
        .filter(c => !f.estado || c.estado === f.estado)
        .filter(c => !qn || (
          (c.paciente_nombre || '').toLowerCase().includes(qn) ||
          (c.telefono        || '').toLowerCase().includes(qn) ||
          (c.servicio_nombre || '').toLowerCase().includes(qn)
        ));
    }),
  );

  trackByCita:     TrackByFunction<CitaVM> = (_i, c) => c.id_cita;
  trackByMonthDay: TrackByFunction<Date>   = (_i, d) => d.getTime();

  // ── Getters labels UI ──────────────────────────────────────────────────────
  get sucursalLabel(): string {
    if (this.fSucursal === 0) return 'Todas';
    const s = this.store.sucursales.find(x => x.idSucursal === this.fSucursal);
    return s?.nombre ?? `Sucursal #${this.fSucursal}`;
  }

  get especialistaLabel(): string {
    if (this.fEspecialista === null) return 'Todos';
    const e = this.store.especialistas.find(x => x.idUsuario === this.fEspecialista);
    return e ? `${e.nombre} ${e.apellido}` : `#${this.fEspecialista}`;
  }

  get estadoLabel(): string {
    return this.fEstado || 'Todos';
  }

  get viendoTodasSucursales(): boolean {
    return this.fSucursal === 0;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  constructor() {
    this.form = this.fb.group({
      id_sucursal:       [1,                     Validators.required],
      id_paciente:       [null as any,            Validators.required],
      id_servicio:       [null as any,            Validators.required],
      id_especialista:   [null as any,            Validators.required],
      fecha:             ['',                     Validators.required],
      hora:              ['',                     Validators.required],
      duracion_minutos:  [30, [Validators.required, Validators.min(5), Validators.max(210)]],
      estado:            ['PENDIENTE' as EstadoCita, Validators.required],
      canal:             ['WHATSAPP'  as CanalCita,  Validators.required],
      cancelacion_cobro: [null as TipoPago | null],
      motivo:            [''],
      notas:             [''],
    });

    this.pacienteForm = this.fb.group({
      nombreCompleto: ['', [Validators.required, Validators.minLength(3)]],
      telefono:       ['', [Validators.required, Validators.minLength(6)]],
      correo:         [''],
    });
  }

  ngOnInit(): void {
    const now = new Date();
    this.selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    this.buildMonth(this.selectedDate);

    this.form.patchValue({
      fecha: this.toYmdLocal(this.selectedDate),
      hora:  this.toHmLocal(now),
    });

    this.subs.add(
      this.form.get('estado')!.valueChanges
        .subscribe(est => this.syncPagoValidators(est as EstadoCita)),
    );
    this.syncPagoValidators(this.form.get('estado')!.value as EstadoCita);

    this.cargarCatalogos();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Submenú agenda ─────────────────────────────────────────────────────────

  toggleCitaMenu(c: CitaVM): void {
    this.openCitaMenuId = this.openCitaMenuId === c.id_cita ? null : c.id_cita;
  }

  isCitaMenuOpen(c: CitaVM): boolean {
    return this.openCitaMenuId === c.id_cita;
  }

  closeCitaMenu(): void {
    this.openCitaMenuId = null;
  }

  canConfirmar(c: CitaVM): boolean {
    return !['CONFIRMADA', 'TERMINADA', 'CANCELADA', 'NO_ASISTIO'].includes(c.estado);
  }

  canCobrar(c: CitaVM): boolean {
    return c.estado === 'CONFIRMADA' || c.estado === 'TERMINADA';
  }

  onEditarCita(c: CitaVM, ev?: Event): void {
    ev?.stopPropagation();
    this.closeCitaMenu();
    this.openEditModal(c);
  }

  onConfirmarCita(c: CitaVM, ev?: Event): void {
    ev?.stopPropagation();
    if (!this.canConfirmar(c)) return;

    this.subs.add(
      this.citasApi.cambiarEstado(c.id_cita, 'CONFIRMADA').subscribe({
        next: () => { this.toast.success('Cita confirmada'); this.closeCitaMenu(); this.cargarCitas(); },
        error: (err) => this.toast.error(httpErrorCitasMessage(err, 'No se pudo confirmar la cita')),
      }),
    );
  }

  onCobrarCita(c: CitaVM, ev?: Event): void {
    ev?.stopPropagation();

    if (c.estado === 'CANCELADA' || c.estado === 'NO_ASISTIO') {
      this.toast.info('Esa cita no se puede cobrar.');
      return;
    }
    if (c.estado === 'TERMINADA') { this.irACajaPorCita(c); return; }
    if (c.estado !== 'CONFIRMADA') {
      this.toast.info('Primero confirma la cita para poder cobrar.');
      return;
    }

    this.subs.add(
      this.citasApi.cambiarEstado(c.id_cita, 'TERMINADA').subscribe({
        next: () => {
          this.patchLocalCita(c.id_cita, { estado: 'TERMINADA' as any });
          this.toast.success('Cita marcada como TERMINADA');
          this.closeCitaMenu();
          this.cargarCitas();
          this.irACajaPorCita(c);
        },
        error: (err) => this.toast.error(httpErrorCitasMessage(err, 'No se pudo marcar como terminada')),
      }),
    );
  }

  irACajaPorCita(c: CitaVM | null | undefined): void {
    if (!c) return;
    this.closeCitaMenu();

    const fecha = String(c.fecha_inicio ?? '').slice(0, 10); // YYYY-MM-DD

    this.router.navigate(['/caja'], {
      queryParams: {
        idCita: c.id_cita,
        idSucursal: c.id_sucursal,
        fecha, // 👈 nuevo
      }
    });
  }

  // ── Confirm anular cita (modal propio) ─────────────────────────────────────

  onAnularCita(c: CitaVM, ev?: Event): void {
    ev?.stopPropagation();
    this.closeCitaMenu();
    if (!c || c.estado !== 'PENDIENTE') return;

    this.confirmAnularTarget  = c;
    this.confirmAnularLoading = false;
    this.confirmAnularOpen    = true;
  }

  closeConfirmAnular(): void {
    if (this.confirmAnularLoading) return;
    this.confirmAnularOpen  = false;
    this.confirmAnularTarget = null;
  }

  confirmAnularProceed(): void {
    if (!this.confirmAnularTarget) return;
    const c = this.confirmAnularTarget;
    this.confirmAnularLoading = true;

    this.subs.add(
      this.citasApi.cancelar(c.id_cita)
        .pipe(finalize(() => (this.confirmAnularLoading = false)))
        .subscribe({
          next: () => {
            this.toast.success('Cita anulada');
            this.confirmAnularOpen   = false;
            this.confirmAnularTarget = null;
            this.cargarCitas();
          },
          error: (err) => this.toast.error(httpErrorCitasMessage(err, 'No se pudo anular la cita')),
        }),
    );
  }

  // ── Filtros UI ─────────────────────────────────────────────────────────────

  toggleFilters(): void {
    this.filtersOpen = !this.filtersOpen;
  }

  onQChange(v: string): void {
    this.q = v;
    this.filtrosSubject.next({ ...this.filtrosSubject.value, q: v });
  }

  setFiltroSucursal(v: any): void {
    const n = Number(v);
    this.fSucursal = Number.isFinite(n) ? n : 0;
    this.form.patchValue({ id_sucursal: this.formSucursalId() });
    this.filtrosSubject.next({ ...this.filtrosSubject.value, idSucursal: this.fSucursal });
    this.cargarCitas();
  }

  setFiltroEspecialista(v: any): void {
    const val = (v === '' || v == null) ? null : Number(v);
    this.fEspecialista = val;
    this.filtrosSubject.next({ ...this.filtrosSubject.value, idEspecialista: val });
  }

  setFiltroEstado(v: any): void {
    this.fEstado = (v as any) || '';
    this.filtrosSubject.next({ ...this.filtrosSubject.value, estado: this.fEstado });
  }

  setFormSucursal(v: any): void {
    this.form.patchValue({ id_sucursal: Number(v) });
  }

  // ── Catálogos ──────────────────────────────────────────────────────────────

  private cargarCatalogos(): void {
    this.loadingCatalogos = true;

    this.subs.add(
      forkJoin({
        sucursales: this.usersApi.listarSucursales(),
        pacientes:  this.pacientesApi.listar(),
        servicios:  this.serviciosApi.listarActivos(),
        usuarios:   this.usersApi.listarActivos(),
      })
      .pipe(finalize(() => (this.loadingCatalogos = false)))
      .subscribe({
        next: (res) => {
          this.store.sucursales = Array.isArray(res.sucursales) ? res.sucursales : [];
          this.store.pacientes  = Array.isArray(res.pacientes)  ? res.pacientes  : [];
          this.store.servicios  = Array.isArray(res.servicios)  ? res.servicios  : [];

          const usuarios = Array.isArray(res.usuarios) ? res.usuarios : [];
          this.store.especialistas = usuarios
            .filter(u => u.estado === true && u.rol === 'ESPECIALISTA')
            .sort((a, b) =>
              `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, 'es', { sensitivity: 'base' }),
            );

          const first = this.firstSucursalId();
          if (this.fSucursal !== 0 && !this.store.sucursales.some(s => s.idSucursal === this.fSucursal)) {
            this.fSucursal = first;
          }

          this.form.patchValue({ id_sucursal: this.formSucursalId() });
          this.filtrosSubject.next({ ...this.filtrosSubject.value, idSucursal: this.fSucursal });
          this.catalogosReady = true;
          this.cargarCitas();
        },
        error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudieron cargar catálogos')),
      }),
    );
  }

  // ── Cargar citas ───────────────────────────────────────────────────────────

  private cargarCitas(): void {
    if (!this.catalogosReady || !this.monthDays.length) return;
    this.loadingCitas = true;

    const gridStart = new Date(this.monthDays[0]);
    const gridEnd   = new Date(gridStart);
    gridEnd.setDate(gridStart.getDate() + 42);

    const desde = this.toIsoWithOffset(this.toYmdLocal(gridStart), '00:00');
    const hasta = this.toIsoWithOffset(this.toYmdLocal(gridEnd),   '00:00');

    const load$ = this.fSucursal === 0
      ? this.listarTodasSucursales(desde, hasta)
      : this.citasApi.listar({ idSucursal: this.fSucursal, desde, hasta });

    this.subs.add(
      load$
        .pipe(finalize(() => (this.loadingCitas = false)))
        .subscribe({
          next: (data: any) => {
            const arr  = Array.isArray(data) ? data : [];
            const uniq = this.dedupeById(arr);
            this.citasSubject.next(uniq.map((r: any) => this.toVM(r)));
          },
          error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudieron cargar las citas')),
        }),
    );
  }

  private listarTodasSucursales(desde: string, hasta: string) {
    const ids = (this.store.sucursales || [])
      .map(s => s.idSucursal)
      .filter(n => Number.isFinite(n as any));

    if (!ids.length) return new BehaviorSubject<any[]>([]).asObservable();

    return forkJoin(ids.map(id => this.citasApi.listar({ idSucursal: id, desde, hasta })))
      .pipe(map((lists: any[]) => (lists || []).flat()));
  }

  private dedupeById(arr: any[]): any[] {
    const seen = new Set<number>();
    return (arr || []).filter((r: any) => {
      const id = Number(r?.idCita ?? r?.id_cita);
      if (!Number.isFinite(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  // ── Calendario ─────────────────────────────────────────────────────────────

  buildMonth(base: Date): void {
    this.monthCursor = this.firstDayOfMonth(base);
    this.monthDays   = this.buildMonthDays(this.monthCursor);
  }

  prevMonth(): void {
    const d = new Date(this.monthCursor);
    d.setMonth(d.getMonth() - 1);
    this.buildMonth(d);
    this.cargarCitas();
  }

  nextMonth(): void {
    const d = new Date(this.monthCursor);
    d.setMonth(d.getMonth() + 1);
    this.buildMonth(d);
    this.cargarCitas();
  }

  onCalendarDayClick(d: Date): void {
    this.closeCitaMenu();
    this.selectedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (this.isOutsideMonth(d)) { this.buildMonth(d); this.cargarCitas(); }
  }

  openCreateForDay(d: Date): void {
    this.closeCitaMenu();
    this.selectedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (this.isOutsideMonth(d)) { this.buildMonth(d); this.cargarCitas(); }

    const now = new Date();
    now.setMinutes(0, 0, 0);
    const hora = this.sameDay(d, now) ? this.toHmLocal(now) : '09:00';

    this.resetFormWithDate(this.selectedDate, hora);
    this.modo    = 'CREAR';
    this.editId  = null;
    this.modalOpen = true;
  }

  goToday(): void {
    this.closeCitaMenu();
    const t = new Date();
    this.selectedDate = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    this.buildMonth(this.selectedDate);
    this.cargarCitas();
  }

  isOutsideMonth(d: Date): boolean {
    return d.getMonth() !== this.monthCursor.getMonth()
        || d.getFullYear() !== this.monthCursor.getFullYear();
  }

  isToday(d: Date):    boolean { return this.sameDay(d, new Date()); }
  isSelected(d: Date): boolean { return this.sameDay(d, this.selectedDate); }

  private buildMonthDays(firstOfMonth: Date): Date[] {
    const start = this.startOfWeek(firstOfMonth);
    const res: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      res.push(d);
    }
    return res;
  }

  // ── Modal crear / editar ───────────────────────────────────────────────────

  openCreateModal(): void {
    this.closeCitaMenu();
    const now  = new Date();
    const hora = this.sameDay(this.selectedDate, now) ? this.toHmLocal(now) : '09:00';
    this.resetFormWithDate(this.selectedDate, hora);
    this.modo      = 'CREAR';
    this.editId    = null;
    this.modalOpen = true;
  }

  openEditModal(c: CitaVM): void {
    this.closeCitaMenu();
    this.selectedCita = c;
    this.editar(c);
    this.modalOpen = true;
  }

  closeModal(force = false): void {
    if (this.saving && !force) return;
    this.modalOpen = false;
    this.msg       = '';
  }

  // ── CRUD cita ──────────────────────────────────────────────────────────────

  submit(): void {
    this.msg = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.msg = 'Completa los campos obligatorios.';
      return;
    }

    const v          = this.form.value;
    const fechaInicio = this.toIsoWithOffset(String(v.fecha), String(v.hora));
    const estado      = v.estado as EstadoCita;

    if (this.modo === 'EDITAR' && estado === 'REPROGRAMADA' && this.editOriginalInicioIso) {
      const orig = new Date(this.editOriginalInicioIso).getTime();
      const nuev = new Date(fechaInicio).getTime();
      if (orig === nuev) {
        this.msg = 'Para REPROGRAMAR debes cambiar la fecha u hora.';
        return;
      }
    }

    const req: CitaRequest = {
      idSucursal:       Number(v.id_sucursal),
      idPaciente:       Number(v.id_paciente),
      idServicio:       Number(v.id_servicio),
      idEspecialista:   Number(v.id_especialista),
      fechaInicio,
      duracionMinutos:  Number(v.duracion_minutos),
      estado,
      canal:            (v.canal as any) ?? null,
      motivo:           this.normText(v.motivo),
      notas:            this.normText(v.notas),
      cancelacionCobro: estado === 'TERMINADA' ? (v.cancelacion_cobro as any) : null,
    };

    this.saving = true;
    const fechaLocalSeleccion = this.ymdToDateLocal(String(v.fecha));

    if (this.modo === 'CREAR') {
      this.subs.add(
        this.citasApi.crear(req)
          .pipe(finalize(() => (this.saving = false)))
          .subscribe({
            next: () => {
              this.toast.success('Cita creada');
              this.selectedDate = fechaLocalSeleccion;
              if (this.isOutsideMonth(this.selectedDate)) this.buildMonth(this.selectedDate);
              this.closeModal(true);
              this.cargarCitas();
            },
            error: (err) => {
              const m = httpErrorCitasMessage(err, 'No se pudo crear la cita');
              this.msg = m;
              this.toast.error(m);
            },
          }),
      );
      return;
    }

    if (this.modo === 'EDITAR' && this.editId) {
      const id  = this.editId;
      const ini = req.fechaInicio;
      const fin = new Date(new Date(ini).getTime() + (req.duracionMinutos || 0) * 60000).toISOString();

      const patch: Partial<CitaVM> = {
        fecha_inicio: ini, fecha_fin: fin,
        duracion_minutos: Number(req.duracionMinutos || 0),
        estado: req.estado as any, canal: (req.canal ?? null) as any,
        motivo: req.motivo ?? null, notas: req.notas ?? null,
        id_paciente: req.idPaciente, id_servicio: req.idServicio,
        id_especialista: req.idEspecialista,
        cancelacion_cobro: (req.cancelacionCobro ?? null) as any,
      };

      this.subs.add(
        this.citasApi.editar(id, req)
          .pipe(finalize(() => (this.saving = false)))
          .subscribe({
            next: () => {
              this.patchLocalCita(id, patch);
              this.toast.success('Cita actualizada');
              this.selectedDate = fechaLocalSeleccion;
              if (this.isOutsideMonth(this.selectedDate)) this.buildMonth(this.selectedDate);
              this.closeModal(true);
              this.cargarCitas();
            },
            error: (err) => {
              this.cargarCitas();
              const m = httpErrorCitasMessage(err, 'No se pudo actualizar la cita');
              this.msg = m;
              this.toast.error(m);
            },
          }),
      );
    }
  }

  resetForm(): void {
    this.modo    = 'CREAR';
    this.editId  = null;
    this.editOriginalInicioIso = null;
    const now  = new Date();
    const hora = this.sameDay(this.selectedDate, now) ? this.toHmLocal(now) : '09:00';
    this.resetFormWithDate(this.selectedDate, hora);
    this.msg = '';
  }

  editar(c: CitaVM): void {
    this.modo     = 'EDITAR';
    this.editId   = c.id_cita;
    this.editOriginalInicioIso = c.fecha_inicio;

    const ini = new Date(c.fecha_inicio);
    this.form.patchValue({
      id_sucursal:      c.id_sucursal,
      id_paciente:      c.id_paciente,
      id_servicio:      c.id_servicio,
      id_especialista:  c.id_especialista ?? this.firstEspecialistaId(),
      fecha:            this.toYmdLocal(new Date(ini.getFullYear(), ini.getMonth(), ini.getDate())),
      hora:             this.toHmLocal(ini),
      duracion_minutos: c.duracion_minutos,
      estado:           c.estado,
      cancelacion_cobro: (c.cancelacion_cobro ?? null) as any,
      canal:            (c.canal || 'WHATSAPP') as any,
      motivo:           c.motivo  || '',
      notas:            c.notas   || '',
    });
  }

  cancelar(c: CitaVM): void {
    this.subs.add(
      this.citasApi.cancelar(c.id_cita).subscribe({
        next: () => { this.toast.success('Cita cancelada'); this.cargarCitas(); },
        error: (err) => this.toast.error(httpErrorCitasMessage(err, 'No se pudo cancelar la cita')),
      }),
    );
  }

  setEstado(c: CitaVM, estado: EstadoCita): void {
    this.subs.add(
      this.citasApi.cambiarEstado(c.id_cita, estado).subscribe({
        next: () => this.cargarCitas(),
        error: (err) => this.toast.error(httpErrorCitasMessage(err, 'No se pudo cambiar el estado')),
      }),
    );
  }

  asignarEspecialista(c: CitaVM, id: string): void {
    const val = id === '' ? null : Number(id);
    this.subs.add(
      this.citasApi.asignarEspecialista(c.id_cita, val).subscribe({
        next: () => this.cargarCitas(),
        error: (err) => this.toast.error(httpErrorCitasMessage(err, 'No se pudo asignar especialista')),
      }),
    );
  }

  // ── Quick create paciente ──────────────────────────────────────────────────

  openPacienteModal(): void {
    this.pacienteMsg = '';
    this.pacienteForm.reset({ nombreCompleto: '', telefono: '', correo: '' });
    this.pacienteModalOpen = true;
  }

  closePacienteModal(): void {
    if (this.pacienteSaving) return;
    this.pacienteModalOpen = false;
    this.pacienteMsg       = '';
  }

  crearPacienteRapido(): void {
    this.pacienteMsg = '';
    if (this.pacienteForm.invalid) {
      this.pacienteForm.markAllAsTouched();
      this.pacienteMsg = 'Completa los campos obligatorios.';
      return;
    }

    const v = this.pacienteForm.value;
    const { nombres, apellidos } = this.splitNombreCompleto(String(v.nombreCompleto));

    const req: PacienteCreateRequest = {
      nombres,
      apellidos,
      telefono: String(v.telefono || '').trim() || null,
      correo:   String(v.correo   || '').trim() || null,
    };

    this.pacienteSaving = true;
    this.subs.add(
      this.pacientesApi.crear(req)
        .pipe(finalize(() => (this.pacienteSaving = false)))
        .subscribe({
          next: (p) => {
            this.toast.success('Paciente creado');
            this.store.pacientes = [p, ...this.store.pacientes].sort((a, b) =>
              `${a.nombres} ${a.apellidos ?? ''}`.localeCompare(`${b.nombres} ${b.apellidos ?? ''}`, 'es', { sensitivity: 'base' }),
            );
            this.form.patchValue({ id_paciente: p.idPaciente });
            this.pacienteModalOpen = false;
          },
          error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudo crear el paciente')),
        }),
    );
  }

  // ── Helpers UI / agenda ────────────────────────────────────────────────────

  countForDay(all: CitaVM[], d: Date): number {
    return (all || []).filter(c => this.sameDay(new Date(c.fecha_inicio), d)).length;
  }

  dayCitas(all: CitaVM[], d: Date): CitaVM[] {
    return (all || [])
      .filter(c => this.sameDay(new Date(c.fecha_inicio), d))
      .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());
  }

  badgeClass(estado: EstadoCita): string {
    return 'st ' + String(estado || '').toLowerCase();
  }

  setDuracionMinutos(v: any): void {
    let n = Number(v);
    if (!Number.isFinite(n)) n = 60;
    n = Math.max(5, Math.min(210, Math.round(n / 5) * 5));
    this.form.patchValue({ duracion_minutos: n }, { emitEvent: false });
  }

  duracionHuman(min: number): string {
    const m = Number(min) || 0;
    if (m <= 0) return '—';
    if (m < 60)  return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  private syncPagoValidators(est: EstadoCita): void {
    const cobro = this.form.get('cancelacion_cobro')!;
    if (est === 'TERMINADA') {
      cobro.setValidators(Validators.required);
      if (!cobro.value) cobro.setValue('PAGO_INMEDIATO', { emitEvent: false });
    } else {
      cobro.clearValidators();
      cobro.setValue(null, { emitEvent: false });
    }
    cobro.updateValueAndValidity({ emitEvent: false });
  }

  private patchLocalCita(id: number, patch: Partial<CitaVM>): void {
    const curr = this.citasSubject.value || [];
    this.citasSubject.next(curr.map(c => c.id_cita === id ? { ...c, ...patch } : c));
  }

  private resetFormWithDate(d: Date, hora: string): void {
    this.form.reset({
      id_sucursal:      this.formSucursalId(),
      id_paciente:      null,
      id_servicio:      null,
      id_especialista:  this.firstEspecialistaId(),
      fecha:            this.toYmdLocal(d),
      hora,
      duracion_minutos: 30,
      estado:           'PENDIENTE',
      canal:            'WHATSAPP',
      cancelacion_cobro: null,
      motivo:           '',
      notas:            '',
    });
  }

  private firstSucursalId(): number {
    return this.store.sucursales[0]?.idSucursal ?? 1;
  }

  private firstEspecialistaId(): number | null {
    return this.store.especialistas[0]?.idUsuario ?? null;
  }

  private formSucursalId(): number {
    return this.fSucursal === 0 ? this.firstSucursalId() : (this.fSucursal || this.firstSucursalId());
  }

  private splitNombreCompleto(full: string): { nombres: string; apellidos: string | null } {
    const s     = String(full || '').trim().replace(/\s+/g, ' ');
    const parts = s.split(' ');
    if (parts.length === 1) return { nombres: parts[0], apellidos: null };
    const apellidos = parts.pop() || '';
    return { nombres: parts.join(' '), apellidos: apellidos || null };
  }

  private startOfWeek(d: Date): Date {
    const x   = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setHours(0, 0, 0, 0);
    const day  = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    return x;
  }

  private sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth()    === b.getMonth()
        && a.getDate()     === b.getDate();
  }

  private normText(v: any): string | null {
    const s = String(v ?? '').trim().replace(/\s+/g, ' ');
    return s.length ? s : null;
  }

  private toYmdLocal(d: Date): string {
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private toHmLocal(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private ymdToDateLocal(ymd: string): Date {
    const [y, m, d] = (ymd || '').split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  private toIsoWithOffset(fecha: string, hora: string): string {
    const d    = new Date(`${fecha}T${hora}:00`);
    const pad  = (n: number) => String(Math.abs(Math.trunc(n))).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm   = pad(d.getMonth() + 1);
    const dd   = pad(d.getDate());
    const hh   = pad(d.getHours());
    const mi   = pad(d.getMinutes());
    const ss   = pad(d.getSeconds());
    const offMin = -d.getTimezoneOffset();
    const sign   = offMin >= 0 ? '+' : '-';
    const offH   = pad(offMin / 60);
    const offM   = pad(offMin % 60);
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${offH}:${offM}`;
  }

  private safeDuration(r: CitaResponse): number {
    const n   = Number((r as any).duracionMinutos ?? (r as any).duracion_minutos);
    const val = Number.isFinite(n) && n > 0 ? n : 60;
    return Math.max(5, Math.min(210, val));
  }

  private safeFechaFin(r: CitaResponse, durMin: number): string {
    const ff = (r as any).fechaFin ?? (r as any).fecha_fin;
    if (typeof ff === 'string' && ff.trim()) return ff;
    const iniStr = (r as any).fechaInicio ?? (r as any).fecha_inicio;
    const ini    = new Date(iniStr);
    if (!Number.isNaN(ini.getTime())) return new Date(ini.getTime() + durMin * 60000).toISOString();
    return new Date().toISOString();
  }

  private toVM(r: CitaResponse): CitaVM {
    const idCita        = (r as any).idCita        ?? (r as any).id_cita;
    const idSucursal    = (r as any).idSucursal    ?? (r as any).id_sucursal;
    const idPaciente    = (r as any).idPaciente    ?? (r as any).id_paciente;
    const idServicio    = (r as any).idServicio    ?? (r as any).id_servicio;
    const idEspecialista = (r as any).idEspecialista ?? (r as any).id_especialista ?? null;
    const fechaInicio   = (r as any).fechaInicio   ?? (r as any).fecha_inicio;
    const dur           = this.safeDuration(r);
    const fin           = this.safeFechaFin(r, dur);
    const cancelacionCobro = (r as any).cancelacionCobro ?? (r as any).cancelacion_cobro ?? null;

    const suc = this.store.sucursales.find(s => s.idSucursal === idSucursal);
    const pac = this.store.pacientes.find(p => p.idPaciente === idPaciente);
    const srv = this.store.servicios.find(s => s.idServicio === idServicio);
    const esp = idEspecialista != null
      ? this.store.especialistas.find(e => e.idUsuario === idEspecialista)
      : null;

    return {
      id_cita:     Number(idCita),
      id_sucursal: Number(idSucursal),
      sucursal_nombre: suc?.nombre ?? `Sucursal #${idSucursal}`,
      id_paciente: Number(idPaciente),
      paciente_nombre: pac ? `${pac.nombres} ${pac.apellidos ?? ''}`.trim() : `Paciente #${idPaciente}`,
      telefono:    (pac?.telefono ?? null) as any,
      id_servicio: Number(idServicio),
      servicio_nombre: srv?.nombre ?? `Servicio #${idServicio}`,
      id_especialista: idEspecialista != null ? Number(idEspecialista) : null,
      especialista_nombre: esp ? `${esp.nombre} ${esp.apellido}` : null,
      fecha_inicio:      String(fechaInicio),
      fecha_fin:         String(fin),
      duracion_minutos:  dur,
      estado:            (r as any).estado,
      canal:             (r as any).canal ?? null,
      cancelacion_cobro: cancelacionCobro,
      motivo:            (r as any).motivo ?? null,
      notas:             (r as any).notas  ?? null,
    };
  }

  private firstDayOfMonth(d: Date): Date {
    const x = new Date(d.getFullYear(), d.getMonth(), 1);
    x.setHours(0, 0, 0, 0);
    return x;
  }
}
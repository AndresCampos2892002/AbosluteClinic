// src/app/modules/caja/caja-citas.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, forkJoin, Subscription, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';

import { CitasApiService, CitaResponse } from '../../core/api/citas-api.service';
import { PacientesApiService, PacienteResponse } from '../../core/api/pacientes-api.service';
import { ServiciosApiService, ServicioResponse } from '../../core/api/servicios-api.service';
import { UsersApiService, SucursalResponse, UserResponse } from '../../core/api/users-api.service';
import { CajaService, CobroResponse, CobroItemDto } from '../../core/api/caja-api.service';
import { CobroPdfService } from '../../core/api/cobro-pdf.service';
import { AuthService } from '../../core/auth/auth.service';

// ─── VM local de cita enriquecida ────────────────────────────────────────────
interface CitaCajaVM {
  id_cita: number;
  id_sucursal: number;
  sucursal_nombre: string;
  id_paciente: number;
  paciente_nombre: string;
  paciente_tel: string | null;
  paciente_correo: string | null;
  id_servicio: number;
  servicio_nombre: string;
  id_especialista: number | null;
  especialista_nombre: string | null;
  fecha_inicio: string;
  duracion_minutos: number;
  estado: string;
  estadoPago?: 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
}

@Component({
  selector: 'app-caja-citas',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './caja-citas.component.html',
  styleUrls: ['./caja-citas.component.scss'],
})
export class CajaCitasComponent implements OnInit, OnDestroy {
  private readonly citasApi = inject(CitasApiService);
  private readonly pacientesApi = inject(PacientesApiService);
  private readonly serviciosApi = inject(ServiciosApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly cajaService = inject(CajaService);
  private readonly pdfService = inject(CobroPdfService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private sub = new Subscription();

  // ─── Catálogos ────────────────────────────────────────────────────────────
  store = {
    sucursales: [] as SucursalResponse[],
    pacientes: [] as PacienteResponse[],
    servicios: [] as ServicioResponse[],
    especialistas: [] as UserResponse[],
  };

  // ─── Estado de carga ──────────────────────────────────────────────────────
  loadingCatalogos = false;
  loadingCitas = false;
  loadingCobro = false;
  savingCobro = false;
  paying = false;
  errorMsg = '';

  // ─── Lista de citas ───────────────────────────────────────────────────────
  private citasSubject = new BehaviorSubject<CitaCajaVM[]>([]);
  citas: CitaCajaVM[] = [];
  filteredCitas: CitaCajaVM[] = [];

  // ─── Filtros ──────────────────────────────────────────────────────────────
  fSucursal = 0; // 0 = todas (solo admin)
  desde = this.hoy();
  hasta = this.hoy();
  q = '';

  // ─── Rol / sucursal del usuario ───────────────────────────────────────────
  get esAdmin(): boolean {
    const r = this.authService.getRole();
    return r === 'SUPER_ADMIN' || r === 'ADMIN';
  }
  get idSucursalUsuario(): number {
    return this.authService.getUser()?.idSucursal ?? 1;
  }

  // ─── Cita seleccionada ────────────────────────────────────────────────────
  selected: CitaCajaVM | null = null;
  cobro: CobroResponse | null = null;
  items: CobroItemDto[] = [];
  pagos: CobroResponse['pagos'] = [];
  serviciosExpanded = false;

  // ─── Formularios ──────────────────────────────────────────────────────────
  itemAddForm = this.fb.group({
    idServicio: [null as number | null, Validators.required],
    cantidad: [1, [Validators.required, Validators.min(1)]],
  });

  pagoForm = this.fb.group({
    monto: [null as number | null, [Validators.required, Validators.min(0.01), this.montoNoMayorQueSaldo]],
    metodo: ['EFECTIVO'],
    referencia: [''],
  });

  readonly clinica = {
    nombre: 'Absolute Clínica Fisioterapeutas',
    telefono: '2335-5691',
    direccion: 'Guatemala, Guatemala',
  };

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Si no es admin, fijar su sucursal
    if (!this.esAdmin) {
      this.fSucursal = this.idSucursalUsuario;
    }

    // Leer idCita e idSucursal que vienen por queryParams desde citas.component
    this.sub.add(
      this.route.queryParams.subscribe((params) => {
        const idCitaParam = params['idCita'] ? Number(params['idCita']) : null;
        const idSucursalParam = params['idSucursal'] ? Number(params['idSucursal']) : null;

        // si viene fecha, ajusta el rango para que esa cita sí salga en la lista
        const fechaParamRaw = params['fecha'] ? String(params['fecha']) : null;
        const fechaParam = fechaParamRaw ? fechaParamRaw.slice(0, 10) : null; // YYYY-MM-DD
        if (fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam)) {
          this.desde = fechaParam;
          this.hasta = fechaParam;
        }

        if (idSucursalParam && this.esAdmin) {
          this.fSucursal = idSucursalParam;
        }

        this.cargarCatalogos(idCitaParam);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ─── Catálogos ────────────────────────────────────────────────────────────

  private cargarCatalogos(idCitaAutoSelect: number | null = null): void {
    this.loadingCatalogos = true;

    this.sub.add(
      forkJoin({
        sucursales: this.usersApi.listarSucursales(),
        pacientes: this.pacientesApi.listar(),
        servicios: this.serviciosApi.listarActivos(),
        usuarios: this.usersApi.listarActivos(),
      })
        .pipe(finalize(() => (this.loadingCatalogos = false)))
        .subscribe({
          next: (res) => {
            this.store.sucursales = res.sucursales ?? [];
            this.store.pacientes = res.pacientes ?? [];
            this.store.servicios = res.servicios ?? [];
            this.store.especialistas = (res.usuarios ?? []).filter(
              (u: UserResponse) => u.estado === true && u.rol === 'ESPECIALISTA'
            );

            this.cargarCitas(idCitaAutoSelect);
          },
          error: () => {
            this.errorMsg = 'Error al cargar catálogos.';
          },
        })
    );
  }

  // ─── Cargar citas ─────────────────────────────────────────────────────────

  cargarCitas(idCitaAutoSelect: number | null = null): void {
    this.loadingCitas = true;
    this.errorMsg = '';

    const desde = `${this.desde}T00:00:00-06:00`;
    const hasta = `${this.hasta}T23:59:59-06:00`;

    // Igual que en citas.component: si fSucursal=0 carga todas las sucursales en paralelo
    const load$ =
      this.esAdmin && this.fSucursal === 0
        ? this.listarTodasSucursales(desde, hasta)
        : this.citasApi.listar({
            idSucursal: this.esAdmin ? this.fSucursal : this.idSucursalUsuario,
            desde,
            hasta,
          });

    this.sub.add(
      load$.pipe(finalize(() => (this.loadingCitas = false))).subscribe({
        next: (data: any[]) => {
          this.citas = this.dedupeById(data).map((r) => this.toVM(r));
          this.aplicarFiltro();

          // Auto-seleccionar la cita que viene desde /citas
          if (idCitaAutoSelect) {
            const target = this.citas.find((c) => c.id_cita === idCitaAutoSelect);
            if (target) {
              this.selectCita(target);
              // Limpiar queryParams para que F5 no repita la autoselección
              this.router.navigate([], {
                relativeTo: this.route,
                queryParams: {},
                replaceUrl: true,
              });
            }
          }
        },
        error: () => {
          this.errorMsg = 'Error al cargar las citas.';
        },
      })
    );
  }

  // igual que en citas.component: forkJoin por cada sucursal
  private listarTodasSucursales(desde: string, hasta: string) {
    const ids = this.store.sucursales.map((s) => s.idSucursal).filter(Boolean);
    if (!ids.length) return of([] as any[]);
    return forkJoin(ids.map((id) => this.citasApi.listar({ idSucursal: id, desde, hasta }))).pipe(
      map((lists: any[]) => lists.flat())
    );
  }

  private dedupeById(arr: any[]): any[] {
    const seen = new Set<number>();
    return arr.filter((r) => {
      const id = Number(r?.idCita ?? r?.id_cita);
      if (!Number.isFinite(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  aplicarFiltro(): void {
    const q = this.q.toLowerCase().trim();
    this.filteredCitas = this.citas.filter((c) => {
      const matchQ =
        !q ||
        c.paciente_nombre.toLowerCase().includes(q) ||
        (c.paciente_tel ?? '').includes(q) ||
        c.servicio_nombre.toLowerCase().includes(q) ||
        c.estado.toLowerCase().includes(q);
      return matchQ;
    });
  }

  // ─── Filtros UI ───────────────────────────────────────────────────────────

  setSucursal(v: string): void {
    this.fSucursal = Number(v);
    this.cargarCitas();
  }
  setDesde(v: string): void {
    this.desde = v;
  }
  setHasta(v: string): void {
    this.hasta = v;
  }
  aplicarRango(): void {
    this.cargarCitas();
  }
  onBuscar(v: string): void {
    this.q = v;
    this.aplicarFiltro();
  }

  // ─── Seleccionar cita ─────────────────────────────────────────────────────

  selectCita(c: CitaCajaVM): void {
    if (this.selected?.id_cita === c.id_cita) return;
    this.selected = c;
    this.cobro = null;
    this.items = [];
    this.pagos = [];
    this.serviciosExpanded = false;

    // limpiar el formulario de pago al cambiar de cita
    this.pagoForm.reset({ metodo: 'EFECTIVO', referencia: '', monto: null });
    this.refreshPagoValidity();

    this.cargarCobro(c.id_cita);
  }

  private cargarCobro(idCita: number): void {
    this.loadingCobro = true;
    this.sub.add(
      this.cajaService
        .cargarCobroDeCita(idCita)
        .pipe(
          catchError(() => {
            this.errorMsg = 'Error al cargar el cobro.';
            return of(null);
          }),
          finalize(() => (this.loadingCobro = false))
        )
        .subscribe((cobro) => {
          if (!cobro) return;
          this.cobro = cobro;
          this.items = cobro.items ? [...cobro.items] : [];
          this.pagos = cobro.pagos ? [...cobro.pagos] : [];

          // importante: el validador de "monto <= saldo" depende del cobro
          this.refreshPagoValidity();
        })
    );
  }

  // ─── Items (servicios) ────────────────────────────────────────────────────

  addServicio(): void {
    const { idServicio, cantidad } = this.itemAddForm.value;
    if (!idServicio) return;

    const srv = this.store.servicios.find((s) => s.idServicio === idServicio);
    const existing = this.items.find((i) => i.idServicio === idServicio);

    if (existing) {
      existing.cantidad += cantidad ?? 1;
      existing.subtotal = existing.precioUnitario * existing.cantidad;
      this.items = [...this.items];
    } else {
      this.items = [
        ...this.items,
        {
          idServicio,
          nombre: srv?.nombre ?? `Servicio #${idServicio}`,
          cantidad: cantidad ?? 1,
          precioUnitario: (srv as any)?.precioActual ?? 0,
          subtotal: ((srv as any)?.precioActual ?? 0) * (cantidad ?? 1),
        },
      ];
    }
    this.itemAddForm.patchValue({ idServicio: null, cantidad: 1 });
  }

  removeItem(i: number): void {
    this.items = this.items.filter((_, idx) => idx !== i);
  }

  onItemCantidad(i: number, val: string): void {
    const cant = Math.max(1, parseInt(val, 10) || 1);
    this.items = this.items.map((it, idx) =>
      idx === i ? { ...it, cantidad: cant, subtotal: it.precioUnitario * cant } : it
    );
  }

  onItemPrecio(i: number, val: string): void {
    const pu = Math.max(0, parseFloat(val) || 0);
    this.items = this.items.map((it, idx) =>
      idx === i ? { ...it, precioUnitario: pu, subtotal: pu * it.cantidad } : it
    );
  }

  // ─── Guardar cobro ────────────────────────────────────────────────────────

  guardarCobro(): void {
    if (!this.selected || !this.cobro || this.estaBloquedo()) return;
    this.savingCobro = true;
    this.sub.add(
      this.cajaService
        .guardarCobro(this.selected.id_cita, {
          moneda: this.cobro.moneda,
          items: this.items,
        })
        .pipe(
          catchError((err) => {
            this.errorMsg = err?.error?.message ?? 'Error al guardar.';
            return of(null);
          }),
          finalize(() => (this.savingCobro = false))
        )
        .subscribe((res) => {
          if (!res) return;
          this.cobro = res;
          this.items = [...(res.items ?? [])];
          this.pagos = [...(res.pagos ?? [])];

          // refrescar regla de "monto <= saldo"
          this.refreshPagoValidity();
        })
    );
  }

  // ─── Pagar ────────────────────────────────────────────────────────────────

  pagar(): void {
    if (this.pagoForm.invalid || !this.selected || !this.cobro || this.estaBloquedo()) return;

    const { monto, metodo, referencia } = this.pagoForm.value;

    // Blindaje extra (por si intentan forzar el submit)
    const m = this.round2(Number(monto));
    const s = this.round2(Number(this.cobro.saldo ?? 0));
    if (Number.isFinite(m) && Number.isFinite(s) && m > s) {
      const ctrl = this.pagoForm.get('monto');
      ctrl?.setErrors({ ...(ctrl.errors ?? {}), exceedSaldo: { saldo: s, monto: m } });
      ctrl?.markAsTouched();
      this.errorMsg = `El monto no puede ser mayor al saldo (${this.money(this.cobro.saldo, this.cobro.moneda)}).`;
      return;
    }

    this.paying = true;

    this.sub.add(
      this.cajaService
        .pagar(this.selected.id_cita, {
          monto: monto!,
          metodo: metodo || 'EFECTIVO',
          referencia: referencia || null,
        })
        .pipe(
          catchError((err) => {
            this.errorMsg = err?.error?.message ?? 'Error al pagar.';
            return of(null);
          }),
          finalize(() => (this.paying = false))
        )
        .subscribe((res) => {
          if (!res) return;
          this.cobro = res;
          this.items = [...(res.items ?? [])];
          this.pagos = [...(res.pagos ?? [])];
          this.pagoForm.reset({ metodo: 'EFECTIVO', referencia: '', monto: null });

          // refrescar regla de "monto <= saldo"
          this.refreshPagoValidity();

          // Actualizar dot en la lista
          if (this.selected) {
            this.selected = { ...this.selected, estadoPago: res.estadoPago };
            this.citas = this.citas.map((c) =>
              c.id_cita === this.selected!.id_cita ? { ...c, estadoPago: res.estadoPago } : c
            );
            this.aplicarFiltro();
          }
        })
    );
  }

  pagarSaldo(): void {
    if (!this.cobro || this.cobro.saldo <= 0) return;
    this.pagoForm.patchValue({ monto: this.cobro.saldo });
    this.refreshPagoValidity();
  }

  // ─── PDF ──────────────────────────────────────────────────────────────────

  get canPdf(): boolean {
    return !!this.selected && !!this.cobro && !this.loadingCobro;
  }

  get pdfData() {
    // Adaptar CitaCajaVM → CitaCajaVm que espera el PdfService
    const c = this.selected!;
    return {
      cita: {
        idCita: c.id_cita,
        idPaciente: c.id_paciente,
        idServicio: c.id_servicio,
        idEspecialista: c.id_especialista,
        idSucursal: c.id_sucursal,
        fechaInicio: c.fecha_inicio,
        duracionMinutos: c.duracion_minutos,
        estado: c.estado,
        canal: null,
        motivo: null,
        paciente: c.paciente_nombre,
        pacienteTel: c.paciente_tel,
        pacienteCorreo: c.paciente_correo,
        servicio: c.servicio_nombre,
        especialista: c.especialista_nombre,
        sucursal: c.sucursal_nombre,
      } as any,
      cobro: this.cobro!,
      clinica: this.clinica,
    };
  }

  descargarPdf(): void {
    if (this.canPdf) this.pdfService.descargar(this.pdfData);
  }
  imprimirPdf(): void {
    if (this.canPdf) this.pdfService.imprimir(this.pdfData);
  }
  enviarWhatsApp(): void {
    if (this.canPdf) this.pdfService.enviarWhatsApp(this.pdfData);
  }
  enviarCorreo(): void {
    if (this.canPdf) this.pdfService.enviarCorreo(this.pdfData);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  estaBloquedo(): boolean {
    return this.cobro?.estadoPago === 'PAGADO';
  }
  totalItems(): number {
    return this.items.reduce((s, i) => s + (i.subtotal ?? 0), 0);
  }

  money(v: number | null | undefined, moneda = 'GTQ'): string {
    if (v == null) return `${moneda} 0.00`;
    return `${moneda} ${Number(v).toFixed(2)}`;
  }

  fmtDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
  }

  private hoy(): string {
    return new Date().toISOString().slice(0, 10);
  }

  // ─── Validación: no permitir pagar más que el saldo ───────────────────────

  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  private montoNoMayorQueSaldo(control: AbstractControl): ValidationErrors | null {
    const raw = control.value;
    if (raw == null || raw === '') return null;

    const monto = this.round2(Number(raw));
    if (!Number.isFinite(monto)) return null;

    const saldoRaw = this.cobro?.saldo;
    if (saldoRaw == null) return null;

    const saldo = this.round2(Number(saldoRaw));
    if (!Number.isFinite(saldo)) return null;

    return monto <= saldo ? null : { exceedSaldo: { saldo, monto } };
  }

  private refreshPagoValidity(): void {
    this.pagoForm.get('monto')?.updateValueAndValidity({ emitEvent: false });
  }

  // ─── toVM — igual que en citas.component ─────────────────────────────────

  private toVM(r: CitaResponse): CitaCajaVM {
    const idCita = (r as any).idCita ?? (r as any).id_cita;
    const idSucursal = (r as any).idSucursal ?? (r as any).id_sucursal;
    const idPaciente = (r as any).idPaciente ?? (r as any).id_paciente;
    const idServicio = (r as any).idServicio ?? (r as any).id_servicio;
    const idEspecialista = (r as any).idEspecialista ?? (r as any).id_especialista ?? null;
    const fechaInicio = (r as any).fechaInicio ?? (r as any).fecha_inicio;
    const durMin = Number((r as any).duracionMinutos ?? (r as any).duracion_minutos ?? 60);

    const suc = this.store.sucursales.find((s) => s.idSucursal === idSucursal);
    const pac = this.store.pacientes.find((p) => p.idPaciente === idPaciente);
    const srv = this.store.servicios.find((s) => s.idServicio === idServicio);
    const esp = idEspecialista != null ? this.store.especialistas.find((e) => e.idUsuario === idEspecialista) : null;

    return {
      id_cita: Number(idCita),
      id_sucursal: Number(idSucursal),
      sucursal_nombre: suc?.nombre ?? `Sucursal #${idSucursal}`,
      id_paciente: Number(idPaciente),
      paciente_nombre: pac ? `${pac.nombres} ${pac.apellidos ?? ''}`.trim() : `Paciente #${idPaciente}`,
      paciente_tel: pac?.telefono ?? null,
      paciente_correo: pac?.correo ?? null,
      id_servicio: Number(idServicio),
      servicio_nombre: srv?.nombre ?? `Servicio #${idServicio}`,
      id_especialista: idEspecialista != null ? Number(idEspecialista) : null,
      especialista_nombre: esp ? `${esp.nombre} ${esp.apellido}` : null,
      fecha_inicio: String(fechaInicio),
      duracion_minutos: Math.max(5, Math.min(210, durMin)),
      estado: (r as any).estado,
    };
  }
}
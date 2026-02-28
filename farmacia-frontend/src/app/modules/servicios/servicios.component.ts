// src/app/modules/servicios/servicios.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { finalize, Subject, takeUntil } from 'rxjs';

import { UiToastService } from '../../shared/ui/toast/ui-toast.service';
import {
  ServiciosApiService,
  ServicioResponse,
  ServicioCreateRequest,
  ServicioUpdateRequest,
  ServicioPrecioRequest,
  ServicioPrecioResponse,
} from '../../core/api/servicios-api.service';
import { httpErrorMessage } from '../../shared/ui/http-error.util';

type ModalMode     = 'create' | 'edit';
type ConfirmAction = 'inactivar' | 'reactivar';

@Component({
  selector: 'app-servicios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: 'servicios.component.html',
  styleUrls: ['servicios.component.scss'],
})
export class ServiciosComponent implements OnInit, OnDestroy {

  private readonly fb    = inject(FormBuilder);
  private readonly api   = inject(ServiciosApiService);
  private readonly toast = inject(UiToastService);
  private readonly destroy$ = new Subject<void>();

  // ── Listado ────────────────────────────────────────────────────────────────
  loading          = false;
  includeInactivos = false;
  q                = '';
  servicios: ServicioResponse[] = [];
  view:      ServicioResponse[] = [];
  pageSize   = 10;
  page       = 1;
  totalPages = 1;

  // ── Modal crear / editar ───────────────────────────────────────────────────
  modalOpen  = false;
  modalMode: ModalMode = 'create';
  saving     = false;
  selected:  ServicioResponse | null = null;
  private editBaseline: { nombre: string; descripcion: string | null } | null = null;

  // ── Modal precio ───────────────────────────────────────────────────────────
  priceOpen     = false;
  priceSaving   = false;
  priceServicio: ServicioResponse | null = null;
  private priceBaseline: { precio: number | null; moneda: string } | null = null;

  // ── Modal historial ────────────────────────────────────────────────────────
  histOpen     = false;
  histLoading  = false;
  histServicio: ServicioResponse | null = null;
  hist: ServicioPrecioResponse[] = [];

  // ── Confirm inactivar / reactivar ──────────────────────────────────────────
  confirmOpen    = false;
  confirmLoading = false;
  confirmTitle   = '';
  confirmMsg     = '';
  confirmKind:   'danger' | 'ok'         = 'danger';
  confirmAction: ConfirmAction           = 'inactivar';
  private confirmServicio: ServicioResponse | null = null;

  // ── Formularios ────────────────────────────────────────────────────────────
  form!: FormGroup;
  priceForm!: FormGroup;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  constructor() {
    this.form = this.fb.group({
      nombre:        ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
      descripcion:   ['', Validators.maxLength(500)],
      precioInicial: [null],
      moneda:        ['GTQ'],
    });

    this.priceForm = this.fb.group({
      precio: [null, [Validators.required, Validators.min(0.01)]],
      moneda: ['GTQ'],
    });
  }

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Getters para el template ───────────────────────────────────────────────

  get canSubmitModal(): boolean {
    if (this.saving || this.form.invalid) return false;
    return this.modalMode === 'edit' ? this.editHasChanges() : true;
  }

  get canSubmitPrecio(): boolean {
    if (this.priceSaving || this.priceForm.invalid) return false;
    return this.priceHasChanges();
  }

  // ── Detección de cambios ───────────────────────────────────────────────────

  editHasChanges(): boolean {
    if (this.modalMode !== 'edit' || !this.editBaseline) return true;
    return (
      this.norm(this.form.get('nombre')?.value)        !== this.editBaseline.nombre ||
      this.normDesc(this.form.get('descripcion')?.value) !== this.editBaseline.descripcion
    );
  }

  priceHasChanges(): boolean {
    if (!this.priceBaseline) return true;
    return (
      this.normMoney(this.priceForm.get('precio')?.value) !== this.priceBaseline.precio ||
      this.normMoneda(this.priceForm.get('moneda')?.value) !== this.priceBaseline.moneda
    );
  }

  // ── Carga + filtro + paginación ────────────────────────────────────────────

  onToggleInactivos(): void {
    this.page = 1;
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    const req$ = this.includeInactivos ? this.api.listarTodos() : this.api.listarActivos();

    req$
      .pipe(finalize(() => (this.loading = false)), takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.servicios = this.sortServicios(Array.isArray(data) ? data : []);
          this.page = 1;
          this.aplicarFiltro();
        },
        error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudo cargar servicios')),
      });
  }

  aplicarFiltro(): void {
    const term = this.q.trim().toLowerCase();

    let filtered = this.servicios;
    if (term) {
      filtered = this.servicios.filter((s) => {
        const bag = [s.nombre, s.descripcion, s.moneda,
                     s.precioActual != null ? String(s.precioActual) : '',
                     s.activo ? 'activo' : 'inactivo'].join(' ').toLowerCase();
        return bag.includes(term);
      });
    }

    filtered = this.sortServicios(filtered);
    this.totalPages = Math.max(1, Math.ceil(filtered.length / this.pageSize));
    this.page = Math.min(this.page, this.totalPages);
    this.view = filtered.slice((this.page - 1) * this.pageSize, this.page * this.pageSize);
  }

  goPage(p: number): void {
    this.page = Math.min(Math.max(1, p), this.totalPages);
    this.aplicarFiltro();
  }

  // ── Modal crear / editar ───────────────────────────────────────────────────

  openCreate(): void {
    this.modalMode    = 'create';
    this.selected     = null;
    this.editBaseline = null;
    this.saving       = false;

    this.form.reset({ nombre: '', descripcion: '', precioInicial: null, moneda: 'GTQ' });
    this.modalOpen = true;
  }

  openEdit(s: ServicioResponse): void {
    this.modalMode = 'edit';
    this.selected  = s;
    this.saving    = false;

    this.form.reset({
      nombre: s.nombre ?? '', descripcion: s.descripcion ?? '',
      precioInicial: null, moneda: s.moneda ?? 'GTQ',
    });

    this.editBaseline = {
      nombre:      this.norm(s.nombre),
      descripcion: this.normDesc(s.descripcion),
    };
    this.modalOpen = true;
  }

  closeModal(): void {
    if (this.saving) return;
    this.modalOpen    = false;
    this.selected     = null;
    this.editBaseline = null;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Revisa los campos');
      return;
    }

    const nombre      = this.norm(this.form.get('nombre')?.value);
    const descripcion = this.normDesc(this.form.get('descripcion')?.value);
    const moneda      = this.normMoneda(this.form.get('moneda')?.value) || 'GTQ';
    const precioRaw   = this.form.get('precioInicial')?.value;
    const precioInicial = precioRaw != null && String(precioRaw).trim() !== ''
      ? Number(precioRaw) : null;

    if (precioInicial !== null && (!Number.isFinite(precioInicial) || precioInicial <= 0)) {
      this.toast.warning('El precio inicial debe ser mayor a 0');
      return;
    }

    this.saving = true;

    if (this.modalMode === 'create') {
      const payload: ServicioCreateRequest = { nombre, descripcion, precioInicial, moneda };
      this.api.crear(payload)
        .pipe(finalize(() => (this.saving = false)), takeUntil(this.destroy$))
        .subscribe({
          next: () => { this.toast.success('Servicio creado'); this.closeModal(); this.cargar(); },
          error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudo crear el servicio')),
        });
      return;
    }

    if (!this.selected) { this.saving = false; return; }

    if (!this.editHasChanges()) {
      this.saving = false;
      this.toast.warning('No hay cambios por guardar');
      return;
    }

    const payload: ServicioUpdateRequest = { nombre, descripcion };
    this.api.editar(this.selected.idServicio, payload)
      .pipe(finalize(() => (this.saving = false)), takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.toast.success('Servicio actualizado'); this.closeModal(); this.cargar(); },
        error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudo actualizar el servicio')),
      });
  }

  // ── Modal precio ───────────────────────────────────────────────────────────

  openPrecio(s: ServicioResponse): void {
    const basePrecio = this.normMoney(s.precioActual);
    const baseMoneda = this.normMoneda(s.moneda ?? 'GTQ');
    this.priceServicio = s;
    this.priceBaseline = { precio: basePrecio, moneda: baseMoneda };
    this.priceForm.reset({ precio: basePrecio, moneda: baseMoneda });
    this.priceOpen = true;
  }

  closePrecio(): void {
    if (this.priceSaving) return;
    this.priceOpen     = false;
    this.priceServicio = null;
    this.priceBaseline = null;
  }

  savePrecio(): void {
    if (!this.priceServicio) return;

    if (this.priceForm.invalid) {
      this.priceForm.markAllAsTouched();
      this.toast.warning('Revisa el precio');
      return;
    }

    if (!this.priceHasChanges()) {
      this.toast.warning('No hay cambios por guardar');
      return;
    }

    const precio = this.normMoney(this.priceForm.get('precio')?.value);
    const moneda = this.normMoneda(this.priceForm.get('moneda')?.value);

    if (precio === null || precio <= 0) {
      this.toast.warning('El precio debe ser mayor a 0');
      return;
    }

    const payload: ServicioPrecioRequest = { precio, moneda };
    this.priceSaving = true;

    this.api.setPrecio(this.priceServicio.idServicio, payload)
      .pipe(finalize(() => (this.priceSaving = false)), takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.toast.success('Precio actualizado'); this.closePrecio(); this.cargar(); },
        error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudo actualizar el precio')),
      });
  }

  // ── Modal historial ────────────────────────────────────────────────────────

  openHistorial(s: ServicioResponse): void {
    this.histServicio = s;
    this.hist         = [];
    this.histOpen     = true;
    this.histLoading  = true;

    this.api.historialPrecios(s.idServicio)
      .pipe(finalize(() => (this.histLoading = false)), takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          const arr = Array.isArray(data) ? data : [];
          this.hist = arr.slice().sort((a, b) => {
            const da = a.vigenteDesde ? new Date(a.vigenteDesde).getTime() : 0;
            const db = b.vigenteDesde ? new Date(b.vigenteDesde).getTime() : 0;
            return db - da;
          });
        },
        error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudo cargar historial')),
      });
  }

  closeHistorial(): void {
    if (this.histLoading) return;
    this.histOpen     = false;
    this.histServicio = null;
    this.hist         = [];
  }

  // ── Confirm inactivar / reactivar ──────────────────────────────────────────

  openConfirmInactivar(s: ServicioResponse): void {
    this.confirmServicio = s;
    this.confirmAction   = 'inactivar';
    this.confirmKind     = 'danger';
    this.confirmTitle    = 'Inactivar servicio';
    this.confirmMsg      = `¿Deseas inactivar "${s.nombre}"?`;
    this.confirmLoading  = false;
    this.confirmOpen     = true;
  }

  openConfirmReactivar(s: ServicioResponse): void {
    this.confirmServicio = s;
    this.confirmAction   = 'reactivar';
    this.confirmKind     = 'ok';
    this.confirmTitle    = 'Reactivar servicio';
    this.confirmMsg      = `¿Deseas reactivar "${s.nombre}"?`;
    this.confirmLoading  = false;
    this.confirmOpen     = true;
  }

  closeConfirm(): void {
    if (this.confirmLoading) return;
    this.confirmOpen    = false;
    this.confirmServicio = null;
    this.confirmTitle   = '';
    this.confirmMsg     = '';
  }

  confirmProceed(): void {
    if (!this.confirmServicio) return;

    const { idServicio } = this.confirmServicio;
    const action = this.confirmAction;
    this.confirmOpen    = false;
    this.confirmLoading = true;

    const req$ = action === 'inactivar'
      ? this.api.inactivar(idServicio)
      : this.api.reactivar(idServicio);

    req$
      .pipe(finalize(() => (this.confirmLoading = false)), takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(action === 'inactivar' ? 'Servicio inactivado' : 'Servicio reactivado');
          this.closeConfirm();
          this.cargar();
        },
        error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudo procesar la acción')),
      });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  money(v?: number | null, moneda?: string | null): string {
    if (v == null) return '—';
    return `${(moneda ?? 'GTQ').toUpperCase()} ${v.toFixed(2)}`;
  }

  fmtDate(v?: string | null): string {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleString('es-GT');
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  private sortServicios(list: ServicioResponse[]): ServicioResponse[] {
    return list.slice().sort((a, b) => {
      if (a.activo !== b.activo) return a.activo ? -1 : 1;
      return (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es', { sensitivity: 'base' });
    });
  }

  private norm(v: any): string {
    return String(v ?? '').trim().replace(/\s+/g, ' ');
  }

  private normDesc(v: any): string | null {
    const s = this.norm(v);
    return s.length ? s : null;
  }

  private normMoney(v: any): number | null {
    if (v == null || String(v).trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }

  private normMoneda(v: any): string {
    return (String(v ?? 'GTQ').trim() || 'GTQ').toUpperCase();
  }
}
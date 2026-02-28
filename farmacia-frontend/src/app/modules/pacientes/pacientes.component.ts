import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { httpErrorMessage } from '../../shared/ui/http-error.util';
import { UiToastService } from '../../shared/ui/toast/ui-toast.service';
import {
  PacientesApiService,
  PacienteResponse,
  PacienteCreateRequest,
  PacienteUpdateRequest,
  PacienteExpedienteResponse,
  PacienteArchivoResponse,
} from '../../core/api/pacientes-api.service';

// ── Tipos ─────────────────────────────────────────────────────────────────────
type ModalMode     = 'create' | 'edit';
type ConfirmAction = 'inactivar' | 'reactivar';
type ConfirmKind   = 'danger' | 'ok';
type ExpedienteTab = 'CITAS' | 'ARCHIVOS';

type ExpedienteCitaVM = any & {
  sucursalNombre?:      string | null;
  servicioNombre?:      string | null;
  especialistaNombre?:  string | null;
};

type PacienteExpedienteVM = Omit<PacienteExpedienteResponse, 'citas'> & {
  citas: ExpedienteCitaVM[];
};

@Component({
  standalone: true,
  selector: 'app-pacientes',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './pacientes.component.html',
  styleUrls: ['./pacientes.component.scss'],
})
export class PacientesComponent implements OnInit {

  private readonly destroyRef = inject(DestroyRef);
  private readonly api        = inject(PacientesApiService);
  private readonly fb         = inject(FormBuilder);
  private readonly toast      = inject(UiToastService);

  // ── Reglas/constantes ──────────────────────────────────────────────────────
  private readonly MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
  private readonly ALLOWED_MIMES = new Set<string>([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]);
  private readonly ALLOWED_EXT = new Set<string>([
    'pdf', 'jpg', 'jpeg', 'png', 'webp', 'txt', 'doc', 'docx', 'xls', 'xlsx'
  ]);

  // ── Listado + filtro + paginación ──────────────────────────────────────────
  pacientes: PacienteResponse[] = [];
  loading = false;
  q = '';
  includeInactivos = false;
  page       = 1;
  pageSize   = 10;
  totalPages = 1;
  view: PacienteResponse[] = [];
  private filtered: PacienteResponse[] = [];

  // ── Modal crear / editar ───────────────────────────────────────────────────
  modalOpen  = false;
  modalMode: ModalMode = 'create';
  saving     = false;
  private editingId: number | null = null;
  private originalEditSnapshot: Record<string, any> | null = null;

  // ── Confirm inactivar / reactivar ──────────────────────────────────────────
  confirmOpen    = false;
  confirmLoading = false;
  confirmAction: ConfirmAction = 'inactivar';
  confirmKind:   ConfirmKind   = 'danger';
  confirmTitle   = '';
  confirmMsg     = '';
  private confirmPaciente: PacienteResponse | null = null;

  // ── Expediente ─────────────────────────────────────────────────────────────
  expedienteOpen    = false;
  expedienteLoading = false;
  expedienteMsg     = '';
  expedienteTab: ExpedienteTab = 'CITAS';
  expedienteIncludeInactivos   = false;
  expedientePacienteId:   number | null = null;
  expedientePacienteLabel = '';
  expediente: PacienteExpedienteVM | null = null;
  archivosFiltroCitaId: number | null = null;

  // Anti “respuesta tardía” (evita que un expediente viejo pise el actual)
  private expReqSeq = 0;

  // ── Archivos (upload) ──────────────────────────────────────────────────────
  archivoFile:     File | null = null;
  archivoFileName  = '';
  archivoUploading = false;
  archivoMsg       = '';

  // ── Confirm anular archivo ─────────────────────────────────────────────────
  confirmArchivoOpen    = false;
  confirmArchivoLoading = false;
  confirmArchivoMsg     = '';
  private confirmArchivoTarget: PacienteArchivoResponse | null = null;

  // ── Formularios ────────────────────────────────────────────────────────────
  form!: FormGroup;
  archivoForm!: FormGroup;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  constructor() {
    this.buildForms();
  }

  ngOnInit(): void {
    this.loadPacientes();
  }

  // ── Construcción de formularios ────────────────────────────────────────────
  private buildForms(): void {
    this.form = this.fb.group({
      nombres:   ['', [Validators.required, Validators.maxLength(120)]],
      apellidos: ['', [Validators.required, Validators.maxLength(120)]],
      telefono:  [null, [Validators.required, this.optionalExactDigits(8)]],
      correo:    [null, [Validators.email, Validators.maxLength(180)]],
      nit:       [null, [this.optionalNitGt(), Validators.maxLength(30)]],
      dpi:       [null, [this.optionalExactDigits(13)]],
      direccion: [null, [Validators.maxLength(180)]],
    });

    this.archivoForm = this.fb.group({
      titulo: [null, [Validators.maxLength(140)]],
      tipo:   ['DOCUMENTO', Validators.required],
      idCita: [null], // ✅ null = “Sin cita”
    });

    // Normalización en vivo — solo dígitos
    this.watchDigitField('telefono');
    this.watchDigitField('dpi');

    // Normalización en vivo — trim correo
    this.form.get('correo')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (typeof v === 'string') {
          const clean = v.trim();
          if (v !== clean) this.form.get('correo')?.setValue(clean, { emitEvent: false });
        }
      });

    // Normalización en vivo — espacios múltiples en nombres/apellidos
    this.watchNameField('nombres');
    this.watchNameField('apellidos');
  }

  private watchDigitField(field: string): void {
    this.form.get(field)?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        const current = (v ?? '').toString();
        const clean   = this.onlyDigits(current);
        if (current !== clean) this.form.get(field)?.setValue(clean || null, { emitEvent: false });
      });
  }

  private watchNameField(field: string): void {
    this.form.get(field)?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (typeof v === 'string') {
          const clean = v.replace(/\s+/g, ' ').trimStart();
          if (v !== clean) this.form.get(field)?.setValue(clean, { emitEvent: false });
        }
      });
  }

  // ── Helpers UI ─────────────────────────────────────────────────────────────
  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c?.invalid && (c.touched || c.dirty));
  }

  isArchivoInvalid(field: string): boolean {
    const c = this.archivoForm.get(field);
    return !!(c?.invalid && (c.touched || c.dirty));
  }

  hasChanges(): boolean {
    if (this.modalMode !== 'edit') return true;
    if (!this.originalEditSnapshot) return this.form.dirty;

    const current = this.cleanPayload(this.form.getRawValue());
    const keys = ['nombres', 'apellidos', 'telefono', 'correo', 'nit', 'dpi', 'direccion'] as const;
    return keys.some((k) => (current[k] ?? null) !== (this.originalEditSnapshot![k] ?? null));
  }

  // ── Listado ────────────────────────────────────────────────────────────────
  loadPacientes(): void {
    this.loading = true;
    const req$ = this.includeInactivos ? this.api.listarTodos() : this.api.listar();

    req$
      .pipe(finalize(() => (this.loading = false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.pacientes = (res || []).slice();
          this.aplicarFiltro(true);
        },
        error: (err) => {
          this.pacientes = [];
          this.filtered  = [];
          this.view      = [];
          this.page      = 1;
          this.totalPages = 1;
          this.toast.error(httpErrorMessage(err, 'No se pudieron cargar los pacientes.'));
        },
      });
  }

  onToggleInactivos(): void {
    this.page = 1;
    this.loadPacientes();
  }

  aplicarFiltro(resetPage = false): void {
    if (resetPage) this.page = 1;

    const q = this.q.trim().toLowerCase();

    this.filtered = !q
      ? this.pacientes.slice()
      : this.pacientes.filter((p) => {
          const label = this.pacienteLabel(p).toLowerCase();
          return (
            label.includes(q) ||
            String(p.telefono ?? '').toLowerCase().includes(q) ||
            String(p.correo   ?? '').toLowerCase().includes(q) ||
            String(p.nit      ?? '').toLowerCase().includes(q) ||
            String(p.dpi      ?? '').toLowerCase().includes(q)
          );
        });

    this.sortAZ(this.filtered);
    this.totalPages = Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
    this.page = Math.min(this.page, this.totalPages);
    this.applyPage();
  }

  applyPage(): void {
    const start = (this.page - 1) * this.pageSize;
    this.view = this.filtered.slice(start, start + this.pageSize);
  }

  prev(): void { if (this.page > 1)              { this.page--; this.applyPage(); } }
  next(): void { if (this.page < this.totalPages){ this.page++; this.applyPage(); } }

  // ── Modal crear / editar ───────────────────────────────────────────────────
  openCreate(): void {
    this.modalMode = 'create';
    this.editingId = null;
    this.originalEditSnapshot = null;
    this.saving = false;

    this.form.reset({
      nombres: '', apellidos: '', telefono: null,
      correo: null, nit: null, dpi: null, direccion: null
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.modalOpen = true;
  }

  openEdit(p: PacienteResponse): void {
    this.modalMode = 'edit';
    this.editingId = p.idPaciente;
    this.saving    = false;

    this.form.reset({
      nombres: p.nombres ?? '', apellidos: p.apellidos ?? '',
      telefono: p.telefono ?? null, correo: p.correo ?? null,
      nit: p.nit ?? null, dpi: p.dpi ?? null, direccion: p.direccion ?? null,
    });

    this.originalEditSnapshot = this.cleanPayload(this.form.getRawValue());
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.modalOpen = true;
  }

  closeModal(): void {
    if (this.saving) return;
    this.modalOpen = false;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Revisa los campos requeridos.');
      return;
    }
    if (this.modalMode === 'edit' && !this.hasChanges()) {
      this.closeModal();
      return;
    }

    this.saving = true;
    const payload = this.cleanPayload(this.form.getRawValue());

    if (this.modalMode === 'create') {
      this.api.crear(payload as PacienteCreateRequest)
        .pipe(finalize(() => (this.saving = false)), takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.modalOpen = false;
            this.loadPacientes();
            this.toast.success('Paciente creado correctamente.');
          },
          error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudo crear el paciente.')),
        });
      return;
    }

    if (!this.editingId) { this.saving = false; return; }

    this.api.editar(this.editingId, payload as PacienteUpdateRequest)
      .pipe(finalize(() => (this.saving = false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.modalOpen = false;
          this.loadPacientes();
          this.toast.success('Cambios guardados correctamente.');
        },
        error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudieron guardar los cambios.')),
      });
  }

  // ── Confirm inactivar / reactivar ──────────────────────────────────────────
  openConfirm(p: PacienteResponse, action: ConfirmAction): void {
    this.confirmPaciente = p;
    this.confirmAction   = action;
    this.confirmKind     = action === 'inactivar' ? 'danger' : 'ok';
    this.confirmTitle    = action === 'inactivar' ? 'Inactivar paciente' : 'Reactivar paciente';
    this.confirmMsg      = `¿Deseas ${action} a ${this.pacienteLabel(p)}?`;
    this.confirmLoading  = false;
    this.confirmOpen     = true;
  }

  closeConfirm(): void {
    if (this.confirmLoading) return;
    this.confirmOpen     = false;
    this.confirmPaciente = null;
  }

  confirmProceed(): void {
    if (!this.confirmPaciente) return;

    this.confirmLoading = true;
    const id = this.confirmPaciente.idPaciente;
    const req$ = this.confirmAction === 'inactivar' ? this.api.inactivar(id) : this.api.reactivar(id);

    req$
      .pipe(finalize(() => (this.confirmLoading = false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.confirmOpen     = false;
          this.confirmPaciente = null;
          this.loadPacientes();
          this.toast.success(this.confirmAction === 'inactivar' ? 'Paciente inactivado.' : 'Paciente reactivado.');
          if (this.expedienteOpen && this.expedientePacienteId === id) this.reloadExpediente();
        },
        error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudo completar la acción.')),
      });
  }

  // ── Expediente ─────────────────────────────────────────────────────────────
  openExpediente(p: PacienteResponse): void {
    // invalida cualquier respuesta anterior en vuelo
    this.expReqSeq++;

    this.expedienteOpen             = true;
    this.expedienteTab              = 'CITAS';
    this.expedienteIncludeInactivos = false;
    this.expedientePacienteId       = p.idPaciente;
    this.expedientePacienteLabel    = this.pacienteLabel(p);
    this.expediente                 = null;
    this.expedienteMsg              = '';
    this.archivosFiltroCitaId       = null;

    // ✅ por defecto: archivo SIN cita
    this.archivoForm.reset({ titulo: null, tipo: 'DOCUMENTO', idCita: null });
    this.archivoFile     = null;
    this.archivoFileName = '';
    this.archivoMsg      = '';

    this.reloadExpediente();
  }

  closeExpediente(): void {
    if (this.archivoUploading) return;

    // invalida respuestas en vuelo
    this.expReqSeq++;

    this.expedienteOpen          = false;
    this.expedienteLoading       = false;
    this.expedienteMsg           = '';
    this.expedientePacienteId    = null;
    this.expedientePacienteLabel = '';
    this.expediente              = null;
    this.archivosFiltroCitaId    = null;
    this.archivoFile             = null;
    this.archivoFileName         = '';
    this.archivoMsg              = '';
  }

  reloadExpediente(): void {
    if (!this.expedientePacienteId) return;

    const seq = ++this.expReqSeq;

    this.expedienteLoading = true;
    this.expedienteMsg     = '';

    this.api.obtenerExpediente(this.expedientePacienteId, this.expedienteIncludeInactivos)
      .pipe(
        finalize(() => {
          if (seq === this.expReqSeq) this.expedienteLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (exp) => {
          if (seq !== this.expReqSeq) return; // ignora respuesta vieja

          const sortDescByDate = (arr: any[], field: string) =>
            arr.slice().sort((a, b) => new Date(b[field] || 0).getTime() - new Date(a[field] || 0).getTime());

          const citas    = sortDescByDate(exp?.citas    || [], 'fechaInicio');
          const archivos = sortDescByDate(exp?.archivos || [], 'creadoEn');

          this.expediente = { ...(exp as any), citas, archivos } as PacienteExpedienteVM;

          // ✅ NO auto-amarrar idCita: el usuario decide “sin cita” o elige una.
          // Si el usuario tenía una cita seleccionada pero ya no existe, la soltamos a null.
          const idCitaActual = this.archivoForm.get('idCita')?.value ?? null;
          if (idCitaActual != null) {
            const exists = citas.some((c: any) => Number(c.idCita) === Number(idCitaActual));
            if (!exists) this.archivoForm.patchValue({ idCita: null }, { emitEvent: false });
          }
        },
        error: (err) => {
          if (seq !== this.expReqSeq) return;
          this.expedienteMsg = httpErrorMessage(err, 'No se pudo cargar el expediente.');
          this.toast.error(this.expedienteMsg);
        },
      });
  }

  // ── Archivos ───────────────────────────────────────────────────────────────
  onArchivoSelected(ev: Event): void {
    const f = (ev.target as HTMLInputElement)?.files?.[0] ?? null;

    if (!f) {
      this.archivoFile     = null;
      this.archivoFileName = '';
      this.archivoMsg      = '';
      return;
    }

    const err = this.validateArchivo(f);
    if (err) {
      this.archivoFile     = null;
      this.archivoFileName = '';
      this.archivoMsg      = err;
      this.toast.error(err);
      return;
    }

    this.archivoFile     = f;
    this.archivoFileName = f.name;
    this.archivoMsg      = '';
  }

  onCitaArchivoSelected(idCita: number, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input?.files?.[0] ?? null;
    if (input) input.value = '';
    if (!f) return;

    const err = this.validateArchivo(f);
    if (err) {
      this.archivoMsg = err;
      this.toast.error(err);
      return;
    }

    this.archivoFile     = f;
    this.archivoFileName = f.name;
    this.archivoMsg      = '';

    // desde una cita: sí se amarra a esa cita
    this.archivoForm.patchValue({ idCita }, { emitEvent: false });
    this.subirArchivo();
  }

  subirArchivo(): void {
    if (!this.expedientePacienteId) return;

    if (!this.archivoFile) {
      this.toast.error('Selecciona un archivo primero.');
      return;
    }

    const err = this.validateArchivo(this.archivoFile);
    if (err) {
      this.archivoMsg = err;
      this.toast.error(err);
      return;
    }

    if (this.archivoForm.invalid) {
      this.archivoForm.markAllAsTouched();
      this.toast.error('Revisa los datos del archivo.');
      return;
    }

    const { idCita, titulo, tipo } = this.archivoForm.getRawValue();

    this.archivoUploading = true;
    this.archivoMsg       = '';

    this.api.subirArchivo(this.expedientePacienteId, this.archivoFile, {
      idCita: idCita ?? null, // ✅ permite null = sin cita
      titulo: (titulo ?? '').toString().trim() || null,
      tipo:   tipo ?? null,
    })
      .pipe(finalize(() => (this.archivoUploading = false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Archivo subido correctamente.');
          this.archivoFile     = null;
          this.archivoFileName = '';
          this.archivoForm.patchValue({ titulo: null }, { emitEvent: false });
          this.reloadExpediente();
        },
        error: (err2) => this.toast.error(httpErrorMessage(err2, 'No se pudo subir el archivo.')),
      });
  }

  descargarArchivo(a: PacienteArchivoResponse): void {
    if (!this.expedientePacienteId) return;

    this.api.descargarArchivo(this.expedientePacienteId, a.idArchivo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url  = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href     = url;
          link.download = a.filename || 'archivo';
          link.click();
          window.URL.revokeObjectURL(url);
        },
        error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudo descargar el archivo.')),
      });
  }

  verArchivosDeCita(idCita: number): void {
    this.archivosFiltroCitaId = idCita;
    this.expedienteTab = 'ARCHIVOS';
    this.archivoForm.patchValue({ idCita }, { emitEvent: false });
  }

  verTodosLosArchivos(): void {
    this.archivosFiltroCitaId = null;
    this.expedienteTab = 'ARCHIVOS';
    // no tocamos idCita: puede quedar en null o en una cita elegida por el usuario
  }

  volverACitas(): void {
    this.expedienteTab = 'CITAS';
    this.archivosFiltroCitaId = null;
  }

  openConfirmAnularArchivo(a: PacienteArchivoResponse): void {
    this.confirmArchivoOpen    = true;
    this.confirmArchivoLoading = false;
    this.confirmArchivoTarget  = a;
    this.confirmArchivoMsg     = `¿Deseas eliminar el archivo "${a.filename}"?`;
  }

  closeConfirmArchivo(): void {
    if (this.confirmArchivoLoading) return;
    this.confirmArchivoOpen   = false;
    this.confirmArchivoTarget = null;
    this.confirmArchivoMsg    = '';
  }

  confirmAnularArchivoProceed(): void {
    if (!this.expedientePacienteId || !this.confirmArchivoTarget) return;
    this.confirmArchivoLoading = true;

    this.api.anularArchivo(this.expedientePacienteId, this.confirmArchivoTarget.idArchivo)
      .pipe(finalize(() => (this.confirmArchivoLoading = false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.confirmArchivoOpen   = false;
          this.confirmArchivoTarget = null;
          this.confirmArchivoMsg    = '';
          this.reloadExpediente();
          this.toast.success('Archivo eliminado.');
        },
        error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudo eliminar el archivo.')),
      });
  }

  clearArchivoSelected(input?: HTMLInputElement): void {
    this.archivoFile     = null;
    this.archivoFileName = '';
    this.archivoMsg      = '';
    if (input) input.value = '';
  }

  // ── Getters computados ─────────────────────────────────────────────────────
  get archivosView(): PacienteArchivoResponse[] {
    const all = this.expediente?.archivos || [];
    return this.archivosFiltroCitaId == null
      ? all
      : all.filter((a) => Number(a.idCita) === Number(this.archivosFiltroCitaId));
  }

  get archivosFiltroCitaLabel(): string {
    const id = this.archivosFiltroCitaId;
    if (id == null) return '';

    const cita = (this.expediente?.citas || []).find((c: any) => Number(c.idCita) === Number(id));
    if (!cita) return `#${id}`;

    const fecha    = this.fmtCitaFechaHora(cita.fechaInicio) || `#${id}`;
    const servicio = cita.servicioNombre || (cita.idServicio != null ? `#${cita.idServicio}` : null);
    const sucursal = cita.sucursalNombre || (cita.idSucursal != null ? `#${cita.idSucursal}` : null);

    return [fecha, servicio, sucursal].filter(Boolean).join(' · ');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  pacienteLabel(p: PacienteResponse): string {
    const n = (p.nombres   || '').trim();
    const a = (p.apellidos || '').trim();
    return (n + ' ' + a).trim() || `Paciente #${p.idPaciente}`;
  }

  fmtDate(date: any): string {
    if (!date) return '—';
    const d = new Date(date);
    return isNaN(d.getTime()) ? String(date) : d.toLocaleString('es-GT');
  }

  formatBytes(bytes: number): string {
    if (bytes == null) return '';
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
    const val = bytes / Math.pow(1024, i);
    return `${val.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  }

  optionalExactDigits(len: number) {
    return (c: AbstractControl): ValidationErrors | null => {
      const v = (c.value ?? '').toString().trim();
      return !v || new RegExp(`^\\d{${len}}$`).test(v) ? null : { exactDigits: true };
    };
  }

  optionalNitGt() {
    return (c: AbstractControl): ValidationErrors | null => {
      const v = (c.value ?? '').toString().trim().toUpperCase();
      return !v || v === 'CF' || /^\d{1,12}$/.test(v) ? null : { nitInvalid: true };
    };
  }

  // ── Privados ───────────────────────────────────────────────────────────────
  private sortAZ(list: PacienteResponse[]): void {
    list.sort((a, b) => {
      const aKey = `${(a.apellidos ?? '').trim()} ${(a.nombres ?? '').trim()}`.trim();
      const bKey = `${(b.apellidos ?? '').trim()} ${(b.nombres ?? '').trim()}`.trim();
      const c = aKey.localeCompare(bKey, 'es', { sensitivity: 'base' });
      return c !== 0 ? c : (a.idPaciente ?? 0) - (b.idPaciente ?? 0);
    });
  }

  private cleanPayload(raw: any): Record<string, any> {
    const trimOrNull = (x: any) => {
      if (x == null) return null;
      const s = String(x).trim();
      return s.length ? s : null;
    };
    return {
      nombres:   trimOrNull(raw.nombres),
      apellidos: trimOrNull(raw.apellidos),
      telefono:  this.onlyDigits(raw.telefono) || null,
      correo:    trimOrNull(raw.correo),
      nit:       trimOrNull(raw.nit),
      dpi:       this.onlyDigits(raw.dpi) || null,
      direccion: trimOrNull(raw.direccion),
    };
  }

  private onlyDigits(v: any): string {
    return (v ?? '').toString().replace(/\D+/g, '');
  }

  private fmtCitaFechaHora(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);

    const fecha = d.toLocaleDateString('es-GT', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }).replace(',', '');

    const hora = d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
    const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);
    return `${fechaCap} a las ${hora}`;
  }

  private validateArchivo(f: File): string | null {
    if (!f) return 'Selecciona un archivo válido.';

    if (f.size > this.MAX_FILE_BYTES) {
      return `El archivo supera el límite de ${this.formatBytes(this.MAX_FILE_BYTES)}.`;
    }

    // MIME check (si el navegador lo proporciona)
    if (f.type && this.ALLOWED_MIMES.size && !this.ALLOWED_MIMES.has(f.type)) {
      // fallback por extensión (algunos navegadores envían type vacío o raro)
      const ext = this.getFileExt(f.name);
      if (!ext || !this.ALLOWED_EXT.has(ext)) {
        return 'Tipo de archivo no permitido. Usa PDF o imágenes (JPG/PNG/WEBP) o documentos (DOCX/XLSX).';
      }
      return null;
    }

    // Si no hay type, validamos por extensión
    if (!f.type) {
      const ext = this.getFileExt(f.name);
      if (!ext || !this.ALLOWED_EXT.has(ext)) {
        return 'Tipo de archivo no permitido. Usa PDF o imágenes (JPG/PNG/WEBP) o documentos (DOCX/XLSX).';
      }
    }

    return null;
  }

  private getFileExt(name: string): string | null {
    const n = (name || '').trim();
    const i = n.lastIndexOf('.');
    if (i <= 0 || i === n.length - 1) return null;
    return n.slice(i + 1).toLowerCase();
  }
}
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  FormGroup,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { finalize, Subject, takeUntil } from 'rxjs';
import {
  UsersApiService,
  UserResponse,
  Role,
  UserCreateRequest,
  UserUpdateRequest,
  SucursalResponse,
  UserDetailResponse,
} from '../../core/api/users-api.service';
import { UiToastService } from '../../shared/ui/toast/ui-toast.service';
import { httpErrorMessage } from '../../shared/ui/http-error.util';

type ModalMode = 'create' | 'edit';

// Validador: mínimo 8 chars, 1 mayúscula, 1 número
function strongPassword(c: AbstractControl): ValidationErrors | null {
  const v = String(c.value ?? '');
  if (!v) return null; // vacío lo maneja required si aplica
  return /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(v) ? null : { strong: true };
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
})
export class UsersComponent implements OnInit, OnDestroy {

  // ── Catálogos ──────────────────────────────────────────────────────────────
  readonly roles: Role[] = ['SUPER_ADMIN', 'ADMIN', 'CAJA', 'SECRETARIA', 'ESPECIALISTA'];

  // ── Estado general ─────────────────────────────────────────────────────────
  loading  = false;
  saving   = false;

  // ── Filtro / búsqueda ──────────────────────────────────────────────────────
  includeInactivos = false;
  q = '';

  // ── Datos ──────────────────────────────────────────────────────────────────
  users:     UserResponse[]    = [];
  view:      UserResponse[]    = [];
  sucursales: SucursalResponse[] = [];

  // ── Paginación ─────────────────────────────────────────────────────────────
  pageSize   = 10;
  page       = 1;
  totalPages = 1;

  // ── Modal crear/editar ─────────────────────────────────────────────────────
  modalOpen  = false;
  modalMode: ModalMode = 'create';
  selected:  UserResponse | null = null;

  // ── Modal confirmación ─────────────────────────────────────────────────────
  confirmOpen    = false;
  confirmLoading = false;
  confirmTitle   = '';
  confirmMsg     = '';
  confirmKind:   'danger' | 'ok'         = 'danger';
  confirmAction: 'anular' | 'reactivar'  = 'anular';
  confirmUser:   UserResponse | null     = null;

  // ── Servicios ──────────────────────────────────────────────────────────────
  private readonly fb    = inject(FormBuilder);
  private readonly api   = inject(UsersApiService);
  private readonly toast = inject(UiToastService);

  // ── Limpieza ───────────────────────────────────────────────────────────────
  private readonly destroy$ = new Subject<void>();

  // ── Validadores reutilizables ──────────────────────────────────────────────
  private readonly phone8 = Validators.pattern(/^\d{8}$/);

  // ── Formulario ─────────────────────────────────────────────────────────────
  form: FormGroup = this.fb.group({
    usuario:    ['', [Validators.required, Validators.minLength(3), Validators.maxLength(60)]],
    correo:     ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    rol:        ['ADMIN' as Role, Validators.required],
    especialidad: [''],
    nombre:     [''],
    apellido:   [''],
    telefono:   ['', this.phone8],
    idSucursal: [null as any, Validators.required],
    password:   [''],
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.cargarSucursales();
    this.cargar();

    // Especialidad obligatoria solo si rol = ESPECIALISTA
    this.form.get('rol')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((r: Role) => {
        const esp = this.form.get('especialidad');
        if (!esp) return;
        if (r === 'ESPECIALISTA') {
          esp.setValidators([Validators.required, Validators.minLength(3), Validators.maxLength(120)]);
        } else {
          esp.clearValidators();
          esp.setValue('', { emitEvent: false });
        }
        esp.updateValueAndValidity({ emitEvent: false });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Sucursales ─────────────────────────────────────────────────────────────

  cargarSucursales(): void {
    this.api.listarSucursales()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => (this.sucursales = Array.isArray(data) ? data : []),
        error: ()     => (this.sucursales = []),
      });
  }

  // ── Carga y filtrado ───────────────────────────────────────────────────────

  cargar(): void {
    this.loading = true;
    const req$ = this.includeInactivos ? this.api.listarTodos() : this.api.listarActivos();

    req$
      .pipe(finalize(() => (this.loading = false)), takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.users = Array.isArray(data) ? data : [];
          this.page  = 1;
          this.aplicarFiltro();
        },
        error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudo cargar usuarios')),
      });
  }

  onToggleInactivos(): void {
    this.page = 1;
    this.cargar();
  }

  aplicarFiltro(): void {
    const term = this.q.trim().toLowerCase();

    let filtered = this.users;
    if (term) {
      filtered = this.users.filter(u => {
        const bag = [u.usuario, u.correo, u.rol, u.nombre, u.apellido, u.telefono,
                     u.estado ? 'activo' : 'inactivo'].join(' ').toLowerCase();
        return bag.includes(term);
      });
    }

    filtered.sort((a, b) =>
      (a.usuario ?? '').localeCompare(b.usuario ?? '', 'es', { sensitivity: 'base' })
    );

    this.totalPages = Math.max(1, Math.ceil(filtered.length / this.pageSize));
    this.page = Math.min(this.page, this.totalPages);

    const start = (this.page - 1) * this.pageSize;
    this.view = filtered.slice(start, start + this.pageSize);
  }

  goPage(p: number): void {
    this.page = Math.min(Math.max(1, p), this.totalPages);
    this.aplicarFiltro();
  }

  // ── Modal crear / editar ───────────────────────────────────────────────────

  openCreate(): void {
    this.modalMode = 'create';
    this.selected  = null;

    this.form.reset({
      usuario: '', correo: '', rol: 'ADMIN', especialidad: '',
      nombre: '', apellido: '', telefono: '', idSucursal: null, password: '',
    });

    this.form.get('usuario')?.enable();
    this.form.get('password')?.setValidators([Validators.required, strongPassword]);
    this.form.get('password')?.updateValueAndValidity({ emitEvent: false });
    this.form.get('telefono')?.setValidators([this.phone8]);
    this.form.get('telefono')?.updateValueAndValidity({ emitEvent: false });
    this.form.get('rol')?.updateValueAndValidity({ emitEvent: true });

    this.modalOpen = true;
  }

  openEdit(u: UserResponse): void {
    this.modalMode = 'edit';
    this.selected  = u;
    this.modalOpen = true;

    this.form.reset({
      usuario: u.usuario, correo: u.correo, rol: u.rol, especialidad: '',
      nombre: u.nombre ?? '', apellido: u.apellido ?? '',
      telefono: u.telefono ?? '', idSucursal: null, password: '',
    });

    this.form.get('usuario')?.enable();
    this.form.get('password')?.setValidators([strongPassword]);
    this.form.get('password')?.updateValueAndValidity({ emitEvent: false });
    this.form.get('telefono')?.setValidators([this.phone8]);
    this.form.get('telefono')?.updateValueAndValidity({ emitEvent: false });

    // Carga sucursal y especialidad del usuario existente
    this.api.obtener(u.idUsuario)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (full: UserDetailResponse) => this.form.patchValue({ idSucursal: full.idSucursal ?? null }),
        error: (err) => this.toast.warning(httpErrorMessage(err, 'No se pudo cargar detalle del usuario')),
      });

    if (u.rol === 'ESPECIALISTA') {
      this.api.obtenerEspecialista(u.idUsuario)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (esp) => this.form.patchValue({ especialidad: esp.especialidad ?? '' }),
          error: ()   => this.form.patchValue({ especialidad: '' }),
        });
    }

    this.form.get('rol')?.updateValueAndValidity({ emitEvent: true });
  }

  closeModal(): void {
    if (this.saving) return;
    this.modalOpen = false;
    this.selected  = null;
  }

  // ── Guardar ────────────────────────────────────────────────────────────────

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Revisa los campos obligatorios');
      return;
    }

    this.saving = true;

    const v            = this.form.getRawValue();
    const rol          = v.rol as Role;
    const especialidad = String(v.especialidad ?? '').trim();
    const usuarioVal   = String(v.usuario  ?? '').trim();
    const correoVal    = String(v.correo   ?? '').trim();
    const telVal       = String(v.telefono ?? '').trim();
    const pwdVal       = String(v.password ?? '').trim();

    if (this.modalMode === 'create') {
      const payload: UserCreateRequest = {
        usuario: usuarioVal, correo: correoVal,
        password: String(v.password ?? ''),
        rol, nombre: v.nombre?.trim() || null, apellido: v.apellido?.trim() || null,
        telefono: telVal || null, idSucursal: Number(v.idSucursal),
      };

      this.api.crear(payload)
        .pipe(finalize(() => (this.saving = false)), takeUntil(this.destroy$))
        .subscribe({
          next: (created) => this.postSave(created.idUsuario, rol, especialidad, 'crear'),
          error: (err)    => this.toast.error(httpErrorMessage(err, 'No se pudo crear el usuario')),
        });
      return;
    }

    // ── Editar ───────────────────────────────────────────────────────────────
    if (!this.selected) { this.saving = false; return; }

    const idSucRaw = v.idSucursal;
    const payload: UserUpdateRequest = {
      usuario: usuarioVal, correo: correoVal || null,
      rol: rol || null, nombre: v.nombre?.trim() || null, apellido: v.apellido?.trim() || null,
      telefono: telVal || null,
      idSucursal: idSucRaw != null && String(idSucRaw).trim() !== '' ? Number(idSucRaw) : null,
      password: pwdVal || null,
    } as any;

    this.api.editar(this.selected.idUsuario, payload)
      .pipe(finalize(() => (this.saving = false)), takeUntil(this.destroy$))
      .subscribe({
        next: () => this.postSave(this.selected!.idUsuario, rol, especialidad, 'editar'),
        error: (err) => this.toast.error(httpErrorMessage(err, 'No se pudo actualizar el usuario')),
      });
  }

  /** Maneja el paso post-guardado: si es ESPECIALISTA, también actualiza especialidad. */
  private postSave(idUsuario: number, rol: Role, especialidad: string, op: 'crear' | 'editar'): void {
    const label = op === 'crear' ? 'creado' : 'actualizado';

    if (rol !== 'ESPECIALISTA') {
      this.toast.success(`Usuario ${label}`);
      this.closeModal();
      this.cargar();
      return;
    }

    this.api.upsertEspecialista(idUsuario, especialidad)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(`Usuario especialista ${label}`);
          this.closeModal();
          this.cargar();
        },
        error: (err) => {
          this.toast.error(httpErrorMessage(err, `Usuario ${label}, pero no se pudo guardar la especialidad`));
          this.closeModal();
          this.cargar();
        },
      });
  }

  // ── Confirm anular / reactivar ─────────────────────────────────────────────

  openConfirmAnular(u: UserResponse): void {
    this.confirmUser   = u;
    this.confirmAction = 'anular';
    this.confirmKind   = 'danger';
    this.confirmTitle  = 'Inactivar usuario';
    this.confirmMsg    = `¿Deseas inactivar a "${u.usuario}"?`;
    this.confirmOpen   = true;
  }

  openConfirmReactivar(u: UserResponse): void {
    this.confirmUser   = u;
    this.confirmAction = 'reactivar';
    this.confirmKind   = 'ok';
    this.confirmTitle  = 'Reactivar usuario';
    this.confirmMsg    = `¿Deseas reactivar a "${u.usuario}"?`;
    this.confirmOpen   = true;
  }

  closeConfirm(): void {
    if (this.confirmLoading) return;
    this.confirmOpen = false;
    this.confirmUser = null;
    this.confirmTitle = '';
    this.confirmMsg   = '';
  }

  confirmProceed(): void {
    if (!this.confirmUser) return;

    const { idUsuario } = this.confirmUser;
    const action = this.confirmAction;
    this.confirmOpen    = false;
    this.confirmLoading = true;

    const req$ = action === 'anular' ? this.api.anular(idUsuario) : this.api.reactivar(idUsuario);

    req$
      .pipe(finalize(() => (this.confirmLoading = false)), takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(action === 'anular' ? 'Usuario inactivado' : 'Usuario reactivado');
          this.closeConfirm();
          this.cargar();
        },
        error: (err) => {
          this.closeConfirm();
          this.toast.error(httpErrorMessage(err, 'No se pudo procesar la acción'));
        },
      });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  fmtDate(v?: string): string {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleString('es-GT');
  }
}
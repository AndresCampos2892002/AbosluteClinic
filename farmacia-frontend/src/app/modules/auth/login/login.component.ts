import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';

import { AuthService, LoginRequest, UserRole } from '../../../core/auth/auth.service';

// Mapa de rol → ruta de destino tras el login
const ROLE_REDIRECT: Record<UserRole, string> = {
  SUPER_ADMIN:  '/dashboard',
  ADMIN:        '/dashboard',
  ESPECIALISTA: '/citas',
  SECRETARIA:   '/citas',
  CAJA:         '/caja',
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnDestroy {

  // ── Estado UI ──────────────────────────────────────────────────────────────
  showPassword = false;
  loading      = false;
  errorMsg     = '';

  // ── Formulario (se inicializa en el constructor, después de inject) ────────
  form!: FormGroup;

  // ── Limpieza de subscripciones ─────────────────────────────────────────────
  private readonly destroy$ = new Subject<void>();

  // ── Getters para el template ───────────────────────────────────────────────
  get usuarioCtrl()    { return this.form.get('usuario');    }
  get contrasenaCtrl() { return this.form.get('contrasena'); }

  constructor(
    private readonly fb:     FormBuilder,
    private readonly auth:   AuthService,
    private readonly router: Router,
  ) {
    // fb disponible aquí — se inicializa antes de cualquier uso
    this.form = this.fb.group({
      usuario:    ['', Validators.required],
      contrasena: ['', Validators.required],
    });

    // Limpia el error de backend en cuanto el usuario empieza a corregir
    this.form.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => { this.errorMsg = ''; });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading  = true;
    this.errorMsg = '';

    const payload = this.form.getRawValue() as LoginRequest;

    this.auth.login(payload)
      .pipe(
        switchMap(() => this.auth.refreshUserFromMe()),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (me) => {
          this.loading = false;
          const destino = ROLE_REDIRECT[me.rol] ?? '/dashboard';
          this.router.navigate([destino]);
        },
        error: (err) => {
          this.loading = false;
          this.errorMsg = this.resolveError(err);
        },
      });
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  private resolveError(err: any): string {
    if (err?.status === 401 || err?.status === 403) return 'Credenciales incorrectas.';
    if (err?.status === 0)                           return 'No se pudo conectar con el servidor.';
    return err?.error?.message ?? err?.error?.error ?? err?.message ?? 'Ocurrió un error inesperado.';
  }
}

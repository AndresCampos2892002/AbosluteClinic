import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';

// ── Validador de grupo: contraseñas coinciden ────────────────────────────────
function matchPasswords(group: AbstractControl): ValidationErrors | null {
  const pass    = group.get('nuevaContrasena')?.value;
  const confirm = group.get('confirmContrasena')?.value;
  if (!pass || !confirm) return null;
  return pass === confirm ? null : { passwordMismatch: true };
}

type Step = 'request' | 'code' | 'password';

@Component({
  selector: 'app-olvido-contra',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './olvido-contra.component.html',
  styleUrls: ['./olvido-contra.component.scss'],
})
export class OlvidoContraComponent implements OnDestroy {

  // ── Estado UI ──────────────────────────────────────────────────────────────
  step: Step = 'request';

  loading          = false;
  errorMsg         = '';
  infoMsg          = '';
  showNewPassword     = false;
  showConfirmPassword = false;
  showSuccessModal    = false;
  successTitle = '¡Listo!';
  successText  = 'Contraseña actualizada correctamente.';

  // Límite de reenvíos en el frontend
  private readonly MAX_REQUESTS = 3;
  private requestsCount = 0;

  // ── Formularios ────────────────────────────────────────────────────────────
  requestForm!: FormGroup;
  codeForm!: FormGroup;
  passwordForm!: FormGroup;

  // ── Limpieza de subscripciones ─────────────────────────────────────────────
  private readonly destroy$ = new Subject<void>();

  // ── Getters para el template ───────────────────────────────────────────────
  get correoCtrl()  { return this.requestForm.get('correo');             }
  get codeCtrl()    { return this.codeForm.get('code');                  }
  get nuevaCtrl()   { return this.passwordForm.get('nuevaContrasena');   }
  get confirmCtrl() { return this.passwordForm.get('confirmContrasena'); }
  get mismatch()    { return this.passwordForm.errors?.['passwordMismatch']; }

  constructor(
    private readonly fb:     FormBuilder,
    private readonly auth:   AuthService,
    private readonly router: Router,
  ) {
    this.buildForms();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Construcción de formularios ────────────────────────────────────────────

  private buildForms(): void {
    this.requestForm = this.fb.group({
      correo: ['', [Validators.required, Validators.email]],
    });

    this.codeForm = this.fb.group({
      correo: [{ value: '', disabled: true }],
      code:   ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    });

    this.passwordForm = this.fb.group(
      {
        nuevaContrasena:   ['', [Validators.required, Validators.minLength(6)]],
        confirmContrasena: ['', [Validators.required, Validators.minLength(6)]],
      },
      { validators: matchPasswords }
    );

    // Limpia mensajes cuando el usuario empieza a escribir
    [this.requestForm, this.codeForm, this.passwordForm].forEach(f =>
      f.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.clearMsgs())
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  clearMsgs(): void {
    this.errorMsg = '';
    this.infoMsg  = '';
  }

  toggleNewPassword():     void { this.showNewPassword     = !this.showNewPassword;     }
  toggleConfirmPassword(): void { this.showConfirmPassword = !this.showConfirmPassword; }

  cambiarCorreo(): void {
    this.clearMsgs();
    this.codeForm.reset();
    this.passwordForm.reset();
    this.requestsCount = 0;
    this.step = 'request';
  }

  onSuccessOk(): void {
    this.showSuccessModal = false;
    this.router.navigate(['/login']);
  }

  // ── Manejo de errores HTTP ─────────────────────────────────────────────────

  private resolveHttpError(err: any, fallback: string): string {
    if (err?.status === 0)   return 'No se pudo conectar con el servidor.';
    const msg = err?.error?.message ?? err?.error?.error ?? err?.message;
    if (err?.status === 404) return 'Este correo no está registrado.';
    if (err?.status === 403) return msg ?? 'Tu usuario está inactivo. Contacta a soporte.';
    if (err?.status === 429) return msg ?? 'Demasiados intentos. Solicita un nuevo código.';
    return msg ?? fallback;
  }

  // ── Step 1: solicitar código ───────────────────────────────────────────────

  onRequest(): void {
    this.clearMsgs();

    if (this.requestsCount >= this.MAX_REQUESTS) {
      this.errorMsg = `Solo puedes solicitar el código ${this.MAX_REQUESTS} veces.`;
      return;
    }

    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const correo = (this.requestForm.getRawValue().correo as string).trim();

    this.auth.requestPasswordReset(correo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.requestsCount++;
          this.codeForm.get('correo')?.setValue(correo);
          this.infoMsg = `Enviamos un código de recuperación a: ${correo}.`;
          this.step = 'code';
        },
        error: (err) => {
          this.loading = false;
          this.errorMsg = this.resolveHttpError(err, 'No se pudo enviar el código.');
        },
      });
  }

  // ── Reenviar código ────────────────────────────────────────────────────────

  resend(): void {
    this.clearMsgs();

    if (this.requestsCount >= this.MAX_REQUESTS) {
      this.errorMsg = `Solo puedes solicitar el código ${this.MAX_REQUESTS} veces.`;
      return;
    }

    const correo = (this.codeForm.get('correo')?.value as string ?? '').trim();
    if (!correo) return;

    this.loading = true;

    this.auth.requestPasswordReset(correo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.requestsCount++;
          this.infoMsg = 'Código reenviado. Revisa tu correo.';
        },
        error: (err) => {
          this.loading = false;
          this.errorMsg = this.resolveHttpError(err, 'No se pudo reenviar el código.');
        },
      });
  }

  // ── Step 2: validar código ─────────────────────────────────────────────────

  onValidateCode(): void {
    this.clearMsgs();

    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const correo = (this.codeForm.get('correo')?.value as string).trim();
    const code   = (this.codeForm.get('code')?.value   as string).trim();

    this.auth.validatePasswordReset(correo, code)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.infoMsg = 'Código válido. Ingresa tu nueva contraseña.';
          this.step = 'password';
        },
        error: (err) => {
          this.loading = false;
          this.errorMsg = this.resolveHttpError(err, 'Código inválido o vencido.');
        },
      });
  }

  // ── Step 3: confirmar nueva contraseña ─────────────────────────────────────

  onConfirmPassword(): void {
    this.clearMsgs();

    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const correo          = (this.codeForm.get('correo')?.value          as string).trim();
    const code            = (this.codeForm.get('code')?.value            as string).trim();
    const nuevaContrasena = (this.passwordForm.get('nuevaContrasena')?.value as string);

    this.auth.confirmPasswordReset(correo, code, nuevaContrasena)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.showSuccessModal = true;
        },
        error: (err) => {
          this.loading = false;
          this.errorMsg = this.resolveHttpError(err, 'No se pudo actualizar la contraseña.');
        },
      });
  }
}
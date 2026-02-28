import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Guard funcional — protege rutas que requieren sesión activa.
 * Si no hay token redirige a /login.
 */
export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  return auth.hasToken() ? true : router.parseUrl('/login');
};
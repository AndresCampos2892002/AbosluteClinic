import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService, UserRole } from './auth.service';

/**
 * Guard funcional — verifica que el rol del usuario esté entre
 * los permitidos en route.data['roles'].
 *
 * Uso en rutas:
 *   canActivate: [roleGuard],
 *   data: { roles: ['SUPER_ADMIN', 'ADMIN'] }
 *
 * - Sin token        → redirige a /login
 * - Sin roles en data → deja pasar (ruta abierta a cualquier autenticado)
 * - Rol no permitido → redirige a /forbidden
 */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  const user = auth.getUser();
  if (!user) return router.parseUrl('/login');

  const allowed = route.data['roles'] as UserRole[] | undefined;
  if (!allowed || allowed.length === 0) return true;

  return allowed.includes(user.rol)
    ? true
    : router.parseUrl('/forbidden');
};
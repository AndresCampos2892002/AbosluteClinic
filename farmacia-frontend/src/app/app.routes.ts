import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [

  // ── Rutas públicas ────────────────────────────────────────────────────────
  {
    path: 'login',
    loadComponent: () =>
      import('./modules/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'auth/olvido-contra',
    loadComponent: () =>
      import('./modules/auth/olvido-contra/olvido-contra.component').then(m => m.OlvidoContraComponent),
  },
  {
    path: 'forbidden',
    loadComponent: () =>
      import('./modules/auth/forbidden/forbidden.component').then(m => m.ForbiddenComponent),
  },

  // ── Rutas protegidas (con layout Shell) ───────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [

      // Redirección raíz → dashboard
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

      // Dashboard — SUPER_ADMIN y ADMIN
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./modules/dashboard/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [roleGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN'] },
      },

      // Usuarios — solo SUPER_ADMIN
      {
        path: 'users',
        loadComponent: () =>
          import('./modules/users/users.component').then(m => m.UsersComponent),
        canActivate: [roleGuard],
        data: { roles: ['SUPER_ADMIN'] },
      },

      // Pacientes — SUPER_ADMIN, ADMIN, ESPECIALISTA, SECRETARIA
      {
        path: 'pacientes',
        loadComponent: () =>
          import('./modules/pacientes/pacientes.component').then(m => m.PacientesComponent),
        canActivate: [roleGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN', 'ESPECIALISTA', 'SECRETARIA'] },
      },

      // Servicios — SUPER_ADMIN, ADMIN
      {
        path: 'servicios',
        loadComponent: () =>
          import('./modules/servicios/servicios.component').then(m => m.ServiciosComponent),
        canActivate: [roleGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN'] },
      },

      // Citas — todos los roles (cada uno ve lo suyo en el componente)
      {
        path: 'citas',
        loadComponent: () =>
          import('./modules/citas/citas.component').then(m => m.CitasComponent),
        canActivate: [roleGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN', 'ESPECIALISTA', 'SECRETARIA'] },
      },

      // Caja — SUPER_ADMIN, ADMIN, CAJA
      {
        path: 'caja',
        loadComponent: () =>
          import('./modules/caja/caja-citas.component').then(m => m.CajaCitasComponent),
        canActivate: [roleGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN', 'CAJA'] },
      },

    ],
  },

  // ── Fallback ──────────────────────────────────────────────────────────────
  { path: '**', redirectTo: 'login' },

];
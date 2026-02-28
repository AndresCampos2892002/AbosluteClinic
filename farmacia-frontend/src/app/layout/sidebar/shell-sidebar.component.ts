// layout/shell/sidebar/shell-sidebar.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { NgIf } from '@angular/common';

import { AuthService } from '../../core/auth/auth.service';
import { LoadingComponent } from '../../shared/ui/loading/loading.component';

@Component({
  selector: 'app-shell-sidebar',
  standalone: true,
  imports: [RouterModule, NgIf, LoadingComponent],
  templateUrl: './shell-sidebar.component.html',
  styleUrls: ['./shell-sidebar.component.scss'],
})
export class ShellSidebarComponent {
  @Input() collapsed = true;
  @Output() closeMobile = new EventEmitter<void>();

  // Modal logout
  showLogoutModal = false;
  loggingOut = false;

  constructor(
    public auth: AuthService,
    private router: Router
  ) {}

  get user() {
    return this.auth.getUser();
  }

  isSuperAdmin(): boolean {
    return (this.user?.rol ?? '') === 'SUPER_ADMIN';
  }

  canSeePacientes(): boolean {
    const r = this.user?.rol ?? '';
    return r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'ESPECIALISTA';
  }

  canSeeServicios(): boolean {
    const r = this.user?.rol ?? '';
    return r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'ESPECIALISTA';
  }

  closeIfMobile(): void {
    if (window.innerWidth <= 720) this.closeMobile.emit();
  }

  // ===== Logout modal =====
  openLogoutModal(): void {
    this.showLogoutModal = true;
    this.loggingOut = false;
  }

  cancelLogout(): void {
    if (this.loggingOut) return;
    this.showLogoutModal = false;
  }

  confirmLogout(): void {
    this.loggingOut = true;

    setTimeout(() => {
      this.auth.logout();
      this.showLogoutModal = false;
      this.router.navigate(['/login'], { replaceUrl: true });
    }, 450);
  }
}

// layout/shell/shell.component.ts
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule, ChildrenOutletContexts, RouterOutlet } from '@angular/router';
import { NgIf } from '@angular/common';

import { AuthService } from '../../core/auth/auth.service';

import { ShellSidebarComponent } from '../sidebar/shell-sidebar.component';
import { ShellTopbarComponent } from '../topbar/shell-topbar.component';

import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterModule,
    RouterOutlet,
    NgIf,
    ShellSidebarComponent,
    ShellTopbarComponent
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
  animations: [
    trigger('routeAnim', [
      transition('* <=> *', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('220ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ])
  ]
})
export class ShellComponent implements OnInit {
  collapsed = true;

  constructor(
    public auth: AuthService,
    private router: Router,
    private contexts: ChildrenOutletContexts
  ) {}

  ngOnInit(): void {
    // Cargar usuario (una sola vez desde el layout)
    if (this.auth.hasToken()) {
      this.auth.refreshUserFromMe().subscribe({
        error: () => {
          this.auth.logout();
          this.router.navigate(['/login']);
        }
      });
    }

    // En móvil inicia cerrado
    if (window.innerWidth <= 720) {
      this.collapsed = true;
    }
  }

  toggleSidebar(): void {
    this.collapsed = !this.collapsed;
  }

  closeSidebarOnMobile(): void {
    if (window.innerWidth <= 720) {
      this.collapsed = true;
    }
  }

  getRouteKey(): string {
    return this.contexts.getContext('primary')?.route?.snapshot?.url?.join('/') || '';
  }
}

import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './forbidden.component.html',
})
export class ForbiddenComponent {
  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  goHome(): void {
    const rol = this.auth.getRole();
    if (rol === 'CAJA')                          this.router.navigate(['/caja']);
    else if (rol === 'ESPECIALISTA' || rol === 'SECRETARIA') this.router.navigate(['/citas']);
    else                                          this.router.navigate(['/dashboard']);
  }
}
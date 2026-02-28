import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'loading.component.html',
  styleUrls: ['loading.component.scss']
})
export class LoadingComponent {
  /** Modo pantalla completa (overlay) */
  @Input() fullscreen = false;

  /** Texto opcional debajo */
  @Input() text = 'Cargando...';

  /** Tamaño del spinner en px (ancho/alto) */
  @Input() size = 120;

  /** Grosor del borde del spinner en px */
  @Input() stroke = 10;

  /** Logo (ruta en assets) */
  @Input() logoSrc = 'assets/brand/absolute-logo.png';

  /** Si tu logo tiene fondo negro/oscuro, prueba a activar esto */
  @Input() logoDarkFilter = false;
}

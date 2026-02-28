import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiToastHostComponent } from './shared/ui/toast/ui-toast-host.component';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UiToastHostComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {}

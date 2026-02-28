import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { UiToastService } from './ui-toast.service';

@Component({
  selector: 'ui-toast-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="toast"
      *ngIf="(toast.state$ | async) as t"
      [class.open]="t.open"
      [class.success]="t.type==='success'"
      [class.error]="t.type==='error'"
      [class.info]="t.type==='info'"
      [class.warning]="t.type==='warning'"
      (click)="toast.close()"
    >
      <div class="icon">
        <span *ngIf="t.type==='success'">✓</span>
        <span *ngIf="t.type==='error'">!</span>
        <span *ngIf="t.type==='info'">i</span>
        <span *ngIf="t.type==='warning'">!</span>
      </div>
      <div class="msg">{{ t.message }}</div>
      <button class="x" type="button" (click)="toast.close(); $event.stopPropagation()">✕</button>
    </div>
  `,
  styles: [`
    .toast{
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 9999;
      min-width: 280px;
      max-width: min(520px, calc(100vw - 24px));
      padding: 12px 12px;
      border-radius: 14px;
      background: rgba(255,255,255,.95);
      border: 1px solid rgba(15,23,42,.10);
      box-shadow: 0 18px 38px rgba(2,6,23,.14);
      display: grid;
      grid-template-columns: 28px 1fr 34px;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      transform: translateY(10px);
      opacity: 0;
      pointer-events: none;
      transition: .16s ease;
      cursor: pointer;
    }
    .toast.open{
      transform: translateY(0);
      opacity: 1;
      pointer-events: auto;
    }
    .icon{
      width: 28px; height: 28px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      font-weight: 900;
      background: rgba(2,6,23,.06);
      color: rgba(15,23,42,.85);
    }
    .msg{
      color: rgba(15,23,42,.88);
      line-height: 1.25;
      font-size: 13px;
    }
    .x{
      width: 34px; height: 34px;
      border-radius: 12px;
      border: 1px solid rgba(15,23,42,.10);
      background: rgba(255,255,255,.9);
      cursor: pointer;
      font-weight: 900;
    }

    .toast.success{ border-color: rgba(34,197,94,.30); }
    .toast.success .icon{ background: rgba(34,197,94,.12); color: rgba(22,163,74,1); }

    .toast.error{ border-color: rgba(239,68,68,.30); }
    .toast.error .icon{ background: rgba(239,68,68,.12); color: rgba(220,38,38,1); }

    .toast.info{ border-color: rgba(59,130,246,.28); }
    .toast.info .icon{ background: rgba(59,130,246,.12); color: rgba(37,99,235,1); }

    .toast.warning{ border-color: rgba(245,158,11,.30); }
    .toast.warning .icon{ background: rgba(245,158,11,.16); color: rgba(180,83,9,1); }
  `]
})
export class UiToastHostComponent {
  toast = inject(UiToastService);
}

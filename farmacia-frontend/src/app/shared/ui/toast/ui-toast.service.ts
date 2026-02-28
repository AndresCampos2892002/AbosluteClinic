import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastState {
  open: boolean;
  type: ToastType;
  message: string;
  durationMs: number;
}

const initialState: ToastState = {
  open: false,
  type: 'info',
  message: '',
  durationMs: 2500
};

@Injectable({ providedIn: 'root' })
export class UiToastService {
  private readonly _state$ = new BehaviorSubject<ToastState>(initialState);
  readonly state$ = this._state$.asObservable();

  private timer: any = null;

  show(message: string, type: ToastType = 'info', durationMs = 2500) {
    if (this.timer) clearTimeout(this.timer);

    this._state$.next({ open: true, type, message, durationMs });

    this.timer = setTimeout(() => {
      this.close();
    }, durationMs);
  }

  success(message: string, durationMs = 3200) {
    this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs = 4500) {
    this.show(message, 'error', durationMs);
  }

  info(message: string, durationMs = 3500) {
    this.show(message, 'info', durationMs);
  }

  warning(message: string, durationMs = 4000) {
    this.show(message, 'warning', durationMs);
  }

  close() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this._state$.next({ ...this._state$.value, open: false });
  }
}

import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = '2fa_enabled';

@Injectable({ providedIn: 'root' })
export class TwoFaStatusService {
  private readonly _enabled = signal(localStorage.getItem(STORAGE_KEY) === 'true');
  readonly enabled = this._enabled.asReadonly();

  setEnabled(v: boolean): void {
    if (v) {
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    this._enabled.set(v);
  }

  clearStatus(): void {
    localStorage.removeItem(STORAGE_KEY);
    this._enabled.set(false);
  }
}

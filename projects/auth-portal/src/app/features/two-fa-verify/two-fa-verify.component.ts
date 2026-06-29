import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError, AuthService, ErrorAlertComponent, TwoFaService, TwoFaStatusService } from '@shared';

@Component({
  selector: 'auth-two-fa-verify',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule, TranslatePipe, ErrorAlertComponent],
  templateUrl: './two-fa-verify.component.html',
})
export class TwoFaVerifyComponent {
  private readonly twoFa = inject(TwoFaService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly twoFaStatus = inject(TwoFaStatusService);

  private readonly pendingToken: string;
  private readonly redirectTo: string | null;

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = inject(FormBuilder).group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  constructor() {
    const state = history.state as { pendingToken?: string; redirectTo?: string | null };
    if (!state?.pendingToken) {
      this.router.navigate(['/login']);
      this.pendingToken = '';
      this.redirectTo = null;
      return;
    }
    this.pendingToken = state.pendingToken;
    this.redirectTo = state.redirectTo ?? null;
  }

  onSubmit(): void {
    if (this.loading() || this.form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    const { code } = this.form.value;
    this.twoFa.verify({ pendingToken: this.pendingToken, code: code! }).subscribe({
      next: (result) => {
        this.auth.setCurrentUser(result);
        this.twoFaStatus.setEnabled(true);
        const redirectTo = this.chooseRedirect(result.redirectTo, this.redirectTo);
        if (redirectTo) {
          window.location.href = redirectTo;
        } else {
          this.router.navigate(['/account']);
        }
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        if (err.errorId === 'error.2fa.invalid-token') {
          this.router.navigate(['/login']);
        } else {
          this.errorMessage.set(
            err.errorId === 'error.2fa.invalid-code'
              ? 'twoFa.verify.error.invalidCode'
              : 'twoFa.verify.error.default'
          );
          this.form.patchValue({ code: '' });
        }
      },
    });
  }

  private chooseRedirect(...candidates: Array<string | null | undefined>): string | null {
    for (const candidate of candidates) {
      if (candidate && this.isAllowedRedirect(candidate)) return candidate;
    }
    return null;
  }

  private isAllowedRedirect(value: string): boolean {
    if (value.startsWith('/')) return true;
    try {
      const url = new URL(value);
      return url.origin === window.location.origin && url.pathname.startsWith('/oauth2/authorize');
    } catch {
      return false;
    }
  }
}

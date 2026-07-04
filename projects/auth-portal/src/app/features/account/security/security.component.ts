import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import {
  AccountService, ApiError, ErrorAlertComponent,
  TwoFaService, TwoFaStatusService,
} from '@shared';

@Component({
  selector: 'auth-security',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    ErrorAlertComponent,
    QRCodeComponent,
  ],
  templateUrl: './security.component.html',
})
export class SecurityComponent {
  private readonly account = inject(AccountService);
  private readonly twoFa = inject(TwoFaService);
  readonly twoFaStatus = inject(TwoFaStatusService);

  private readonly fb = inject(FormBuilder);

  // ── Change password ───────────────────────────────────────────
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly form = this.fb.group({
    oldPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(16)]],
    confirmPassword: ['', [Validators.required]],
  }, {
    validators: (group) => {
      const np = group.get('newPassword')?.value;
      const cp = group.get('confirmPassword')?.value;
      return cp && np !== cp ? { passwordsMismatch: true } : null;
    },
  });

  // ── 2FA enable flow ───────────────────────────────────────────
  readonly twoFaSetupUri = signal<string | null>(null);
  readonly twoFaSetupLoading = signal(false);
  readonly twoFaSetupError = signal<string | null>(null);
  readonly twoFaSuccessMessage = signal<string | null>(null);

  readonly setupForm = this.fb.group({
    confirmCode: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  // ── 2FA disable flow ──────────────────────────────────────────
  readonly showDisableForm = signal(false);
  readonly twoFaDisableLoading = signal(false);
  readonly twoFaDisableError = signal<string | null>(null);

  readonly disableForm = this.fb.group({
    password: ['', [Validators.required]],
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  // ── Change password ───────────────────────────────────────────
  onManageSessions(): void {
    console.warn('not implemented: manage sessions');
  }

  onSubmit(): void {
    if (this.loading() || this.form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { oldPassword, newPassword } = this.form.value;
    this.account.changePassword({ oldPassword: oldPassword!, newPassword: newPassword! }).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set('security.success');
        this.form.reset();
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.errorId === 'error.user.wrong-password'
            ? 'security.error.wrongPassword'
            : 'security.error.default',
        );
      },
    });
  }

  // ── 2FA enable flow ───────────────────────────────────────────
  onSetup2Fa(): void {
    this.twoFaSetupLoading.set(true);
    this.twoFaSetupError.set(null);
    this.twoFaSuccessMessage.set(null);
    this.twoFaSetupUri.set(null);
    this.twoFa.setup().subscribe({
      next: (res) => {
        this.twoFaSetupLoading.set(false);
        this.twoFaSetupUri.set(res.otpAuthUri);
      },
      error: () => {
        this.twoFaSetupLoading.set(false);
        this.twoFaSetupError.set('twoFa.setup.error.default');
      },
    });
  }

  onConfirm2Fa(): void {
    if (this.twoFaSetupLoading() || this.setupForm.invalid) return;
    this.twoFaSetupLoading.set(true);
    this.twoFaSetupError.set(null);
    const { confirmCode } = this.setupForm.value;
    this.twoFa.confirm({ code: confirmCode! }).subscribe({
      next: () => {
        this.twoFaSetupLoading.set(false);
        this.twoFaStatus.setEnabled(true);
        this.twoFaSetupUri.set(null);
        this.setupForm.reset();
        this.twoFaSuccessMessage.set('twoFa.setup.success.enabled');
      },
      error: (err: ApiError) => {
        this.twoFaSetupLoading.set(false);
        this.twoFaSetupError.set(
          err.errorId === 'error.2fa.invalid-code'
            ? 'twoFa.setup.error.invalidCode'
            : 'twoFa.setup.error.default',
        );
      },
    });
  }

  // ── 2FA disable flow ──────────────────────────────────────────
  onToggleDisableForm(): void {
    this.showDisableForm.update(v => !v);
    this.twoFaDisableError.set(null);
    this.disableForm.reset();
  }

  onDisable2Fa(): void {
    if (this.twoFaDisableLoading() || this.disableForm.invalid) return;
    this.twoFaDisableLoading.set(true);
    this.twoFaDisableError.set(null);
    const { password, code } = this.disableForm.value;
    this.twoFa.disable({ password: password!, code: code! }).subscribe({
      next: () => {
        this.twoFaDisableLoading.set(false);
        this.twoFaStatus.setEnabled(false);
        this.showDisableForm.set(false);
        this.disableForm.reset();
        this.twoFaSuccessMessage.set('twoFa.setup.success.disabled');
      },
      error: (err: ApiError) => {
        this.twoFaDisableLoading.set(false);
        this.twoFaDisableError.set(
          err.errorId === 'error.user.wrong-password'
            ? 'twoFa.setup.error.wrongPassword'
            : err.errorId === 'error.2fa.invalid-code'
              ? 'twoFa.setup.error.invalidCode'
              : 'twoFa.setup.error.default',
        );
      },
    });
  }
}

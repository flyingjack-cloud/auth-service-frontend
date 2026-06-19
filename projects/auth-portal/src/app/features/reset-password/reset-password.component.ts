import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { interval, take } from 'rxjs';
import { AccountService, ApiError, ErrorAlertComponent } from '@shared';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pw && confirm && pw !== confirm ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'auth-reset-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    ErrorAlertComponent,
  ],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly codeSending = signal(false);
  readonly codeCountdown = signal(0);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly codeSent = signal(false);

  readonly canSendCode = computed(() => this.codeCountdown() === 0 && !this.codeSending());

  readonly form = inject(FormBuilder).group(
    {
      principal: ['', [Validators.required]],
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(16)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  get principalControl(): FormControl {
    return this.form.get('principal') as FormControl;
  }

  get resetType(): 'email' | 'phone' {
    return (this.form.value.principal ?? '').includes('@') ? 'email' : 'phone';
  }

  get passwordsMatch(): boolean {
    const pw = this.form.value.password;
    const confirm = this.form.value.confirmPassword;
    return !!(pw && confirm && pw === confirm);
  }

  get passwordsMismatch(): boolean {
    const pw = this.form.value.password;
    const confirm = this.form.value.confirmPassword;
    return !!(pw && confirm && pw !== confirm);
  }

  sendCode(): void {
    const principal = this.form.value.principal;
    if (!principal || !this.canSendCode()) return;

    this.codeSending.set(true);
    this.account.sendVerificationCode(this.resetType, principal).subscribe({
      next: () => {
        this.codeSending.set(false);
        this.codeSent.set(true);
        this.startCountdown();
      },
      error: () => {
        this.codeSending.set(false);
        this.errorMessage.set('reset.error.sendFailed');
      },
    });
  }

  onSubmit(): void {
    if (this.loading() || this.form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    const { principal, code, password } = this.form.value;
    this.account
      .resetPassword({ registerType: this.resetType, principal: principal!, password: password!, code: code! })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.successMessage.set('reset.success');
          setTimeout(() => this.router.navigate(['/login']), 2000);
        },
        error: (err: ApiError) => {
          this.loading.set(false);
          const map: Record<string, string> = {
            'error.common.param.invalid': 'reset.error.invalidCode',
            'error.user.not-found': 'reset.error.notFound',
          };
          this.errorMessage.set(map[err.errorId] ?? 'reset.error.default');
        },
      });
  }

  private startCountdown(): void {
    this.codeCountdown.set(60);
    interval(1000)
      .pipe(take(60), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.codeCountdown.update(s => Math.max(0, s - 1)));
  }
}

import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AccountService, ApiError, CodeCaptchaFieldComponent, ErrorAlertComponent } from '@shared';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pw && confirm && pw !== confirm ? { passwordMismatch: true } : null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{11}$/;

function principalType(value: string | null | undefined): 'email' | 'phone' | null {
  const v = (value ?? '').trim();
  if (EMAIL_PATTERN.test(v)) return 'email';
  if (PHONE_PATTERN.test(v)) return 'phone';
  return null;
}

const emailOrPhoneValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as string | null | undefined;
  if (!value) return null;
  return principalType(value) ? null : { emailOrPhone: true };
};

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
    CodeCaptchaFieldComponent,
  ],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly form = inject(FormBuilder).group(
    {
      principal: ['', [Validators.required, emailOrPhoneValidator]],
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(16)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  get principalControl(): FormControl {
    return this.form.get('principal') as FormControl;
  }

  get codeControl(): FormControl {
    return this.form.get('code') as FormControl;
  }

  get resetType(): 'email' | 'phone' {
    return principalType(this.form.value.principal) ?? 'phone';
  }

  get captchaPrincipal(): string {
    return principalType(this.form.value.principal) ? (this.form.value.principal ?? '').trim() : '';
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
}

import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AccountService, ApiError, CodeCaptchaFieldComponent, ErrorAlertComponent } from '@shared';

@Component({
  selector: 'auth-register',
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
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  readonly registerType = signal<'phone' | 'email'>('email');
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = inject(FormBuilder).group({
    principal: ['', [Validators.required]],
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9]{5,15}$/)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(16)]],
  });

  constructor() {
    this.form.get('principal')!.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(v => { if (v) this.checkPrincipal(v); });

    this.form.get('username')!.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(v => { if (v && /^[a-z0-9]{5,15}$/.test(v)) this.checkUsername(v); });
  }

  get principalControl(): FormControl {
    return this.form.get('principal') as FormControl;
  }

  get usernameControl(): FormControl {
    return this.form.get('username') as FormControl;
  }

  get codeControl(): FormControl {
    return this.form.get('code') as FormControl;
  }

  switchMode(): void {
    this.registerType.update(t => t === 'email' ? 'phone' : 'email');
    this.form.patchValue({ principal: '' });
    this.errorMessage.set(null);
  }

  onPhoneSelector(): void {
    console.warn('not implemented: phone country selector');
  }

  onSocialLogin(_provider: string): void {
    this.snackBar.open(this.translate.instant('profile.notAvailable'), '', { duration: 2500 });
  }

  onSubmit(): void {
    if (this.loading() || this.form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    const { principal, code, username, password } = this.form.value;
    this.account
      .register({ registerType: this.registerType(), principal: principal!, password: password!, code: code! })
      .subscribe({
        next: () => this.router.navigate(['/login']),
        error: (err: ApiError) => {
          this.loading.set(false);
          const map: Record<string, string> = {
            'error.business.conflict': 'register.error.conflict',
            'error.common.param.invalid': 'register.error.invalidCode',
          };
          this.errorMessage.set(map[err.errorId] ?? 'register.error.default');
        },
      });
  }

  private checkPrincipal(value: string): void {
    const check$ = this.registerType() === 'email'
      ? this.account.checkEmail(value)
      : this.account.checkPhone(value);
    check$.subscribe({ next: taken => { if (taken) this.principalControl.setErrors({ taken: true }); } });
  }

  private checkUsername(value: string): void {
    this.account.checkUsername(value).subscribe({
      next: taken => { if (taken) this.usernameControl.setErrors({ taken: true }); },
    });
  }
}

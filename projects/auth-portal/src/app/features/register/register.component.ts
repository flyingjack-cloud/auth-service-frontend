import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged, interval, take } from 'rxjs';
import { AccountService, ApiError, ErrorAlertComponent } from '@shared';

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
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly registerType = signal<'phone' | 'email'>('email');
  readonly loading = signal(false);
  readonly codeSending = signal(false);
  readonly codeCountdown = signal(0);
  readonly errorMessage = signal<string | null>(null);

  readonly canSendCode = computed(
    () => this.codeCountdown() === 0 && !this.codeSending(),
  );

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

  switchMode(): void {
    this.registerType.update(t => t === 'email' ? 'phone' : 'email');
    this.form.patchValue({ principal: '' });
    this.errorMessage.set(null);
  }

  onPhoneSelector(): void {
    console.warn('not implemented: phone country selector');
  }

  onSocialLogin(provider: string): void {
    console.warn(`not implemented: social login (${provider})`);
  }

  sendCode(): void {
    const principal = this.form.value.principal;
    if (!principal || !this.canSendCode()) return;

    this.codeSending.set(true);
    this.account.sendVerificationCode(this.registerType(), principal).subscribe({
      next: () => { this.codeSending.set(false); this.startCountdown(); },
      error: () => {
        this.codeSending.set(false);
        this.errorMessage.set('register.error.sendFailed');
      },
    });
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

  private startCountdown(): void {
    this.codeCountdown.set(60);
    interval(1000)
      .pipe(take(60), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.codeCountdown.update(s => Math.max(0, s - 1)));
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

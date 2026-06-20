import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { interval, take } from 'rxjs';
import { ApiError, AuthService, ErrorAlertComponent, ImageCaptchaFieldComponent } from '@shared';

@Component({
  selector: 'auth-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    ErrorAlertComponent,
    ImageCaptchaFieldComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly loginType = signal<'username' | 'phone' | 'email'>('username');
  readonly failCount = signal(0);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly cooldownSeconds = signal(0);
  readonly captchaUuid = signal('');

  readonly showCaptcha = computed(() => this.failCount() >= 3 && this.failCount() < 10);
  readonly showCooldown = computed(() => this.failCount() >= 10);

  readonly cooldownDisplay = computed(() => {
    const s = this.cooldownSeconds();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  });

  readonly principalInputType = computed(() => {
    if (this.loginType() === 'email') return 'email';
    if (this.loginType() === 'phone') return 'tel';
    return 'text';
  });

  readonly altMethods = computed(() => {
    const all = ['username', 'phone', 'email'] as const;
    return all.filter(m => m !== this.loginType());
  });

  readonly form = inject(FormBuilder).group({
    principal: ['', [Validators.required]],
    password: ['', [Validators.required]],
    captchaToken: [''],
  });

  get captchaControl(): FormControl {
    return this.form.get('captchaToken') as FormControl;
  }

  setMethod(method: 'username' | 'phone' | 'email'): void {
    this.loginType.set(method);
    this.form.patchValue({ principal: '', captchaToken: '' });
    this.errorMessage.set(null);
  }

  onPhoneSelector(): void {
    console.warn('not implemented: phone country selector');
  }

  onSocialLogin(provider: string): void {
    console.warn(`not implemented: social login (${provider})`);
  }

  onSubmit(): void {
    if (this.loading() || this.form.invalid || this.showCooldown()) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const { principal, password, captchaToken } = this.form.value;
    const captcha =
      this.showCaptcha() && principal
        ? { id: this.captchaUuid(), token: captchaToken ?? '' }
        : undefined;

    this.auth
      .login({ loginType: this.loginType(), principal: principal!, password: password! }, captcha)
      .subscribe({
        next: () => {
          const redirectUri = this.route.snapshot.queryParams['redirect_uri'];
          if (redirectUri) {
            window.location.href = redirectUri;
          } else {
            this.router.navigate(['/account']);
          }
        },
        error: (err: ApiError) => {
          this.loading.set(false);
          this.failCount.update(c => c + 1);
          if (this.failCount() >= 10) this.startCooldown();
          this.form.patchValue({ captchaToken: '' });
          this.errorMessage.set(this.mapError(err.errorId, err.httpStatus));
        },
      });
  }

  private startCooldown(): void {
    this.cooldownSeconds.set(600);
    interval(1000)
      .pipe(take(600), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.cooldownSeconds.update(s => Math.max(0, s - 1));
        if (this.cooldownSeconds() === 0) this.failCount.set(0);
      });
  }

  private mapError(errorId: string, httpStatus: number): string {
    const map: Record<string, string> = {
      'error.security.authenticated.bad-credential': 'login.error.badCredential',
      'error.security.authenticated.invalid-account': 'login.error.invalidAccount',
      'error.security.authenticated.expired-credential': 'login.error.expiredCredential',
      'error.common.param.miss-captcha': 'login.error.missCaptcha',
      'error.security.authenticated.authenticated.over-attempt': 'login.error.overAttempt',
    };
    if (map[errorId]) return map[errorId];
    if (httpStatus === 401) return 'login.error.badCredential';
    return 'login.error.default';
  }
}

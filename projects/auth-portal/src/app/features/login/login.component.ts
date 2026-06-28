import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  constructor() {
    const registry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    registry.addSvgIconLiteral('google', sanitizer.bypassSecurityTrustHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`
    ));
    registry.addSvgIconLiteral('github', sanitizer.bypassSecurityTrustHtml(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" fill="currentColor"/></svg>`
    ));
  }

  readonly loginType = signal<'username' | 'phone' | 'email'>('phone');
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

  methodIcon(method: string): string {
    const icons: Record<string, string> = { phone: 'phone_iphone', email: 'mail', username: 'person' };
    return icons[method] ?? 'login';
  }

  setMethod(method: 'username' | 'phone' | 'email'): void {
    this.loginType.set(method);
    this.form.patchValue({ principal: '', captchaToken: '' });
    this.errorMessage.set(null);
  }

  onPhoneSelector(): void {
    console.warn('not implemented: phone country selector');
  }

  onSocialLogin(_provider: string): void {
    this.snackBar.open(this.translate.instant('profile.notAvailable'), '', { duration: 2500 });
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
        next: (result) => {
          if (result.kind === '2fa') {
            const redirectUri = this.route.snapshot.queryParams['redirect_uri'] as string | undefined;
            this.router.navigate(['/2fa-verify'], {
              state: { pendingToken: result.pendingToken, redirectUri },
            });
          } else {
            const redirectUri = this.route.snapshot.queryParams['redirect_uri'] as string | undefined;
            if (redirectUri) {
              window.location.href = redirectUri;
            } else {
              this.router.navigate(['/account']);
            }
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

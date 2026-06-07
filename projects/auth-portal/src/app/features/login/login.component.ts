import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabChangeEvent, MatTabsModule } from '@angular/material/tabs';
import { interval, take } from 'rxjs';
import {
  ApiError,
  AuthService,
  CaptchaFieldComponent,
  ErrorAlertComponent,
  LoadingButtonComponent,
} from '@shared';

@Component({
  selector: 'auth-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
    LoadingButtonComponent,
    ErrorAlertComponent,
    CaptchaFieldComponent,
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

  readonly showCaptcha = computed(() => this.failCount() >= 3 && this.failCount() < 10);
  readonly showCooldown = computed(() => this.failCount() >= 10);

  readonly cooldownDisplay = computed(() => {
    const s = this.cooldownSeconds();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  });

  readonly principalLabel = computed(() => {
    const labels: Record<string, string> = {
      username: '用户名',
      phone: '手机号',
      email: '邮箱',
    };
    return labels[this.loginType()];
  });

  readonly principalInputType = computed(() => {
    if (this.loginType() === 'email') return 'email';
    if (this.loginType() === 'phone') return 'tel';
    return 'text';
  });

  readonly form = inject(FormBuilder).group({
    principal: ['', [Validators.required]],
    password: ['', [Validators.required]],
    captchaToken: [''],
  });

  get captchaControl(): FormControl {
    return this.form.get('captchaToken') as FormControl;
  }

  onTabChange(event: MatTabChangeEvent): void {
    const types = ['username', 'phone', 'email'] as const;
    this.loginType.set(types[event.index]);
    this.form.patchValue({ principal: '', captchaToken: '' });
    this.errorMessage.set(null);
  }

  onSubmit(): void {
    if (this.loading() || this.form.invalid || this.showCooldown()) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const { principal, password, captchaToken } = this.form.value;
    const captcha =
      this.showCaptcha() && principal
        ? { id: principal, token: captchaToken ?? '' }
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
          if (this.failCount() >= 10) {
            this.startCooldown();
          }
          this.form.patchValue({ captchaToken: '' });
          this.errorMessage.set(this.mapError(err.errorId));
        },
      });
  }

  private startCooldown(): void {
    this.cooldownSeconds.set(600);
    interval(1000)
      .pipe(take(600), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.cooldownSeconds.update(s => Math.max(0, s - 1));
        if (this.cooldownSeconds() === 0) {
          this.failCount.set(0);
        }
      });
  }

  private mapError(errorId: string): string {
    const map: Record<string, string> = {
      'error.security.authenticated.bad-credential': '用户名或密码错误',
      'error.security.authenticated.invalid-account': '账号已被禁用或锁定',
      'error.security.authenticated.expired-credential': '密码已过期，请重置密码',
      'error.common.param.miss-captcha': '验证码错误，请重新输入',
      'error.security.authenticated.authenticated.over-attempt': '登录失败次数过多',
    };
    return map[errorId] ?? '登录失败，请稍后重试';
  }
}

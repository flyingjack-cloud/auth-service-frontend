import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, distinctUntilChanged, interval, take } from 'rxjs';
import { AccountService, ApiError, ErrorAlertComponent, LoadingButtonComponent } from '@shared';

@Component({
  selector: 'auth-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    LoadingButtonComponent,
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
    this.form
      .get('principal')!
      .valueChanges.pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(v => {
        if (v) this.checkPrincipal(v);
      });

    this.form
      .get('username')!
      .valueChanges.pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(v => {
        if (v && /^[a-z0-9]{5,15}$/.test(v)) this.checkUsername(v);
      });
  }

  get principalLabel(): string {
    return this.registerType() === 'email' ? '邮箱' : '手机号';
  }

  get principalControl(): FormControl {
    return this.form.get('principal') as FormControl;
  }

  get usernameControl(): FormControl {
    return this.form.get('username') as FormControl;
  }

  sendCode(): void {
    const principal = this.form.value.principal;
    if (!principal || !this.canSendCode()) return;

    this.codeSending.set(true);
    this.account.sendVerificationCode(this.registerType(), principal).subscribe({
      next: () => {
        this.codeSending.set(false);
        this.startCountdown();
      },
      error: () => {
        this.codeSending.set(false);
        this.errorMessage.set('发送验证码失败，请稍后重试');
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
            'error.business.conflict': '该账号已注册，请直接登录',
            'error.common.param.invalid': '验证码错误，请重试',
          };
          this.errorMessage.set(map[err.errorId] ?? '注册失败，请稍后重试');
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
    const check$ =
      this.registerType() === 'email'
        ? this.account.checkEmail(value)
        : this.account.checkPhone(value);

    check$.subscribe({ next: taken => {
      if (taken) this.principalControl.setErrors({ taken: true });
    }});
  }

  private checkUsername(value: string): void {
    this.account.checkUsername(value).subscribe({ next: taken => {
      if (taken) this.usernameControl.setErrors({ taken: true });
    }});
  }
}

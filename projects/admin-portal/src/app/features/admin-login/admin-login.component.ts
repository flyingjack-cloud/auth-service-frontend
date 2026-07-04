import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EMPTY, switchMap } from 'rxjs';
import { ApiError, AuthService, ErrorAlertComponent, LoadingButtonComponent, TwoFaService, TwoFaStatusService } from '@shared';

@Component({
  selector: 'admin-admin-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    LoadingButtonComponent,
    ErrorAlertComponent,
  ],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss',
})
export class AdminLoginComponent {
  private readonly auth = inject(AuthService);
  private readonly twoFa = inject(TwoFaService);
  private readonly twoFaStatus = inject(TwoFaStatusService);
  private readonly router = inject(Router);

  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly pendingToken = signal<string | null>(null);

  readonly form = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  readonly twoFaForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  onSubmit(): void {
    if (this.loading() || this.form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    const { username, password } = this.form.value;
    this.auth
      .login({ loginType: 'username', principal: username!, password: password! })
      .pipe(
        switchMap(result => {
          if (result.kind === '2fa') {
            this.loading.set(false);
            this.pendingToken.set(result.pendingToken);
            return EMPTY;
          }
          return this.auth.checkAdminAccess();
        })
      )
      .subscribe({
        next: () => this.router.navigate(['/users']),
        error: (err: ApiError) => {
          this.loading.set(false);
          const map: Record<string, string> = {
            'error.security.authenticated.bad-credential': '用户名或密码错误',
            'error.security.authenticated.invalid-account': '账号已被禁用或锁定',
          };
          this.errorMessage.set(map[err.errorId] ?? '登录失败，请稍后重试');
        },
      });
  }

  onVerify2Fa(): void {
    if (this.loading() || this.twoFaForm.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    const { code } = this.twoFaForm.value;
    this.twoFa
      .verify({ pendingToken: this.pendingToken()!, code: code! })
      .pipe(
        switchMap(user => {
          this.auth.setCurrentUser(user);
          this.twoFaStatus.setEnabled(true);
          return this.auth.checkAdminAccess();
        })
      )
      .subscribe({
        next: () => this.router.navigate(['/users']),
        error: (err: ApiError) => {
          this.loading.set(false);
          if (err.errorId === 'error.2fa.invalid-token') {
            this.pendingToken.set(null);
            this.errorMessage.set('验证会话已过期，请重新登录');
          } else {
            this.errorMessage.set('验证码错误，请重试');
            this.twoFaForm.patchValue({ code: '' });
          }
        },
      });
  }

  onCancelTwoFa(): void {
    this.pendingToken.set(null);
    this.errorMessage.set(null);
    this.twoFaForm.reset();
  }
}

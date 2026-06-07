# Auth Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all user-facing pages for auth-portal: login (3-type with captcha/cooldown), register, reset-password, OAuth2 consent, and personal account management (profile + security).

**Architecture:** Standalone components with lazy-loaded routes. `AuthLayoutComponent` (centered card background) wraps the three public pages; `AccountShellComponent` (toolbar + tab nav) wraps profile and security. A local `guestGuard` redirects already-logged-in users away from public auth pages. Login failure count is tracked via Signal: ≥3 failures → show `CaptchaFieldComponent`; ≥10 failures → 10-minute cooldown countdown. All HTTP calls go through `@shared` services (`AuthService`, `AccountService`). Since `POST /account/send-code` is not in API.md, that method is added to `AccountService` as the only shared-library modification.

**Tech Stack:** Angular 20 (Standalone Components), Angular Material, Angular Signals, RxJS (`interval`, `take`, `takeUntilDestroyed`, `debounceTime`, `distinctUntilChanged`, `switchMap`), `@shared` library

> **Note on testing:** Karma requires a browser binary not present in this WSL environment. Component unit tests are skipped; `ng build --configuration development` is the quality gate after each task. Visual/functional testing is done via `ng serve`.

---

## File Map

```
projects/auth-portal/src/app/
  app.ts                                                   MODIFY  (remove scaffold title signal)
  app.html                                                 MODIFY  (replace with <router-outlet />)
  app.routes.ts                                            MODIFY  (wire all routes)
  features/
    auth-layout/
      auth-layout.component.ts                             CREATE
      auth-layout.component.html                           CREATE
      auth-layout.component.scss                           CREATE
    login/
      login.component.ts                                   CREATE
      login.component.html                                 CREATE
      login.component.scss                                 CREATE
    register/
      register.component.ts                                CREATE
      register.component.html                              CREATE
      register.component.scss                              CREATE
    reset-password/
      reset-password.component.ts                          CREATE
      reset-password.component.html                        CREATE
    oauth2-consent/
      oauth2-consent.component.ts                          CREATE
      oauth2-consent.component.html                        CREATE
    account/
      account-shell/
        account-shell.component.ts                         CREATE
        account-shell.component.html                       CREATE
        account-shell.component.scss                       CREATE
      profile/
        profile.component.ts                               CREATE
        profile.component.html                             CREATE
      security/
        security.component.ts                              CREATE
        security.component.html                            CREATE

projects/shared/src/lib/services/
  account.service.ts                                       MODIFY  (add sendVerificationCode)
```

---

## Task 1: Root app cleanup and route wiring

**Files:**
- Modify: `projects/auth-portal/src/app/app.ts`
- Modify: `projects/auth-portal/src/app/app.html`
- Modify: `projects/auth-portal/src/app/app.routes.ts`

- [ ] **Step 1: Simplify app.ts — remove unused scaffold content**

Write `projects/auth-portal/src/app/app.ts`:

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'auth-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}
```

> The scaffold generated a `title` signal and a massive inline template. Replace the whole component with a minimal router host. The template is moved inline (no separate `app.html` needed).

- [ ] **Step 2: Delete app.html and app.scss (now unused)**

```bash
rm projects/auth-portal/src/app/app.html projects/auth-portal/src/app/app.scss
```

- [ ] **Step 3: Wire app.routes.ts**

Write `projects/auth-portal/src/app/app.routes.ts`:

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService, authGuard } from '@shared';

const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? router.createUrlTree(['/account']) : true;
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: '',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth-layout/auth-layout.component').then(m => m.AuthLayoutComponent),
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/login/login.component').then(m => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/register/register.component').then(m => m.RegisterComponent),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./features/reset-password/reset-password.component').then(
            m => m.ResetPasswordComponent,
          ),
      },
    ],
  },
  {
    path: 'oauth2/consent',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/oauth2-consent/oauth2-consent.component').then(
        m => m.OAuth2ConsentComponent,
      ),
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/account-shell/account-shell.component').then(
        m => m.AccountShellComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/account/profile/profile.component').then(m => m.ProfileComponent),
      },
      {
        path: 'security',
        loadComponent: () =>
          import('./features/account/security/security.component').then(m => m.SecurityComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
```

- [ ] **Step 4: Verify build**

```bash
cd /home/flyingjack/code/web/flyingjack-cloud-web/auth-serice-frontend && ng build auth-portal --configuration development 2>&1 | tail -5
```

Expected: `Application bundle generation complete.` — but some `Cannot find module './features/...'` errors are expected here since feature components don't exist yet. The build will fail at this step. **This is acceptable** — proceed to commit and subsequent tasks will resolve the errors.

If the `app.ts` inline template (`<router-outlet />`) causes an "Unexpected token" error, instead keep a separate `app.html` containing only `<router-outlet />` and use `templateUrl: './app.html'` in `app.ts`.

- [ ] **Step 5: Commit**

```bash
git add projects/auth-portal/src/app/app.ts projects/auth-portal/src/app/app.routes.ts
git rm --cached projects/auth-portal/src/app/app.html projects/auth-portal/src/app/app.scss 2>/dev/null || true
git commit -m "feat(auth-portal): wire lazy routes with guestGuard; clean up scaffold root"
```

---

## Task 2: AuthLayoutComponent — public pages shell

**Files:**
- Create: `projects/auth-portal/src/app/features/auth-layout/auth-layout.component.ts`
- Create: `projects/auth-portal/src/app/features/auth-layout/auth-layout.component.html`
- Create: `projects/auth-portal/src/app/features/auth-layout/auth-layout.component.scss`

- [ ] **Step 1: Create directory**

```bash
mkdir -p projects/auth-portal/src/app/features/auth-layout
```

- [ ] **Step 2: Write auth-layout.component.ts**

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'auth-auth-layout',
  standalone: true,
  imports: [RouterOutlet, MatIconModule],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayoutComponent {}
```

- [ ] **Step 3: Write auth-layout.component.html**

```html
<div class="auth-container">
  <div class="auth-brand">
    <mat-icon class="brand-icon">shield</mat-icon>
    <span class="brand-name">flyingjack cloud</span>
  </div>
  <router-outlet />
</div>
```

- [ ] **Step 4: Write auth-layout.component.scss**

```scss
.auth-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--mat-sys-surface-variant, #f3edf7);
  padding: 24px;
  box-sizing: border-box;
}

.auth-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;

  .brand-icon {
    font-size: 32px;
    width: 32px;
    height: 32px;
    color: var(--mat-sys-primary, #6750a4);
  }

  .brand-name {
    font-size: 20px;
    font-weight: 500;
    color: var(--mat-sys-on-surface, #1c1b1f);
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add projects/auth-portal/src/app/features/auth-layout/
git commit -m "feat(auth-portal): add AuthLayoutComponent — centered card shell for public pages"
```

---

## Task 3: LoginComponent

**Files:**
- Create: `projects/auth-portal/src/app/features/login/login.component.ts`
- Create: `projects/auth-portal/src/app/features/login/login.component.html`
- Create: `projects/auth-portal/src/app/features/login/login.component.scss`

Login supports three types (username / phone / email) via `mat-tab-group`. Failure counting via Signal: ≥3 failures → `CaptchaFieldComponent`; ≥10 failures → 10-minute cooldown. The `captchaId` sent in the header is the principal value (phone number or username/email as session key). After successful login, if there is a `redirect_uri` query param, navigate there; otherwise navigate to `/account`.

- [ ] **Step 1: Create directory**

```bash
mkdir -p projects/auth-portal/src/app/features/login
```

- [ ] **Step 2: Write login.component.ts**

```typescript
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
```

- [ ] **Step 3: Write login.component.html**

```html
<mat-card class="login-card">
  <mat-card-header>
    <mat-card-title>登录</mat-card-title>
  </mat-card-header>

  <mat-tab-group (selectedTabChange)="onTabChange($event)" class="login-tabs">
    <mat-tab label="用户名" />
    <mat-tab label="手机号" />
    <mat-tab label="邮箱" />
  </mat-tab-group>

  <mat-card-content>
    <sh-error-alert [message]="errorMessage()" />

    @if (showCooldown()) {
      <div class="cooldown-notice">
        登录尝试次数过多，请 {{ cooldownDisplay() }} 后再试
      </div>
    }

    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ principalLabel() }}</mat-label>
        <input
          matInput
          formControlName="principal"
          [type]="principalInputType()"
          autocomplete="username"
        />
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>密码</mat-label>
        <input matInput formControlName="password" type="password" autocomplete="current-password" />
      </mat-form-field>

      @if (showCaptcha()) {
        <sh-captcha-field
          [control]="captchaControl"
          [captchaId]="form.value.principal ?? ''"
        />
      }

      <sh-loading-button
        [loading]="loading()"
        [disabled]="form.invalid || showCooldown()"
        (clicked)="onSubmit()"
        class="submit-btn"
      >
        登录
      </sh-loading-button>
    </form>

    <div class="auth-links">
      <a routerLink="/register">注册账号</a>
      <a routerLink="/reset-password">忘记密码？</a>
    </div>
  </mat-card-content>
</mat-card>
```

- [ ] **Step 4: Write login.component.scss**

```scss
.login-card {
  width: 100%;
  max-width: 420px;
}

.login-tabs {
  margin: 0 -16px;
}

.full-width {
  width: 100%;
  margin-bottom: 8px;
}

.cooldown-notice {
  padding: 12px 16px;
  border-radius: 4px;
  background: var(--mat-sys-error-container, #fce8e6);
  color: var(--mat-sys-on-error-container, #410e0b);
  font-size: 14px;
  margin-bottom: 16px;
  text-align: center;
}

.submit-btn {
  width: 100%;
  margin-top: 8px;
}

.auth-links {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;

  a {
    font-size: 14px;
    color: var(--mat-sys-primary, #6750a4);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
```

- [ ] **Step 5: Verify build**

```bash
ng build auth-portal --configuration development 2>&1 | tail -5
```

Expected: `Application bundle generation complete.` — register/reset-password/oauth2/account routes will have lazy-load errors until their tasks are done. The build should succeed once all component files referenced in `app.routes.ts` exist. If not all exist yet, build errors for missing modules are expected and will clear task by task.

- [ ] **Step 6: Commit**

```bash
git add projects/auth-portal/src/app/features/login/
git commit -m "feat(auth-portal): add LoginComponent — 3-tab login, captcha, cooldown"
```

---

## Task 4: AccountService.sendVerificationCode + RegisterComponent

**Files:**
- Modify: `projects/shared/src/lib/services/account.service.ts`
- Create: `projects/auth-portal/src/app/features/register/register.component.ts`
- Create: `projects/auth-portal/src/app/features/register/register.component.html`
- Create: `projects/auth-portal/src/app/features/register/register.component.scss`

The `POST /account/send-code` endpoint is not in API.md. It is added here as the only reasonable mechanism for triggering verification code delivery. If the backend uses a different endpoint name, only `AccountService.sendVerificationCode` needs to change.

- [ ] **Step 1: Add sendVerificationCode to AccountService**

Read `projects/shared/src/lib/services/account.service.ts`, then append the method before the closing `}`:

```typescript
  sendVerificationCode(type: 'phone' | 'email', principal: string) {
    return this.http.post<null>('/account/send-code', { type, principal });
  }
```

The complete file after modification:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  User, RegisterRequest, ResetPasswordRequest,
  ChangePasswordRequest, UpdateProfileRequest,
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);

  checkUsername(username: string) {
    return this.http.get<boolean>('/account/check/username', { params: { username } });
  }

  checkEmail(email: string) {
    return this.http.get<boolean>('/account/check/email', { params: { email } });
  }

  checkPhone(phone: string) {
    return this.http.get<boolean>('/account/check/phone', { params: { phone } });
  }

  register(payload: RegisterRequest) {
    return this.http.post<User>('/account/register', payload);
  }

  resetPassword(payload: ResetPasswordRequest) {
    return this.http.post<null>('/account/reset-password', payload);
  }

  getProfile() {
    return this.http.get<User>('/account/profile');
  }

  updateProfile(payload: UpdateProfileRequest) {
    return this.http.put<User>('/account/profile', payload);
  }

  changePassword(payload: ChangePasswordRequest) {
    return this.http.post<null>('/account/change-password', payload);
  }

  sendVerificationCode(type: 'phone' | 'email', principal: string) {
    return this.http.post<null>('/account/send-code', { type, principal });
  }
}
```

Also update `projects/shared/src/public-api.ts` to confirm `AccountService` is already exported (it should be — no change needed).

- [ ] **Step 2: Create register directory**

```bash
mkdir -p projects/auth-portal/src/app/features/register
```

- [ ] **Step 3: Write register.component.ts**

Registration flow: user picks phone or email, enters it, clicks "发送验证码" (60 s cooldown), then fills in username, password, and the received code. Real-time availability checks for principal (phone/email) and username with 500 ms debounce.

```typescript
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
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
```

- [ ] **Step 4: Write register.component.html**

```html
<mat-card class="register-card">
  <mat-card-header>
    <mat-card-title>注册账号</mat-card-title>
  </mat-card-header>

  <mat-card-content>
    <sh-error-alert [message]="errorMessage()" />

    <div class="type-toggle">
      <mat-button-toggle-group [value]="registerType()" (change)="registerType.set($event.value)">
        <mat-button-toggle value="email">邮箱注册</mat-button-toggle>
        <mat-button-toggle value="phone">手机注册</mat-button-toggle>
      </mat-button-toggle-group>
    </div>

    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <div class="code-row">
        <mat-form-field appearance="outline" class="principal-field">
          <mat-label>{{ principalLabel }}</mat-label>
          <input
            matInput
            formControlName="principal"
            [type]="registerType() === 'email' ? 'email' : 'tel'"
          />
          @if (principalControl.hasError('taken')) {
            <mat-error>该{{ principalLabel }}已被注册</mat-error>
          }
        </mat-form-field>

        <button
          mat-stroked-button
          type="button"
          [disabled]="!canSendCode() || principalControl.invalid"
          (click)="sendCode()"
          class="send-code-btn"
        >
          {{ codeCountdown() > 0 ? codeCountdown() + 's' : '发送验证码' }}
        </button>
      </div>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>验证码</mat-label>
        <input matInput formControlName="code" maxlength="6" autocomplete="one-time-code" />
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>用户名（5-15位小写字母或数字）</mat-label>
        <input matInput formControlName="username" autocomplete="username" />
        @if (usernameControl.hasError('taken')) {
          <mat-error>用户名已被占用</mat-error>
        }
        @if (usernameControl.hasError('pattern')) {
          <mat-error>用户名须为5-15位小写字母或数字</mat-error>
        }
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>密码（8-16位）</mat-label>
        <input matInput formControlName="password" type="password" autocomplete="new-password" />
      </mat-form-field>

      <sh-loading-button [loading]="loading()" [disabled]="form.invalid" (clicked)="onSubmit()" class="submit-btn">
        注册
      </sh-loading-button>
    </form>

    <div class="auth-links">
      <a routerLink="/login">已有账号？去登录</a>
    </div>
  </mat-card-content>
</mat-card>
```

- [ ] **Step 5: Write register.component.scss**

```scss
.register-card {
  width: 100%;
  max-width: 480px;
}

.type-toggle {
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
}

.full-width {
  width: 100%;
  margin-bottom: 4px;
}

.code-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 4px;

  .principal-field {
    flex: 1;
  }

  .send-code-btn {
    margin-top: 4px;
    white-space: nowrap;
    min-width: 96px;
  }
}

.submit-btn {
  width: 100%;
  margin-top: 8px;
}

.auth-links {
  margin-top: 16px;
  text-align: center;

  a {
    font-size: 14px;
    color: var(--mat-sys-primary, #6750a4);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
```

- [ ] **Step 6: Build shared to confirm AccountService change compiles**

```bash
ng build shared 2>&1 | tail -3
```

Expected: `✔ Built shared`

- [ ] **Step 7: Commit**

```bash
git add projects/shared/src/lib/services/account.service.ts \
        projects/auth-portal/src/app/features/register/
git commit -m "feat: add sendVerificationCode to AccountService; add RegisterComponent"
```

---

## Task 5: ResetPasswordComponent

**Files:**
- Create: `projects/auth-portal/src/app/features/reset-password/reset-password.component.ts`
- Create: `projects/auth-portal/src/app/features/reset-password/reset-password.component.html`

Same send-code flow as Register but simpler: no username field, just phone/email + code + new password.

- [ ] **Step 1: Create directory**

```bash
mkdir -p projects/auth-portal/src/app/features/reset-password
```

- [ ] **Step 2: Write reset-password.component.ts**

```typescript
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { interval, take } from 'rxjs';
import { AccountService, ApiError, ErrorAlertComponent, LoadingButtonComponent } from '@shared';

@Component({
  selector: 'auth-reset-password',
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
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly resetType = signal<'phone' | 'email'>('email');
  readonly loading = signal(false);
  readonly codeSending = signal(false);
  readonly codeCountdown = signal(0);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly canSendCode = computed(() => this.codeCountdown() === 0 && !this.codeSending());

  readonly form = inject(FormBuilder).group({
    principal: ['', [Validators.required]],
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(16)]],
  });

  get principalLabel(): string {
    return this.resetType() === 'email' ? '邮箱' : '手机号';
  }

  get principalControl(): FormControl {
    return this.form.get('principal') as FormControl;
  }

  sendCode(): void {
    const principal = this.form.value.principal;
    if (!principal || !this.canSendCode()) return;

    this.codeSending.set(true);
    this.account.sendVerificationCode(this.resetType(), principal).subscribe({
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

    const { principal, code, password } = this.form.value;
    this.account
      .resetPassword({ registerType: this.resetType(), principal: principal!, password: password!, code: code! })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.successMessage.set('密码已重置，请使用新密码登录');
          setTimeout(() => this.router.navigate(['/login']), 2000);
        },
        error: (err: ApiError) => {
          this.loading.set(false);
          const map: Record<string, string> = {
            'error.common.param.invalid': '验证码错误，请重试',
            'error.user.not-found': '该账号不存在',
          };
          this.errorMessage.set(map[err.errorId] ?? '重置失败，请稍后重试');
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
```

- [ ] **Step 3: Write reset-password.component.html**

```html
<mat-card class="reset-card">
  <mat-card-header>
    <mat-card-title>找回密码</mat-card-title>
  </mat-card-header>

  <mat-card-content>
    <sh-error-alert [message]="errorMessage()" />

    @if (successMessage()) {
      <div class="success-notice">{{ successMessage() }}</div>
    }

    <div class="type-toggle">
      <mat-button-toggle-group [value]="resetType()" (change)="resetType.set($event.value)">
        <mat-button-toggle value="email">邮箱验证</mat-button-toggle>
        <mat-button-toggle value="phone">手机验证</mat-button-toggle>
      </mat-button-toggle-group>
    </div>

    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <div class="code-row">
        <mat-form-field appearance="outline" class="principal-field">
          <mat-label>{{ principalLabel }}</mat-label>
          <input
            matInput
            formControlName="principal"
            [type]="resetType() === 'email' ? 'email' : 'tel'"
          />
        </mat-form-field>

        <button
          mat-stroked-button
          type="button"
          [disabled]="!canSendCode() || principalControl.invalid"
          (click)="sendCode()"
          class="send-code-btn"
        >
          {{ codeCountdown() > 0 ? codeCountdown() + 's' : '发送验证码' }}
        </button>
      </div>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>验证码</mat-label>
        <input matInput formControlName="code" maxlength="6" autocomplete="one-time-code" />
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>新密码（8-16位）</mat-label>
        <input matInput formControlName="password" type="password" autocomplete="new-password" />
      </mat-form-field>

      <sh-loading-button [loading]="loading()" [disabled]="form.invalid" (clicked)="onSubmit()" class="submit-btn">
        重置密码
      </sh-loading-button>
    </form>

    <div class="auth-links">
      <a routerLink="/login">返回登录</a>
    </div>
  </mat-card-content>
</mat-card>

<style>
  .reset-card { width: 100%; max-width: 480px; }
  .type-toggle { margin-bottom: 20px; display: flex; justify-content: center; }
  .full-width { width: 100%; margin-bottom: 4px; }
  .code-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 4px; }
  .code-row .principal-field { flex: 1; }
  .code-row .send-code-btn { margin-top: 4px; white-space: nowrap; min-width: 96px; }
  .submit-btn { width: 100%; margin-top: 8px; }
  .success-notice {
    padding: 12px 16px; border-radius: 4px; margin-bottom: 16px;
    background: var(--mat-sys-secondary-container, #e8def8);
    color: var(--mat-sys-on-secondary-container, #1d192b);
    font-size: 14px; text-align: center;
  }
  .auth-links { margin-top: 16px; text-align: center; }
  .auth-links a {
    font-size: 14px; color: var(--mat-sys-primary, #6750a4); text-decoration: none;
  }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add projects/auth-portal/src/app/features/reset-password/
git commit -m "feat(auth-portal): add ResetPasswordComponent"
```

---

## Task 6: OAuth2ConsentComponent

**Files:**
- Create: `projects/auth-portal/src/app/features/oauth2-consent/oauth2-consent.component.ts`
- Create: `projects/auth-portal/src/app/features/oauth2-consent/oauth2-consent.component.html`

Reads OAuth2 params from query string, displays the client and scopes, then calls `POST /oauth2/authorize`. On success it receives `{ code: string }` (already unwrapped by `apiInterceptor` from the standard envelope) and redirects to `redirect_uri?code=...&state=...`. On deny, redirects with `error=access_denied`.

Note: the `authGuard` ensures the user is logged in before they see this page.

- [ ] **Step 1: Create directory**

```bash
mkdir -p projects/auth-portal/src/app/features/oauth2-consent
```

- [ ] **Step 2: Write oauth2-consent.component.ts**

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ErrorAlertComponent } from '@shared';

interface AuthorizeResponse {
  code: string;
}

@Component({
  selector: 'auth-oauth2-consent',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
    ErrorAlertComponent,
  ],
  templateUrl: './oauth2-consent.component.html',
})
export class OAuth2ConsentComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  clientId = '';
  redirectUri = '';
  scope = '';
  codeChallenge = '';
  codeChallengeMethod = '';
  state = '';

  get scopeList(): string[] {
    return this.scope.split(/\s+/).filter(Boolean);
  }

  ngOnInit(): void {
    const p = this.route.snapshot.queryParams;
    this.clientId = p['client_id'] ?? '';
    this.redirectUri = p['redirect_uri'] ?? '';
    this.scope = p['scope'] ?? '';
    this.codeChallenge = p['code_challenge'] ?? '';
    this.codeChallengeMethod = p['code_challenge_method'] ?? 'S256';
    this.state = p['state'] ?? '';
  }

  authorize(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const body = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope,
      code_challenge: this.codeChallenge,
      code_challenge_method: this.codeChallengeMethod,
      state: this.state,
    });

    this.http
      .post<AuthorizeResponse>('/oauth2/authorize', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .subscribe({
        next: res => {
          const url = new URL(this.redirectUri);
          url.searchParams.set('code', res.code);
          if (this.state) url.searchParams.set('state', this.state);
          window.location.href = url.toString();
        },
        error: () => {
          this.loading.set(false);
          this.errorMessage.set('授权失败，请稍后重试');
        },
      });
  }

  deny(): void {
    const url = new URL(this.redirectUri);
    url.searchParams.set('error', 'access_denied');
    if (this.state) url.searchParams.set('state', this.state);
    window.location.href = url.toString();
  }
}
```

- [ ] **Step 3: Write oauth2-consent.component.html**

```html
<div class="consent-container">
  <mat-card class="consent-card">
    <mat-card-header>
      <mat-icon mat-card-avatar>apps</mat-icon>
      <mat-card-title>授权请求</mat-card-title>
      <mat-card-subtitle>{{ clientId }}</mat-card-subtitle>
    </mat-card-header>

    <mat-card-content>
      <sh-error-alert [message]="errorMessage()" />

      <p class="consent-intro">
        <strong>{{ clientId }}</strong> 请求访问您的账号，包含以下权限：
      </p>

      <mat-list>
        @for (s of scopeList; track s) {
          <mat-list-item>
            <mat-icon matListItemIcon>check_circle</mat-icon>
            <span matListItemTitle>{{ s }}</span>
          </mat-list-item>
        }
      </mat-list>
    </mat-card-content>

    <mat-card-actions align="end">
      <button mat-stroked-button (click)="deny()" [disabled]="loading()">
        拒绝
      </button>
      <button mat-raised-button color="primary" (click)="authorize()" [disabled]="loading()">
        @if (loading()) {
          <mat-spinner diameter="18" />
        } @else {
          授权
        }
      </button>
    </mat-card-actions>
  </mat-card>
</div>

<style>
  .consent-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--mat-sys-surface-variant, #f3edf7);
  }
  .consent-card { width: 100%; max-width: 420px; }
  .consent-intro { margin: 0 0 8px; font-size: 14px; }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add projects/auth-portal/src/app/features/oauth2-consent/
git commit -m "feat(auth-portal): add OAuth2ConsentComponent"
```

---

## Task 7: AccountShellComponent

**Files:**
- Create: `projects/auth-portal/src/app/features/account/account-shell/account-shell.component.ts`
- Create: `projects/auth-portal/src/app/features/account/account-shell/account-shell.component.html`
- Create: `projects/auth-portal/src/app/features/account/account-shell/account-shell.component.scss`

Top toolbar with username + logout button. Tab navigation row linking to `/account/profile` and `/account/security`. Content rendered via `<router-outlet>`.

- [ ] **Step 1: Create directory**

```bash
mkdir -p projects/auth-portal/src/app/features/account/account-shell
```

- [ ] **Step 2: Write account-shell.component.ts**

```typescript
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '@shared';

@Component({
  selector: 'auth-account-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatToolbarModule,
  ],
  templateUrl: './account-shell.component.html',
  styleUrl: './account-shell.component.scss',
})
export class AccountShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.auth.currentUser;

  logout(): void {
    this.auth.logout().subscribe(() => this.router.navigate(['/login']));
  }
}
```

- [ ] **Step 3: Write account-shell.component.html**

```html
<mat-toolbar color="primary" class="shell-toolbar">
  <mat-icon class="toolbar-logo">shield</mat-icon>
  <span class="toolbar-title">个人中心</span>
  <span class="spacer"></span>
  <span class="toolbar-username">{{ currentUser()?.username }}</span>
  <button mat-icon-button (click)="logout()" aria-label="退出登录">
    <mat-icon>logout</mat-icon>
  </button>
</mat-toolbar>

<nav mat-tab-nav-bar [tabPanel]="tabPanel" class="account-nav">
  <a
    mat-tab-link
    routerLink="/account/profile"
    routerLinkActive
    #rlaProfile="routerLinkActive"
    [active]="rlaProfile.isActive"
  >
    个人资料
  </a>
  <a
    mat-tab-link
    routerLink="/account/security"
    routerLinkActive
    #rlaSecurity="routerLinkActive"
    [active]="rlaSecurity.isActive"
  >
    安全设置
  </a>
</nav>

<mat-tab-nav-panel #tabPanel>
  <div class="account-content">
    <router-outlet />
  </div>
</mat-tab-nav-panel>
```

- [ ] **Step 4: Write account-shell.component.scss**

```scss
.shell-toolbar {
  position: sticky;
  top: 0;
  z-index: 100;

  .toolbar-logo {
    margin-right: 8px;
  }

  .toolbar-title {
    font-size: 18px;
  }

  .spacer {
    flex: 1;
  }

  .toolbar-username {
    font-size: 14px;
    margin-right: 8px;
    opacity: 0.9;
  }
}

.account-nav {
  background: var(--mat-sys-surface, #fff);
}

.account-content {
  max-width: 720px;
  margin: 32px auto;
  padding: 0 24px;
}
```

- [ ] **Step 5: Commit**

```bash
git add projects/auth-portal/src/app/features/account/account-shell/
git commit -m "feat(auth-portal): add AccountShellComponent — toolbar + tab nav"
```

---

## Task 8: ProfileComponent

**Files:**
- Create: `projects/auth-portal/src/app/features/account/profile/profile.component.ts`
- Create: `projects/auth-portal/src/app/features/account/profile/profile.component.html`

Displays current user info. "修改用户名" button opens an inline edit mode with a form field. On save, calls `PUT /account/profile`. On success, calls `checkLogin()` to refresh the auth state (since `currentUser` is a readonly signal, this is the only way to update it externally).

- [ ] **Step 1: Create directory**

```bash
mkdir -p projects/auth-portal/src/app/features/account/profile
```

- [ ] **Step 2: Write profile.component.ts**

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { switchMap } from 'rxjs';
import { AccountService, ApiError, AuthService, ErrorAlertComponent, LoadingButtonComponent } from '@shared';

@Component({
  selector: 'auth-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    LoadingButtonComponent,
    ErrorAlertComponent,
  ],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);

  readonly user = this.auth.currentUser;
  readonly editing = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = inject(FormBuilder).group({
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9]{5,15}$/)]],
  });

  startEdit(): void {
    this.form.patchValue({ username: this.user()?.username ?? '' });
    this.editing.set(true);
    this.errorMessage.set(null);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  save(): void {
    if (this.loading() || this.form.invalid) return;
    this.loading.set(true);

    this.account
      .updateProfile({ username: this.form.value.username! })
      .pipe(switchMap(() => this.auth.checkLogin()))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.editing.set(false);
        },
        error: (err: ApiError) => {
          this.loading.set(false);
          this.errorMessage.set(
            err.errorId === 'error.business.conflict' ? '用户名已被占用' : '更新失败，请稍后重试',
          );
        },
      });
  }
}
```

- [ ] **Step 3: Write profile.component.html**

```html
<mat-card>
  <mat-card-header>
    <mat-icon mat-card-avatar>account_circle</mat-icon>
    <mat-card-title>个人资料</mat-card-title>
  </mat-card-header>

  <mat-card-content>
    <sh-error-alert [message]="errorMessage()" />

    <div class="info-row">
      <span class="label">用户名</span>
      @if (!editing()) {
        <span class="value">{{ user()?.username }}</span>
        <button mat-icon-button (click)="startEdit()" aria-label="修改用户名">
          <mat-icon>edit</mat-icon>
        </button>
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" class="inline-form">
          <mat-form-field appearance="outline" class="username-field">
            <input matInput formControlName="username" placeholder="5-15位小写字母或数字" />
            @if (form.get('username')?.hasError('pattern')) {
              <mat-error>须为5-15位小写字母或数字</mat-error>
            }
          </mat-form-field>
          <sh-loading-button [loading]="loading()" [disabled]="form.invalid" (clicked)="save()">保存</sh-loading-button>
          <button mat-button type="button" (click)="cancelEdit()">取消</button>
        </form>
      }
    </div>

    <div class="info-row">
      <span class="label">邮箱</span>
      <span class="value">{{ user()?.email ?? '未绑定' }}</span>
    </div>

    <div class="info-row">
      <span class="label">手机号</span>
      <span class="value">{{ user()?.phone ?? '未绑定' }}</span>
    </div>
  </mat-card-content>
</mat-card>

<style>
  mat-card { max-width: 480px; }
  .info-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--mat-sys-outline-variant, #cac4d0);
  }
  .info-row:last-child { border-bottom: none; }
  .label { width: 80px; font-size: 13px; color: var(--mat-sys-on-surface-variant, #49454f); flex-shrink: 0; }
  .value { flex: 1; font-size: 15px; }
  .inline-form { display: flex; align-items: center; gap: 8px; flex: 1; }
  .username-field { flex: 1; }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add projects/auth-portal/src/app/features/account/profile/
git commit -m "feat(auth-portal): add ProfileComponent"
```

---

## Task 9: SecurityComponent + final build

**Files:**
- Create: `projects/auth-portal/src/app/features/account/security/security.component.ts`
- Create: `projects/auth-portal/src/app/features/account/security/security.component.html`

Change-password form. On `401 error.user.wrong-password` response, show specific error. On success, show a success banner.

- [ ] **Step 1: Create directory**

```bash
mkdir -p projects/auth-portal/src/app/features/account/security
```

- [ ] **Step 2: Write security.component.ts**

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AccountService, ApiError, ErrorAlertComponent, LoadingButtonComponent } from '@shared';

@Component({
  selector: 'auth-security',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    LoadingButtonComponent,
    ErrorAlertComponent,
  ],
  templateUrl: './security.component.html',
})
export class SecurityComponent {
  private readonly account = inject(AccountService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly form = inject(FormBuilder).group({
    oldPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(16)]],
  });

  onSubmit(): void {
    if (this.loading() || this.form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { oldPassword, newPassword } = this.form.value;
    this.account.changePassword({ oldPassword: oldPassword!, newPassword: newPassword! }).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set('密码修改成功');
        this.form.reset();
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.errorId === 'error.user.wrong-password'
            ? '旧密码不正确，请重新输入'
            : '修改失败，请稍后重试',
        );
      },
    });
  }
}
```

- [ ] **Step 3: Write security.component.html**

```html
<mat-card>
  <mat-card-header>
    <mat-card-title>修改密码</mat-card-title>
  </mat-card-header>

  <mat-card-content>
    <sh-error-alert [message]="errorMessage()" />

    @if (successMessage()) {
      <div class="success-notice">{{ successMessage() }}</div>
    }

    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>当前密码</mat-label>
        <input matInput formControlName="oldPassword" type="password" autocomplete="current-password" />
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>新密码（8-16位）</mat-label>
        <input matInput formControlName="newPassword" type="password" autocomplete="new-password" />
        @if (form.get('newPassword')?.hasError('minlength')) {
          <mat-error>密码须至少8位</mat-error>
        }
      </mat-form-field>

      <sh-loading-button [loading]="loading()" [disabled]="form.invalid" (clicked)="onSubmit()" class="submit-btn">
        修改密码
      </sh-loading-button>
    </form>
  </mat-card-content>
</mat-card>

<style>
  mat-card { max-width: 480px; }
  .full-width { width: 100%; margin-bottom: 8px; }
  .submit-btn { margin-top: 8px; }
  .success-notice {
    padding: 12px 16px; border-radius: 4px; margin-bottom: 16px;
    background: var(--mat-sys-secondary-container, #e8def8);
    color: var(--mat-sys-on-secondary-container, #1d192b);
    font-size: 14px;
  }
</style>
```

- [ ] **Step 4: Full build — both apps**

```bash
ng build auth-portal --configuration development 2>&1 | tail -5
ng build admin-portal --configuration development 2>&1 | tail -5
```

Expected: Both end with `Application bundle generation complete.` — no errors.

If `auth-portal` fails with `Cannot find module './app.html'` after removing the HTML file in Task 1, the `app.ts` template approach is correct. If `app.ts` references `templateUrl`, update it to use `template: '<router-outlet />'` inline.

- [ ] **Step 5: Commit**

```bash
git add projects/auth-portal/src/app/features/account/security/
git commit -m "feat(auth-portal): add SecurityComponent (change password)"
```

---

## Done

Plan B complete. auth-portal has all pages implemented. Proceed with:

- **Plan C** (`2026-06-07-plan-c-admin-portal.md`) — admin shell layout, user management, client management

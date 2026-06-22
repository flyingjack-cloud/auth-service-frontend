# Auth Portal UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sky-blue Angular Material theme with the minimal indigo design from `ui/` reference mockups, rebuild all auth-portal page templates to match, and add ngx-translate bilingual (zh/en) support.

**Architecture:** Keep Angular Material as the component foundation but completely restyle via token replacement in `styles.scss` and new component templates. Auth-flow pages (login/register/reset-password) use plain HTML elements with custom CSS classes defined in `styles.scss`; account pages keep mat-card. ngx-translate wired at app level via `importProvidersFrom`, a slim `LangService` wraps `TranslateService` and exposes a signal + toggle method.

**Tech Stack:** Angular 20, Angular Material 20, `@ngx-translate/core`, `@ngx-translate/http-loader`, Angular Signals, Reactive Forms.

## Global Constraints

- Primary accent: `#534AB7` indigo — no blue (`#0284c7`) anywhere after Task 2
- Page background: `#F2F2F5` — no aurora gradient
- Card style: `background:#fff; border:0.5px solid #E8E8ED; border-radius:16px` — no glow shadow, no gradient top border
- Input style: `border:0.5px solid #C9C9D1; border-radius:8px; focus-outline:2px solid #534AB7`
- Font: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` — no `Exo 2` / `DM Sans`
- All template strings must use `translate` pipe — no hardcoded Chinese or English
- Non-functional UI elements (social login, phone selector, sessions manage, linked-accounts connect) must call `console.warn('not implemented: <feature>')` on click
- **Never touch** `projects/admin-portal`, `projects/shared/src/lib/services/**`, `projects/shared/src/lib/guards/**`, `projects/shared/src/lib/interceptors/**`
- Build verification command: `ng build --project auth-portal`

---

## File Map

| File | Action |
|---|---|
| `package.json` | Add `@ngx-translate/core`, `@ngx-translate/http-loader` |
| `projects/auth-portal/src/app/lang.service.ts` | **Create** — LangService |
| `projects/auth-portal/src/app/app.config.ts` | Modify — add TranslateModule providers |
| `projects/auth-portal/src/assets/i18n/zh.json` | **Create** |
| `projects/auth-portal/src/assets/i18n/en.json` | **Create** |
| `projects/auth-portal/src/styles.scss` | Full rewrite — tokens + Material theme + shared CSS classes |
| `features/auth-layout/auth-layout.component.{html,scss,ts}` | Rewrite template + SCSS, update TS |
| `features/login/login.component.{html,scss,ts}` | Rewrite template + SCSS, update TS |
| `features/register/register.component.{html,scss,ts}` | Rewrite template + SCSS, update TS |
| `features/reset-password/reset-password.component.{html,scss,ts}` | Rewrite template + SCSS, update TS |
| `features/oauth2-consent/oauth2-consent.component.{html,scss,ts}` | Rewrite template + SCSS, update TS |
| `features/account/account-shell/account-shell.component.{html,scss,ts}` | Rewrite template + SCSS, update TS |
| `features/account/profile/profile.component.{html,ts}` | Rewrite template, update TS |
| `features/account/security/security.component.{html,ts}` | Rewrite template, update TS |

---

### Task 1: Install ngx-translate and create LangService + translation files

**Files:**
- Modify: `package.json` (via npm install)
- Create: `projects/auth-portal/src/app/lang.service.ts`
- Modify: `projects/auth-portal/src/app/app.config.ts`
- Create: `projects/auth-portal/src/assets/i18n/zh.json`
- Create: `projects/auth-portal/src/assets/i18n/en.json`

**Interfaces:**
- Produces: `LangService` with `currentLang: Signal<'zh'|'en'>` and `toggle(): void`, injectable via `inject(LangService)`

- [ ] **Step 1: Install packages**

```bash
cd /home/flyingjack/code/web/flyingjack-cloud-web/auth-serice-frontend
npm install @ngx-translate/core @ngx-translate/http-loader
```

Expected: packages added to `node_modules`, `package.json` updated.

- [ ] **Step 2: Create LangService**

Create `projects/auth-portal/src/app/lang.service.ts`:

```typescript
import { inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class LangService {
  private readonly translate = inject(TranslateService);

  readonly currentLang = signal<'zh' | 'en'>(
    (localStorage.getItem('lang') as 'zh' | 'en') ?? 'zh',
  );

  constructor() {
    this.translate.setDefaultLang('zh');
    this.translate.use(this.currentLang());
  }

  toggle(): void {
    const next = this.currentLang() === 'zh' ? 'en' : 'zh';
    this.currentLang.set(next);
    this.translate.use(next);
    localStorage.setItem('lang', next);
  }
}
```

- [ ] **Step 3: Update app.config.ts**

Replace content of `projects/auth-portal/src/app/app.config.ts`:

```typescript
import {
  ApplicationConfig,
  APP_INITIALIZER,
  importProvidersFrom,
  provideZoneChangeDetection,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { catchError, of } from 'rxjs';
import { routes } from './app.routes';
import { apiInterceptor, ENVIRONMENT, AuthService } from '@shared';
import { environment } from '../environments/environment';

function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

function initAuth(authService: AuthService) {
  return () => authService.checkLogin().pipe(catchError(() => of(null)));
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiInterceptor])),
    provideAnimationsAsync(),
    provideBrowserGlobalErrorListeners(),
    { provide: ENVIRONMENT, useValue: environment },
    { provide: APP_INITIALIZER, useFactory: initAuth, deps: [AuthService], multi: true },
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'zh',
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient],
        },
      }),
    ),
  ],
};
```

- [ ] **Step 4: Create zh.json**

Create directory `projects/auth-portal/src/assets/i18n/` then create `zh.json`:

```json
{
  "common": {
    "brand": "flyingjack cloud",
    "langToggle": "EN"
  },
  "login": {
    "title": "登录",
    "subtitle": {
      "phone": "使用手机号登录",
      "email": "使用邮箱登录",
      "username": "使用用户名登录"
    },
    "label": {
      "phone": "手机号",
      "email": "邮箱",
      "username": "用户名",
      "password": "密码"
    },
    "forgotPassword": "忘记密码？",
    "submit": "登录",
    "orWith": "或使用以下方式登录",
    "altMethod": {
      "phone": "手机号",
      "email": "邮箱",
      "username": "用户名"
    },
    "noAccount": "还没有账号？",
    "createOne": "立即注册",
    "cooldown": "登录尝试次数过多，请 {{time}} 后再试",
    "captcha": "图形验证码",
    "error": {
      "badCredential": "用户名或密码错误",
      "invalidAccount": "账号已被禁用或锁定",
      "expiredCredential": "密码已过期，请重置密码",
      "missCaptcha": "验证码错误，请重新输入",
      "overAttempt": "登录失败次数过多",
      "default": "登录失败，请稍后重试"
    }
  },
  "register": {
    "title": "注册账号",
    "subtitle": {
      "phone": "使用手机号注册",
      "email": "使用邮箱注册"
    },
    "label": {
      "phone": "手机号",
      "email": "邮箱",
      "code": "验证码",
      "username": "用户名",
      "password": "密码"
    },
    "sendCode": "发送验证码",
    "resendCode": "重新发送 {{count}}s",
    "codeHint": "验证码 10 分钟内有效",
    "passwordHint": "8-16 位字符",
    "usernameHint": "5-15 位小写字母或数字",
    "terms": "我同意",
    "termsLink": "服务条款",
    "and": "和",
    "privacyLink": "隐私政策",
    "submit": "验证并创建账号",
    "orWith": "或使用以下方式注册",
    "hasAccount": "已有账号？",
    "signIn": "去登录",
    "error": {
      "conflict": "该账号已注册，请直接登录",
      "invalidCode": "验证码错误，请重试",
      "sendFailed": "发送验证码失败，请稍后重试",
      "taken": "已被注册",
      "usernameTaken": "用户名已被占用",
      "usernamePattern": "须为 5-15 位小写字母或数字",
      "default": "注册失败，请稍后重试"
    }
  },
  "reset": {
    "title": "重置密码",
    "subtitle": "我们将向您的邮箱或手机发送验证码",
    "label": {
      "principal": "邮箱或手机号",
      "code": "验证码",
      "newPassword": "新密码",
      "confirmPassword": "确认新密码"
    },
    "sendCode": "发送验证码",
    "resendCode": "重新发送 {{count}}s",
    "codeHint": "验证码 10 分钟内有效",
    "codeSent": "验证码已发送，请查收",
    "passwordHint": "8-16 位字符",
    "passwordMatch": "密码一致",
    "passwordMismatch": "密码不一致",
    "submit": "重置密码",
    "backToSignIn": "返回登录",
    "success": "密码已重置，请使用新密码登录",
    "error": {
      "invalidCode": "验证码错误，请重试",
      "notFound": "该账号不存在",
      "sendFailed": "发送验证码失败，请稍后重试",
      "default": "重置失败，请稍后重试"
    }
  },
  "consent": {
    "title": "{{clientId}} 请求访问您的账号",
    "signedInAs": "当前登录：{{identifier}}",
    "permissionsIntro": "这将允许 {{clientId}}：",
    "scope": {
      "openid": "查看您的基本资料",
      "profile": "查看您的姓名和头像",
      "email": "查看您的邮箱地址",
      "phone": "查看您的手机号"
    },
    "footer": "继续即表示您将被重定向到 {{clientId}}，您可随时在账号设置中撤销授权。",
    "deny": "取消",
    "allow": "授权",
    "error": {
      "default": "授权失败，请稍后重试"
    }
  },
  "account": {
    "profile": "个人资料",
    "security": "安全设置",
    "logout": "退出登录"
  },
  "profile": {
    "memberSince": "注册于 {{year}}",
    "edit": "编辑",
    "save": "保存",
    "cancel": "取消",
    "notBound": "未绑定",
    "identifiers": {
      "title": "登录凭证",
      "subtitle": "任意已验证凭证均可用于登录",
      "username": "用户名",
      "email": "邮箱",
      "phone": "手机号",
      "change": "修改",
      "verify": "验证"
    },
    "badge": {
      "verified": "已验证",
      "unverified": "未验证"
    },
    "linkedAccounts": {
      "title": "关联账号",
      "notConnected": "未关联",
      "connectedAs": "已关联 {{email}}",
      "connect": "关联",
      "connected": "已关联"
    },
    "error": {
      "conflict": "用户名已被占用",
      "default": "更新失败，请稍后重试"
    }
  },
  "security": {
    "sessions": {
      "label": "活跃会话",
      "description": "2 个设备已登录",
      "manage": "管理"
    },
    "password": {
      "label": "密码",
      "lastChanged": "3 个月前修改过",
      "change": "修改"
    },
    "changePassword": {
      "title": "修改密码",
      "oldPassword": "当前密码",
      "newPassword": "新密码（8-16 位）",
      "submit": "修改密码"
    },
    "success": "密码修改成功",
    "error": {
      "wrongPassword": "旧密码不正确，请重新输入",
      "default": "修改失败，请稍后重试"
    }
  }
}
```

- [ ] **Step 5: Create en.json**

Create `projects/auth-portal/src/assets/i18n/en.json`:

```json
{
  "common": {
    "brand": "flyingjack cloud",
    "langToggle": "中"
  },
  "login": {
    "title": "Sign in",
    "subtitle": {
      "phone": "Sign in with your phone number",
      "email": "Sign in with your email",
      "username": "Sign in with your username"
    },
    "label": {
      "phone": "Phone number",
      "email": "Email",
      "username": "Username",
      "password": "Password"
    },
    "forgotPassword": "Forgot password?",
    "submit": "Sign in",
    "orWith": "or sign in with",
    "altMethod": {
      "phone": "Phone",
      "email": "Email",
      "username": "Username"
    },
    "noAccount": "No account?",
    "createOne": "Create one",
    "cooldown": "Too many attempts. Try again in {{time}}",
    "captcha": "Captcha",
    "error": {
      "badCredential": "Incorrect username or password",
      "invalidAccount": "Account is disabled or locked",
      "expiredCredential": "Password expired, please reset",
      "missCaptcha": "Invalid captcha, please try again",
      "overAttempt": "Too many failed login attempts",
      "default": "Login failed, please try again"
    }
  },
  "register": {
    "title": "Create your account",
    "subtitle": {
      "phone": "Sign up with your phone number",
      "email": "Sign up with your email"
    },
    "label": {
      "phone": "Phone number",
      "email": "Email",
      "code": "Verification code",
      "username": "Username",
      "password": "Password"
    },
    "sendCode": "Send code",
    "resendCode": "Resend {{count}}s",
    "codeHint": "The code expires in 10 minutes",
    "passwordHint": "8–16 characters",
    "usernameHint": "5–15 lowercase letters or numbers",
    "terms": "I agree to the",
    "termsLink": "terms of service",
    "and": "and",
    "privacyLink": "privacy policy",
    "submit": "Verify & create account",
    "orWith": "or sign up with",
    "hasAccount": "Already have an account?",
    "signIn": "Sign in",
    "error": {
      "conflict": "This account is already registered",
      "invalidCode": "Invalid code, please retry",
      "sendFailed": "Failed to send code, please try again",
      "taken": "Already registered",
      "usernameTaken": "Username is already taken",
      "usernamePattern": "5–15 lowercase letters or numbers only",
      "default": "Registration failed, please try again"
    }
  },
  "reset": {
    "title": "Reset your password",
    "subtitle": "We'll send a verification code to your email or phone",
    "label": {
      "principal": "Email or phone number",
      "code": "Verification code",
      "newPassword": "New password",
      "confirmPassword": "Confirm new password"
    },
    "sendCode": "Send code",
    "resendCode": "Resend {{count}}s",
    "codeHint": "The code expires in 10 minutes",
    "codeSent": "Code sent — check your inbox",
    "passwordHint": "8–16 characters",
    "passwordMatch": "Passwords match",
    "passwordMismatch": "Passwords do not match",
    "submit": "Reset password",
    "backToSignIn": "Back to sign in",
    "success": "Password reset. Please sign in with your new password.",
    "error": {
      "invalidCode": "Invalid code, please retry",
      "notFound": "Account not found",
      "sendFailed": "Failed to send code, please try again",
      "default": "Reset failed, please try again"
    }
  },
  "consent": {
    "title": "{{clientId}} wants to access your account",
    "signedInAs": "Signed in as {{identifier}}",
    "permissionsIntro": "This will allow {{clientId}} to:",
    "scope": {
      "openid": "View your basic profile",
      "profile": "View your name and profile picture",
      "email": "View your email address",
      "phone": "View your phone number"
    },
    "footer": "By continuing, you'll be redirected to {{clientId}}. You can revoke access anytime in your account settings.",
    "deny": "Cancel",
    "allow": "Allow",
    "error": {
      "default": "Authorization failed, please try again"
    }
  },
  "account": {
    "profile": "Profile",
    "security": "Security",
    "logout": "Sign out"
  },
  "profile": {
    "memberSince": "Member since {{year}}",
    "edit": "Edit",
    "save": "Save",
    "cancel": "Cancel",
    "notBound": "Not set",
    "identifiers": {
      "title": "Sign-in identifiers",
      "subtitle": "Any verified identifier can be used to sign in",
      "username": "Username",
      "email": "Email",
      "phone": "Phone",
      "change": "Change",
      "verify": "Verify"
    },
    "badge": {
      "verified": "Verified",
      "unverified": "Unverified"
    },
    "linkedAccounts": {
      "title": "Linked accounts",
      "notConnected": "Not connected",
      "connectedAs": "Connected as {{email}}",
      "connect": "Connect",
      "connected": "Connected"
    },
    "error": {
      "conflict": "Username is already taken",
      "default": "Update failed, please try again"
    }
  },
  "security": {
    "sessions": {
      "label": "Active sessions",
      "description": "2 devices signed in",
      "manage": "Manage"
    },
    "password": {
      "label": "Password",
      "lastChanged": "Last changed 3 months ago",
      "change": "Change"
    },
    "changePassword": {
      "title": "Change Password",
      "oldPassword": "Current password",
      "newPassword": "New password (8–16 characters)",
      "submit": "Change password"
    },
    "success": "Password changed successfully",
    "error": {
      "wrongPassword": "Current password is incorrect",
      "default": "Change failed, please try again"
    }
  }
}
```

- [ ] **Step 6: Verify build**

```bash
ng build --project auth-portal 2>&1 | tail -20
```

Expected: build succeeds. If `Cannot find module '@ngx-translate/core'` appears, re-run `npm install`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json \
  projects/auth-portal/src/app/lang.service.ts \
  projects/auth-portal/src/app/app.config.ts \
  projects/auth-portal/src/assets/i18n/
git commit -m "feat(auth-portal): add ngx-translate i18n with zh/en and LangService"
```

---

### Task 2: Rewrite styles.scss — new design tokens + global CSS classes

**Files:**
- Modify: `projects/auth-portal/src/styles.scss`

**Interfaces:**
- Produces: CSS custom properties `--auth-*`, global utility classes `.auth-card`, `.icon-circle`, `.field-label`, `.text-input`, `.country-select`, `.phone-row`, `.btn-primary`, `.btn-alt`, `.btn-outline`, `.send-code-btn`, `.divider`, `.alt-row`, `.info-card`, `.info-row`, `.badge`, `.link`, `.field-hint`, `.field-error`, `.field-success`, `.bottom-link`, `.forgot-row`, `.card-title`, `.card-subtitle`

- [ ] **Step 1: Replace styles.scss**

Replace full content of `projects/auth-portal/src/styles.scss`:

```scss
@use '@angular/material' as mat;

// ── Material theme ──────────────────────────────────────
html {
  @include mat.theme((
    color: (
      primary: mat.$violet-palette,
    ),
    typography: 'system-ui',
    density: 0,
  ));

  --mat-sys-primary: #534AB7;
  --mat-sys-on-primary: #ffffff;
  --mat-sys-primary-container: #EEEDFE;
  --mat-sys-on-primary-container: #3C3489;
  --mat-sys-surface: #ffffff;
  --mat-sys-surface-variant: #F2F2F5;
  --mat-sys-on-surface: #1C1C21;
  --mat-sys-on-surface-variant: #65656E;
  --mat-sys-outline-variant: #E8E8ED;
  --mat-sys-secondary-container: #EEEDFE;
  --mat-sys-on-secondary-container: #3C3489;
}

// ── Design tokens ───────────────────────────────────────
:root {
  --auth-primary:        #534AB7;
  --auth-primary-dark:   #3C3489;
  --auth-primary-bg:     #EEEDFE;
  --auth-page-bg:        #F2F2F5;
  --auth-card-border:    #E8E8ED;
  --auth-input-border:   #C9C9D1;
  --auth-border-mid:     #DCDCE2;
  --auth-text-primary:   #1C1C21;
  --auth-text-secondary: #65656E;
  --auth-text-tertiary:  #94949D;
  --auth-success-bg:     #E1F5EE;
  --auth-success-text:   #0F6E56;
  --auth-warning-bg:     #FCF0DB;
  --auth-warning-text:   #8A5A00;
  --auth-danger-bg:      #FDECEA;
  --auth-danger-text:    #C4314B;
}

// ── Base ────────────────────────────────────────────────
*, *::before, *::after { box-sizing: border-box; }

html, body { height: 100%; margin: 0; }

body {
  color-scheme: light;
  background: var(--auth-page-bg);
  color: var(--auth-text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

// ── Material card override ──────────────────────────────
.mat-mdc-card {
  border-radius: 12px !important;
  box-shadow: none !important;
  border: 0.5px solid var(--auth-card-border) !important;
  background-color: #ffffff !important;

  &::before { display: none; }
}

.mat-mdc-card-title {
  font-weight: 500 !important;
  color: var(--auth-text-primary) !important;
}

// ── Material button overrides ───────────────────────────
.mat-mdc-raised-button.mat-primary {
  background: var(--auth-primary) !important;
  box-shadow: none !important;
  border-radius: 8px !important;
  font-family: inherit !important;
  font-weight: 500 !important;

  &:hover:not(:disabled) { background: var(--auth-primary-dark) !important; }
  &:disabled { background: rgba(83, 74, 183, 0.4) !important; }
}

.mat-mdc-outlined-button,
.mat-mdc-stroked-button {
  border-color: var(--auth-input-border) !important;
  color: var(--auth-text-primary) !important;
  border-radius: 8px !important;
  font-family: inherit !important;
}

.mat-mdc-icon-button { color: var(--auth-primary) !important; }

// ── Material form field overrides ───────────────────────
.mat-mdc-form-field { font-family: inherit !important; }

.mdc-text-field--focused .mdc-notched-outline__leading,
.mdc-text-field--focused .mdc-notched-outline__notch,
.mdc-text-field--focused .mdc-notched-outline__trailing {
  border-color: var(--auth-primary) !important;
  border-width: 2px !important;
}

.mat-mdc-form-field.mat-focused .mat-mdc-floating-label {
  color: var(--auth-primary) !important;
}

// ── Material tab overrides ──────────────────────────────
.mat-mdc-tab-group,
.mat-mdc-tab-nav-bar {
  --mat-tab-header-active-label-text-color: var(--auth-primary);
  --mat-tab-header-active-indicator-color: var(--auth-primary);
  --mat-tab-header-active-focus-label-text-color: var(--auth-primary);
  --mat-tab-header-active-hover-label-text-color: var(--auth-primary);
}

// ── Material slide toggle ───────────────────────────────
.mat-mdc-slide-toggle {
  --mdc-switch-selected-track-color: var(--auth-primary-bg);
  --mdc-switch-selected-handle-color: var(--auth-primary);
  --mdc-switch-selected-focus-track-color: var(--auth-primary);
  --mdc-switch-selected-hover-track-color: var(--auth-primary-bg);
}

// ── Material checkbox ───────────────────────────────────
.mat-mdc-checkbox {
  --mdc-checkbox-selected-checkmark-color: white;
  --mdc-checkbox-selected-icon-color: var(--auth-primary);
  --mdc-checkbox-selected-focus-icon-color: var(--auth-primary);
  --mdc-checkbox-selected-hover-icon-color: var(--auth-primary);
  --mdc-checkbox-selected-pressed-icon-color: var(--auth-primary);
}

// ── Material progress spinner ───────────────────────────
.mat-mdc-progress-spinner circle,
.mat-mdc-progress-spinner .mdc-circular-progress__determinate-circle,
.mat-mdc-progress-spinner .mdc-circular-progress__indeterminate-circle-graphic {
  stroke: var(--auth-primary) !important;
}

// ── Shared component overrides ──────────────────────────
sh-error-alert .error-alert {
  background: var(--auth-danger-bg);
  color: var(--auth-danger-text);
  border-radius: 8px;
  border: 0.5px solid rgba(196, 49, 75, 0.2);
}

sh-loading-button button.mat-mdc-raised-button {
  width: 100%;
  height: 40px;
  font-family: inherit !important;
  font-weight: 500 !important;
  font-size: 14px !important;
  letter-spacing: 0 !important;
}

// ── Auth card (login / register / reset-password) ───────
.auth-card {
  background: #ffffff;
  border: 0.5px solid var(--auth-card-border);
  border-radius: 16px;
  padding: 2rem 1.75rem;
  width: 100%;
}

.auth-card-wide {
  max-width: 380px;
}

// ── Icon circle ─────────────────────────────────────────
.icon-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--auth-primary-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;

  mat-icon {
    font-size: 22px;
    width: 22px;
    height: 22px;
    color: var(--auth-primary);
  }
}

// ── Typography ──────────────────────────────────────────
.card-title {
  font-size: 20px;
  font-weight: 500;
  text-align: center;
  margin: 0 0 4px;
  color: var(--auth-text-primary);
}

.card-subtitle {
  font-size: 13px;
  text-align: center;
  color: var(--auth-text-secondary);
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

// ── Form primitives ─────────────────────────────────────
.field-label {
  display: block;
  font-size: 12px;
  color: var(--auth-text-secondary);
  margin: 0 0 4px;
}

.text-input {
  padding: 9px 12px;
  border: 0.5px solid var(--auth-input-border);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  background: #ffffff;
  color: var(--auth-text-primary);
  width: 100%;

  &:focus {
    outline: 2px solid var(--auth-primary);
    outline-offset: -1px;
  }

  &::placeholder { color: var(--auth-text-tertiary); }
}

.country-select {
  width: 86px;
  flex-shrink: 0;
  padding: 9px 8px;
  border: 0.5px solid var(--auth-input-border);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  background: #ffffff;
  color: var(--auth-text-primary);

  &:focus {
    outline: 2px solid var(--auth-primary);
    outline-offset: -1px;
  }
}

.phone-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.field-row {
  margin-bottom: 12px;
}

// ── Buttons ─────────────────────────────────────────────
.btn-primary {
  width: 100%;
  background: var(--auth-primary);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 10px 0;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:hover:not(:disabled) { background: var(--auth-primary-dark); }
}

.btn-alt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: #ffffff;
  border: 0.5px solid var(--auth-input-border);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-family: inherit;
  color: var(--auth-text-primary);
  cursor: pointer;

  &:hover { border-color: var(--auth-primary); color: var(--auth-primary); }
}

.btn-outline {
  flex: 1;
  background: #ffffff;
  border: 0.5px solid var(--auth-input-border);
  border-radius: 8px;
  padding: 10px 0;
  font-size: 14px;
  font-family: inherit;
  color: var(--auth-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover { border-color: var(--auth-primary); color: var(--auth-primary); }
}

.send-code-btn {
  background: #ffffff;
  border: 0.5px solid var(--auth-input-border);
  border-radius: 8px;
  padding: 0 14px;
  font-size: 13px;
  font-family: inherit;
  color: var(--auth-text-primary);
  cursor: pointer;
  white-space: nowrap;
  height: 40px;
  flex-shrink: 0;

  &:disabled { opacity: 0.6; cursor: not-allowed; }
  &:hover:not(:disabled) { border-color: var(--auth-primary); color: var(--auth-primary); }
}

.small-btn {
  background: #ffffff;
  border: 0.5px solid var(--auth-input-border);
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
  font-family: inherit;
  color: var(--auth-text-primary);
  cursor: pointer;
  white-space: nowrap;

  &:hover { border-color: var(--auth-primary); color: var(--auth-primary); }
}

// ── Divider ─────────────────────────────────────────────
.divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 1.25rem 0;

  .divider-line { flex: 1; height: 0.5px; background: var(--auth-border-mid); }
  .divider-text { font-size: 12px; color: var(--auth-text-tertiary); }
}

// ── Alt-method button rows ──────────────────────────────
.alt-row {
  display: flex;
  gap: 8px;

  & + .alt-row { margin-top: 8px; }
}

// ── Hints and messages ──────────────────────────────────
.field-hint {
  font-size: 12px;
  color: var(--auth-text-tertiary);
  margin: 4px 0 12px;
  min-height: 16px;
  line-height: 1.4;
}

.field-error {
  font-size: 12px;
  color: var(--auth-danger-text);
  margin: 4px 0 8px;
}

.field-success {
  font-size: 12px;
  color: var(--auth-success-text);
  margin: 4px 0 8px;
}

.cooldown-notice {
  font-size: 13px;
  color: var(--auth-danger-text);
  background: var(--auth-danger-bg);
  border: 0.5px solid rgba(196, 49, 75, 0.2);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
  text-align: center;
}

.success-notice {
  font-size: 13px;
  color: var(--auth-success-text);
  background: var(--auth-success-bg);
  border: 0.5px solid rgba(15, 110, 86, 0.2);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
  text-align: center;
}

// ── Links ───────────────────────────────────────────────
.link {
  color: var(--auth-primary);
  cursor: pointer;
  text-decoration: none;
  &:hover { text-decoration: underline; }
}

.forgot-row {
  text-align: right;
  margin: 6px 0 1.25rem;
}

.bottom-link {
  font-size: 12px;
  text-align: center;
  color: var(--auth-text-secondary);
  margin: 1.25rem 0 0;
}

.back-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  margin: 1.25rem 0 0;
  color: var(--auth-primary);
  text-decoration: none;
  cursor: pointer;

  &:hover { text-decoration: underline; }
}

// ── Account info cards ──────────────────────────────────
.info-card {
  background: #ffffff;
  border: 0.5px solid var(--auth-card-border);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.info-card-title {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 2px;
  color: var(--auth-text-primary);
}

.info-card-subtitle {
  font-size: 12px;
  color: var(--auth-text-secondary);
  margin: 0 0 12px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;

  & + .info-row { border-top: 0.5px solid var(--auth-card-border); }
}

.info-row-icon {
  font-size: 17px;
  width: 17px;
  height: 17px;
  color: var(--auth-text-secondary);
  flex-shrink: 0;
}

.info-row-body {
  flex: 1;
  min-width: 0;
}

.info-row-label {
  font-size: 13px;
  margin: 0;
  color: var(--auth-text-primary);
}

.info-row-value {
  font-size: 12px;
  margin: 0;
  color: var(--auth-text-secondary);
}

// ── Badges ──────────────────────────────────────────────
.badge {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;

  &.badge-success {
    background: var(--auth-success-bg);
    color: var(--auth-success-text);
  }

  &.badge-warning {
    background: var(--auth-warning-bg);
    color: var(--auth-warning-text);
  }
}

// ── Scrollbar ───────────────────────────────────────────
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: var(--auth-page-bg); }
::-webkit-scrollbar-thumb { background: rgba(83, 74, 183, 0.25); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--auth-primary); }
```

- [ ] **Step 2: Verify build**

```bash
ng build --project auth-portal 2>&1 | tail -20
```

Expected: build succeeds. SCSS compile errors would point to a typo in the SCSS above — fix by checking the error line.

- [ ] **Step 3: Commit**

```bash
git add projects/auth-portal/src/styles.scss
git commit -m "style(auth-portal): replace tech-blue theme with indigo minimal design tokens"
```

---

### Task 3: Redesign auth-layout component

**Files:**
- Modify: `features/auth-layout/auth-layout.component.html`
- Modify: `features/auth-layout/auth-layout.component.scss`
- Modify: `features/auth-layout/auth-layout.component.ts`

**Interfaces:**
- Consumes: `LangService.toggle()`, `LangService.currentLang`, `TranslateModule`
- Produces: page wrapper with `#F2F2F5` background, brand row, lang-toggle, centered `<router-outlet>`

- [ ] **Step 1: Update auth-layout.component.ts**

Replace content:

```typescript
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { LangService } from '../../lang.service';

@Component({
  selector: 'auth-layout',
  standalone: true,
  imports: [RouterOutlet, MatIconModule, TranslateModule],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayoutComponent {
  protected readonly langService = inject(LangService);
}
```

- [ ] **Step 2: Update auth-layout.component.html**

Replace content:

```html
<div class="auth-page">
  <div class="auth-header">
    <div class="brand">
      <mat-icon class="brand-icon">shield</mat-icon>
      <span class="brand-name">{{ 'common.brand' | translate }}</span>
    </div>
    <button class="lang-btn" (click)="langService.toggle()">
      {{ 'common.langToggle' | translate }}
    </button>
  </div>

  <div class="auth-slot">
    <router-outlet />
  </div>
</div>
```

- [ ] **Step 3: Update auth-layout.component.scss**

Replace content:

```scss
.auth-page {
  min-height: 100vh;
  background: #F2F2F5;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2.5rem 1rem;
  box-sizing: border-box;
}

.auth-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 380px;
  margin-bottom: 1.5rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  font-size: 22px;
  width: 22px;
  height: 22px;
  color: #534AB7;
}

.brand-name {
  font-size: 15px;
  font-weight: 500;
  color: #1C1C21;
}

.lang-btn {
  background: none;
  border: 0.5px solid #C9C9D1;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  color: #65656E;
  cursor: pointer;
  font-family: inherit;

  &:hover { border-color: #534AB7; color: #534AB7; }
}

.auth-slot {
  width: 100%;
  max-width: 380px;
}
```

- [ ] **Step 4: Verify build**

```bash
ng build --project auth-portal 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add projects/auth-portal/src/app/features/auth-layout/
git commit -m "feat(auth-portal): redesign auth-layout — flat bg, brand, lang toggle"
```

---

### Task 4: Redesign login component

**Files:**
- Modify: `features/login/login.component.ts`
- Modify: `features/login/login.component.html`
- Modify: `features/login/login.component.scss`

**Interfaces:**
- Consumes: existing `AuthService.login()`, `form` (unchanged), `loginType` signal (renamed usage), `LangService`
- Produces: login card with icon circle, alt-method switching, phone selector (non-functional), social buttons (non-functional)

- [ ] **Step 1: Update login.component.ts**

Replace content:

```typescript
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { interval, take } from 'rxjs';
import { ApiError, AuthService, CaptchaFieldComponent, ErrorAlertComponent } from '@shared';
import { LangService } from '../../lang.service';

@Component({
  selector: 'auth-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
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
  protected readonly langService = inject(LangService);

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
          if (this.failCount() >= 10) this.startCooldown();
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
        if (this.cooldownSeconds() === 0) this.failCount.set(0);
      });
  }

  private mapError(errorId: string): string {
    const map: Record<string, string> = {
      'error.security.authenticated.bad-credential': 'login.error.badCredential',
      'error.security.authenticated.invalid-account': 'login.error.invalidAccount',
      'error.security.authenticated.expired-credential': 'login.error.expiredCredential',
      'error.common.param.miss-captcha': 'login.error.missCaptcha',
      'error.security.authenticated.authenticated.over-attempt': 'login.error.overAttempt',
    };
    return map[errorId] ?? 'login.error.default';
  }
}
```

- [ ] **Step 2: Update login.component.html**

Replace content:

```html
<div class="auth-card">
  <div class="icon-circle">
    <mat-icon>lock</mat-icon>
  </div>
  <h1 class="card-title">{{ 'login.title' | translate }}</h1>
  <p class="card-subtitle">{{ ('login.subtitle.' + loginType()) | translate }}</p>

  @if (errorMessage()) {
    <sh-error-alert [message]="errorMessage()! | translate" />
  }

  @if (showCooldown()) {
    <div class="cooldown-notice">
      {{ 'login.cooldown' | translate: { time: cooldownDisplay() } }}
    </div>
  }

  <form [formGroup]="form" (ngSubmit)="onSubmit()">
    <label class="field-label">{{ ('login.label.' + loginType()) | translate }}</label>

    @if (loginType() === 'phone') {
      <div class="phone-row">
        <select class="country-select">
          <option>+86</option>
          <option>+1</option>
          <option>+44</option>
          <option>+65</option>
        </select>
        <input class="text-input" formControlName="principal" type="tel" placeholder="138 0000 0000" />
      </div>
    } @else {
      <div class="field-row">
        <input
          class="text-input"
          formControlName="principal"
          [type]="principalInputType()"
          [placeholder]="loginType() === 'email' ? 'you@example.com' : 'username'"
        />
      </div>
    }

    <label class="field-label">{{ 'login.label.password' | translate }}</label>
    <div class="field-row">
      <input class="text-input" formControlName="password" type="password" placeholder="••••••••" />
    </div>

    <div class="forgot-row">
      <a routerLink="/reset-password" class="link">{{ 'login.forgotPassword' | translate }}</a>
    </div>

    @if (showCaptcha()) {
      <sh-captcha-field [control]="captchaControl" [captchaId]="form.value.principal ?? ''" />
    }

    <button class="btn-primary" type="submit" [disabled]="form.invalid || showCooldown() || loading()">
      @if (loading()) {
        <mat-spinner diameter="18" />
      } @else {
        {{ 'login.submit' | translate }}
      }
    </button>
  </form>

  <div class="divider">
    <span class="divider-line"></span>
    <span class="divider-text">{{ 'login.orWith' | translate }}</span>
    <span class="divider-line"></span>
  </div>

  <div class="alt-row">
    @for (method of altMethods(); track method) {
      <button class="btn-alt" type="button" (click)="setMethod(method)">
        {{ ('login.altMethod.' + method) | translate }}
      </button>
    }
  </div>
  <div class="alt-row">
    <button class="btn-alt" type="button" (click)="onSocialLogin('google')">Google</button>
    <button class="btn-alt" type="button" (click)="onSocialLogin('github')">GitHub</button>
  </div>

  <p class="bottom-link">
    {{ 'login.noAccount' | translate }}
    <a routerLink="/register" class="link">{{ 'login.createOne' | translate }}</a>
  </p>
</div>
```

- [ ] **Step 3: Update login.component.scss**

Replace content:

```scss
// All visual styles come from global styles.scss classes.
// Component-scoped overrides only:

sh-captcha-field {
  display: block;
  margin-bottom: 12px;
}
```

- [ ] **Step 4: Verify build**

```bash
ng build --project auth-portal 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add projects/auth-portal/src/app/features/login/
git commit -m "feat(auth-portal): redesign login page — indigo minimal style, alt-method buttons, i18n"
```

---

### Task 5: Redesign register component

**Files:**
- Modify: `features/register/register.component.ts`
- Modify: `features/register/register.component.html`
- Modify: `features/register/register.component.scss`

- [ ] **Step 1: Update register.component.ts**

Replace content:

```typescript
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
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
    TranslateModule,
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
```

- [ ] **Step 2: Update register.component.html**

Replace content:

```html
<div class="auth-card">
  <div class="icon-circle">
    <mat-icon>person_add</mat-icon>
  </div>
  <h1 class="card-title">{{ 'register.title' | translate }}</h1>
  <p class="card-subtitle">{{ ('register.subtitle.' + registerType()) | translate }}</p>

  @if (errorMessage()) {
    <sh-error-alert [message]="errorMessage()! | translate" />
  }

  <form [formGroup]="form" (ngSubmit)="onSubmit()">
    <label class="field-label">{{ ('register.label.' + registerType()) | translate }}</label>

    @if (registerType() === 'phone') {
      <div class="phone-row">
        <select class="country-select">
          <option>+86</option>
          <option>+1</option>
          <option>+44</option>
          <option>+65</option>
        </select>
        <input class="text-input" formControlName="principal" type="tel" placeholder="138 0000 0000" />
      </div>
    } @else {
      <div class="field-row">
        <input class="text-input" formControlName="principal" type="email" placeholder="you@example.com" />
      </div>
    }

    @if (principalControl.hasError('taken')) {
      <p class="field-error">{{ 'register.error.taken' | translate }}</p>
    }

    <label class="field-label">{{ 'register.label.code' | translate }}</label>
    <div class="field-code-row" style="margin-bottom: 4px;">
      <input class="text-input" formControlName="code" maxlength="6"
             autocomplete="one-time-code" placeholder="6-digit code" style="flex:1;min-width:0;" />
      <button
        class="send-code-btn"
        type="button"
        [disabled]="!canSendCode() || principalControl.invalid"
        (click)="sendCode()"
      >
        @if (codeCountdown() > 0) {
          {{ 'register.resendCode' | translate: { count: codeCountdown() } }}
        } @else {
          {{ 'register.sendCode' | translate }}
        }
      </button>
    </div>
    <p class="field-hint">{{ 'register.codeHint' | translate }}</p>

    <label class="field-label">{{ 'register.label.username' | translate }}</label>
    <div class="field-row">
      <input class="text-input" formControlName="username" autocomplete="username" placeholder="e.g. user123" />
    </div>
    @if (usernameControl.hasError('taken')) {
      <p class="field-error">{{ 'register.error.usernameTaken' | translate }}</p>
    } @else if (usernameControl.hasError('pattern')) {
      <p class="field-error">{{ 'register.error.usernamePattern' | translate }}</p>
    } @else {
      <p class="field-hint">{{ 'register.usernameHint' | translate }}</p>
    }

    <label class="field-label">{{ 'register.label.password' | translate }}</label>
    <div class="field-row">
      <input class="text-input" formControlName="password" type="password"
             autocomplete="new-password" placeholder="••••••••" />
    </div>
    <p class="field-hint">{{ 'register.passwordHint' | translate }}</p>

    <button class="btn-primary" type="submit" [disabled]="form.invalid || loading()">
      @if (loading()) {
        <mat-spinner diameter="18" />
      } @else {
        {{ 'register.submit' | translate }}
      }
    </button>
  </form>

  <div class="divider">
    <span class="divider-line"></span>
    <span class="divider-text">{{ 'register.orWith' | translate }}</span>
    <span class="divider-line"></span>
  </div>

  <div class="alt-row">
    <button class="btn-alt" type="button" (click)="switchMode()">
      {{ ('register.label.' + (registerType() === 'email' ? 'phone' : 'email')) | translate }}
    </button>
    <button class="btn-alt" type="button" (click)="onSocialLogin('google')">Google</button>
    <button class="btn-alt" type="button" (click)="onSocialLogin('github')">GitHub</button>
  </div>

  <p class="bottom-link">
    {{ 'register.hasAccount' | translate }}
    <a routerLink="/login" class="link">{{ 'register.signIn' | translate }}</a>
  </p>
</div>
```

- [ ] **Step 3: Update register.component.scss**

Replace content:

```scss
.field-code-row {
  display: flex;
  gap: 8px;
}
```

- [ ] **Step 4: Verify build**

```bash
ng build --project auth-portal 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add projects/auth-portal/src/app/features/register/
git commit -m "feat(auth-portal): redesign register page — indigo minimal style, i18n"
```

---

### Task 6: Redesign reset-password component

**Files:**
- Modify: `features/reset-password/reset-password.component.ts`
- Modify: `features/reset-password/reset-password.component.html`

**Key changes in TS:** remove `resetType` writable signal and toggle; replace with reactive detection from form value; add `confirmPassword` field; update error keys.

- [ ] **Step 1: Update reset-password.component.ts**

Replace content:

```typescript
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
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
    TranslateModule,
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
```

- [ ] **Step 2: Update reset-password.component.html**

Replace content:

```html
<div class="auth-card auth-card-wide">
  <div class="icon-circle">
    <mat-icon>key</mat-icon>
  </div>
  <h1 class="card-title">{{ 'reset.title' | translate }}</h1>
  <p class="card-subtitle">{{ 'reset.subtitle' | translate }}</p>

  @if (errorMessage()) {
    <sh-error-alert [message]="errorMessage()! | translate" />
  }

  @if (successMessage()) {
    <div class="success-notice">{{ successMessage()! | translate }}</div>
  }

  <form [formGroup]="form" (ngSubmit)="onSubmit()">
    <label class="field-label">{{ 'reset.label.principal' | translate }}</label>
    <div class="field-row">
      <input class="text-input" formControlName="principal" type="text"
             placeholder="you@example.com or +86 138 0000 0000" />
    </div>

    <label class="field-label">{{ 'reset.label.code' | translate }}</label>
    <div class="field-code-row" style="margin-bottom: 4px;">
      <input class="text-input" formControlName="code" maxlength="6"
             inputmode="numeric" autocomplete="one-time-code"
             placeholder="6-digit code" style="flex:1;min-width:0;" />
      <button
        class="send-code-btn"
        type="button"
        [disabled]="!canSendCode() || principalControl.invalid"
        (click)="sendCode()"
      >
        @if (codeCountdown() > 0) {
          {{ 'reset.resendCode' | translate: { count: codeCountdown() } }}
        } @else {
          {{ 'reset.sendCode' | translate }}
        }
      </button>
    </div>
    @if (codeSent()) {
      <p class="field-hint" style="color: #0F6E56;">{{ 'reset.codeSent' | translate }}</p>
    } @else {
      <p class="field-hint">{{ 'reset.codeHint' | translate }}</p>
    }

    <label class="field-label">{{ 'reset.label.newPassword' | translate }}</label>
    <div class="field-row">
      <input class="text-input" formControlName="password" type="password"
             autocomplete="new-password" placeholder="••••••••" />
    </div>
    <p class="field-hint">{{ 'reset.passwordHint' | translate }}</p>

    <label class="field-label">{{ 'reset.label.confirmPassword' | translate }}</label>
    <div class="field-row">
      <input class="text-input" formControlName="confirmPassword" type="password"
             autocomplete="new-password" placeholder="••••••••" />
    </div>
    @if (passwordsMatch) {
      <p class="field-success">{{ 'reset.passwordMatch' | translate }}</p>
    } @else if (passwordsMismatch) {
      <p class="field-error">{{ 'reset.passwordMismatch' | translate }}</p>
    } @else {
      <p class="field-hint" style="min-height:20px;"></p>
    }

    <button class="btn-primary" type="submit" [disabled]="form.invalid || loading()">
      @if (loading()) {
        <mat-spinner diameter="18" />
      } @else {
        {{ 'reset.submit' | translate }}
      }
    </button>
  </form>

  <a routerLink="/login" class="back-link">
    <mat-icon style="font-size:14px;width:14px;height:14px;">arrow_back</mat-icon>
    {{ 'reset.backToSignIn' | translate }}
  </a>
</div>
```

- [ ] **Step 3: Verify build**

```bash
ng build --project auth-portal 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add projects/auth-portal/src/app/features/reset-password/
git commit -m "feat(auth-portal): redesign reset-password — single principal field, confirm password, i18n"
```

---

### Task 7: Redesign oauth2-consent component

**Files:**
- Modify: `features/oauth2-consent/oauth2-consent.component.ts`
- Modify: `features/oauth2-consent/oauth2-consent.component.html`

- [ ] **Step 1: Update oauth2-consent.component.ts**

Replace content:

```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService, ErrorAlertComponent } from '@shared';

interface AuthorizeResponse {
  code: string;
}

@Component({
  selector: 'auth-oauth2-consent',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule, TranslateModule, ErrorAlertComponent],
  templateUrl: './oauth2-consent.component.html',
})
export class OAuth2ConsentComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly currentUser = this.auth.currentUser;

  clientId = '';
  redirectUri = '';
  scope = '';
  codeChallenge = '';
  codeChallengeMethod = '';
  state = '';

  get scopeList(): string[] {
    return this.scope.split(/\s+/).filter(Boolean);
  }

  get userIdentifier(): string {
    const u = this.currentUser();
    return u?.email ?? u?.phone ?? u?.username ?? '';
  }

  scopeIcon(scope: string): string {
    const icons: Record<string, string> = {
      openid: 'person',
      profile: 'account_circle',
      email: 'mail',
      phone: 'phone',
    };
    return icons[scope] ?? 'check_circle';
  }

  scopeKey(scope: string): string {
    const known = ['openid', 'profile', 'email', 'phone'];
    return known.includes(scope) ? `consent.scope.${scope}` : scope;
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
          this.errorMessage.set('consent.error.default');
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

- [ ] **Step 2: Update oauth2-consent.component.html**

Replace content:

```html
<div class="consent-page">
  <div class="auth-card auth-card-wide">
    <div class="app-connect-row">
      <div class="connect-icon" style="background:#E1F5EE;">
        <mat-icon style="color:#0F6E56;">apps</mat-icon>
      </div>
      <mat-icon class="connect-arrow">swap_horiz</mat-icon>
      <div class="connect-icon" style="background:#EEEDFE;">
        <mat-icon style="color:#534AB7;">shield</mat-icon>
      </div>
    </div>

    <h1 class="card-title" style="font-size:18px;">
      {{ 'consent.title' | translate: { clientId: clientId } }}
    </h1>
    <p class="card-subtitle">
      {{ 'consent.signedInAs' | translate: { identifier: userIdentifier } }}
    </p>

    @if (errorMessage()) {
      <sh-error-alert [message]="errorMessage()! | translate" />
    }

    <p class="scope-intro">{{ 'consent.permissionsIntro' | translate: { clientId: clientId } }}</p>

    <div class="scope-list">
      @for (s of scopeList; track s; let last = $last) {
        <div class="scope-item" [class.last]="last">
          <mat-icon class="info-row-icon">{{ scopeIcon(s) }}</mat-icon>
          <span class="scope-text">{{ scopeKey(s) | translate }}</span>
        </div>
      }
    </div>

    <p class="consent-footer">
      {{ 'consent.footer' | translate: { clientId: clientId } }}
    </p>

    <div class="consent-actions">
      <button class="btn-outline" type="button" [disabled]="loading()" (click)="deny()">
        {{ 'consent.deny' | translate }}
      </button>
      <button class="btn-primary" style="flex:1;" type="button"
              [disabled]="loading()" (click)="authorize()">
        @if (loading()) {
          <mat-spinner diameter="18" />
        } @else {
          {{ 'consent.allow' | translate }}
        }
      </button>
    </div>
  </div>
</div>

<style>
  .consent-page {
    min-height: 100vh;
    background: #F2F2F5;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2.5rem 1rem;
    box-sizing: border-box;
  }

  .app-connect-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 1rem;
  }

  .connect-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .connect-arrow { font-size: 16px; color: #94949D; }

  .scope-intro {
    font-size: 12px;
    color: #65656E;
    margin: 0 0 8px;
  }

  .scope-list {
    border: 0.5px solid #E8E8ED;
    border-radius: 8px;
    padding: 4px 14px;
    margin-bottom: 1rem;
  }

  .scope-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 0.5px solid #E8E8ED;

    &.last { border-bottom: none; }
  }

  .scope-text { font-size: 13px; color: #1C1C21; }

  .consent-footer {
    font-size: 12px;
    color: #94949D;
    line-height: 1.5;
    margin: 0 0 1.25rem;
  }

  .consent-actions {
    display: flex;
    gap: 10px;
  }
</style>
```

- [ ] **Step 3: Verify build**

```bash
ng build --project auth-portal 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add projects/auth-portal/src/app/features/oauth2-consent/
git commit -m "feat(auth-portal): redesign oauth2-consent — app connect header, scope list, i18n"
```

---

### Task 8: Redesign account-shell component

**Files:**
- Modify: `features/account/account-shell/account-shell.component.ts`
- Modify: `features/account/account-shell/account-shell.component.html`
- Modify: `features/account/account-shell/account-shell.component.scss`

- [ ] **Step 1: Update account-shell.component.ts**

Replace content:

```typescript
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '@shared';
import { LangService } from '../../../lang.service';

@Component({
  selector: 'auth-account-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, TranslateModule],
  templateUrl: './account-shell.component.html',
  styleUrl: './account-shell.component.scss',
})
export class AccountShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly langService = inject(LangService);

  readonly currentUser = this.auth.currentUser;

  logout(): void {
    this.auth.logout().subscribe(() => this.router.navigate(['/login']));
  }
}
```

- [ ] **Step 2: Update account-shell.component.html**

Replace content:

```html
<div class="shell-wrapper">
  <header class="top-bar">
    <div class="bar-brand">
      <mat-icon class="brand-icon">shield</mat-icon>
      <span class="brand-name">{{ 'common.brand' | translate }}</span>
    </div>
    <div class="bar-actions">
      <span class="bar-username">{{ currentUser()?.username }}</span>
      <button class="icon-btn" (click)="logout()" [title]="'account.logout' | translate">
        <mat-icon>logout</mat-icon>
      </button>
      <button class="lang-btn" (click)="langService.toggle()">
        {{ 'common.langToggle' | translate }}
      </button>
    </div>
  </header>

  <div class="page-body">
    <nav class="sidebar">
      <a
        class="nav-item"
        routerLink="/account/profile"
        routerLinkActive="active"
      >
        <mat-icon>person</mat-icon>
        <span>{{ 'account.profile' | translate }}</span>
      </a>
      <a
        class="nav-item"
        routerLink="/account/security"
        routerLinkActive="active"
      >
        <mat-icon>lock</mat-icon>
        <span>{{ 'account.security' | translate }}</span>
      </a>
    </nav>

    <main class="main-area">
      <router-outlet />
    </main>
  </div>
</div>
```

- [ ] **Step 3: Update account-shell.component.scss**

Replace content:

```scss
.shell-wrapper {
  min-height: 100vh;
  background: #F2F2F5;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 56px;
  background: #ffffff;
  border-bottom: 0.5px solid #E8E8ED;
  position: sticky;
  top: 0;
  z-index: 100;
}

.bar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  font-size: 22px;
  width: 22px;
  height: 22px;
  color: #534AB7;
}

.brand-name {
  font-size: 15px;
  font-weight: 500;
  color: #1C1C21;
}

.bar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bar-username {
  font-size: 13px;
  color: #65656E;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  color: #65656E;
  border-radius: 6px;
  display: flex;
  align-items: center;

  mat-icon { font-size: 20px; width: 20px; height: 20px; }
  &:hover { background: #F2F2F5; color: #1C1C21; }
}

.lang-btn {
  background: none;
  border: 0.5px solid #C9C9D1;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  color: #65656E;
  cursor: pointer;
  font-family: inherit;

  &:hover { border-color: #534AB7; color: #534AB7; }
}

.page-body {
  display: flex;
  gap: 1.25rem;
  max-width: 860px;
  margin: 1.5rem auto;
  padding: 0 1.5rem;
  align-items: flex-start;
}

.sidebar {
  flex: 0 0 160px;
  min-width: 150px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 4px;
  font-size: 13px;
  color: #65656E;
  text-decoration: none;
  cursor: pointer;

  mat-icon { font-size: 17px; width: 17px; height: 17px; }

  &.active {
    background: #EEEDFE;
    color: #3C3489;
    font-weight: 500;
    mat-icon { color: #534AB7; }
  }

  &:hover:not(.active) {
    background: rgba(83, 74, 183, 0.05);
    color: #1C1C21;
  }
}

.main-area {
  flex: 1;
  min-width: 0;
}
```

- [ ] **Step 4: Verify build**

```bash
ng build --project auth-portal 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add projects/auth-portal/src/app/features/account/account-shell/
git commit -m "feat(auth-portal): redesign account-shell — sidebar layout, top bar, i18n"
```

---

### Task 9: Redesign profile component

**Files:**
- Modify: `features/account/profile/profile.component.ts`
- Modify: `features/account/profile/profile.component.html`

- [ ] **Step 1: Update profile.component.ts**

Replace content:

```typescript
import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { switchMap } from 'rxjs';
import { AccountService, ApiError, AuthService, ErrorAlertComponent, LoadingButtonComponent } from '@shared';

@Component({
  selector: 'auth-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatIconModule,
    TranslateModule,
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

  get memberYear(): string {
    const d = this.user()?.createdAt;
    return d ? new Date(d).getFullYear().toString() : '';
  }

  get initials(): string {
    const u = this.user()?.username ?? '';
    return u.slice(0, 2).toUpperCase();
  }

  startEdit(): void {
    this.form.patchValue({ username: this.user()?.username ?? '' });
    this.editing.set(true);
    this.errorMessage.set(null);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  onSocialAction(action: string): void {
    console.warn(`not implemented: ${action}`);
  }

  save(): void {
    if (this.loading() || this.form.invalid) return;
    this.loading.set(true);

    this.account
      .updateProfile({ username: this.form.value.username! })
      .pipe(switchMap(() => this.auth.checkLogin()))
      .subscribe({
        next: () => { this.loading.set(false); this.editing.set(false); },
        error: (err: ApiError) => {
          this.loading.set(false);
          this.errorMessage.set(
            err.errorId === 'error.business.conflict' ? 'profile.error.conflict' : 'profile.error.default',
          );
        },
      });
  }
}
```

- [ ] **Step 2: Update profile.component.html**

Replace content:

```html
<sh-error-alert @if(errorMessage()) [message]="errorMessage()! | translate" />

@if (errorMessage()) {
  <sh-error-alert [message]="errorMessage()! | translate" />
}

<!-- Avatar card -->
<div class="info-card">
  <div style="display:flex;align-items:center;gap:14px;">
    <div class="avatar-circle">{{ initials }}</div>
    <div style="flex:1;">
      <p style="font-size:16px;font-weight:500;margin:0;">{{ user()?.username }}</p>
      @if (memberYear()) {
        <p style="font-size:13px;color:#65656E;margin:0;">
          {{ 'profile.memberSince' | translate: { year: memberYear() } }}
        </p>
      }
    </div>
  </div>
</div>

<!-- Sign-in identifiers card -->
<div class="info-card">
  <p class="info-card-title">{{ 'profile.identifiers.title' | translate }}</p>
  <p class="info-card-subtitle">{{ 'profile.identifiers.subtitle' | translate }}</p>

  <!-- Username row -->
  <div class="info-row">
    <mat-icon class="info-row-icon">alternate_email</mat-icon>
    <div class="info-row-body">
      <p class="info-row-label">{{ 'profile.identifiers.username' | translate }}</p>
      @if (!editing()) {
        <p class="info-row-value">{{ user()?.username }}</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" style="display:flex;align-items:flex-start;gap:8px;margin-top:4px;">
          <input class="text-input" formControlName="username"
                 placeholder="5-15 lowercase letters or numbers"
                 style="flex:1;min-width:0;" />
          <sh-loading-button [loading]="loading()" [disabled]="form.invalid" (clicked)="save()">
            {{ 'profile.save' | translate }}
          </sh-loading-button>
          <button class="small-btn" type="button" (click)="cancelEdit()">
            {{ 'profile.cancel' | translate }}
          </button>
        </form>
        @if (form.get('username')?.hasError('pattern')) {
          <p class="field-error">{{ 'register.error.usernamePattern' | translate }}</p>
        }
      }
    </div>
    @if (!editing()) {
      <button class="small-btn" (click)="startEdit()">
        {{ 'profile.identifiers.change' | translate }}
      </button>
    }
  </div>

  <!-- Email row -->
  <div class="info-row">
    <mat-icon class="info-row-icon">mail</mat-icon>
    <div class="info-row-body">
      <p class="info-row-label">{{ 'profile.identifiers.email' | translate }}</p>
      <p class="info-row-value">{{ user()?.email ?? ('profile.notBound' | translate) }}</p>
    </div>
    @if (user()?.email) {
      <span class="badge badge-success">{{ 'profile.badge.verified' | translate }}</span>
      <button class="small-btn" (click)="onSocialAction('change-email')">
        {{ 'profile.identifiers.change' | translate }}
      </button>
    } @else {
      <button class="small-btn" (click)="onSocialAction('bind-email')">
        {{ 'profile.identifiers.verify' | translate }}
      </button>
    }
  </div>

  <!-- Phone row -->
  <div class="info-row">
    <mat-icon class="info-row-icon">phone_iphone</mat-icon>
    <div class="info-row-body">
      <p class="info-row-label">{{ 'profile.identifiers.phone' | translate }}</p>
      <p class="info-row-value">{{ user()?.phone ?? ('profile.notBound' | translate) }}</p>
    </div>
    @if (user()?.phone) {
      <span class="badge badge-warning">{{ 'profile.badge.unverified' | translate }}</span>
      <button class="small-btn" (click)="onSocialAction('verify-phone')">
        {{ 'profile.identifiers.verify' | translate }}
      </button>
    } @else {
      <button class="small-btn" (click)="onSocialAction('bind-phone')">
        {{ 'profile.identifiers.verify' | translate }}
      </button>
    }
  </div>
</div>

<!-- Linked accounts card -->
<div class="info-card">
  <p class="info-card-title">{{ 'profile.linkedAccounts.title' | translate }}</p>

  <div class="info-row" style="padding-top:0;">
    <mat-icon class="info-row-icon">account_circle</mat-icon>
    <div class="info-row-body">
      <p class="info-row-label">Google</p>
      <p class="info-row-value">{{ 'profile.linkedAccounts.notConnected' | translate }}</p>
    </div>
    <button class="small-btn" (click)="onSocialAction('connect-google')">
      {{ 'profile.linkedAccounts.connect' | translate }}
    </button>
  </div>

  <div class="info-row">
    <mat-icon class="info-row-icon">code</mat-icon>
    <div class="info-row-body">
      <p class="info-row-label">GitHub</p>
      <p class="info-row-value">{{ 'profile.linkedAccounts.notConnected' | translate }}</p>
    </div>
    <button class="small-btn" (click)="onSocialAction('connect-github')">
      {{ 'profile.linkedAccounts.connect' | translate }}
    </button>
  </div>
</div>

<style>
  .avatar-circle {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: #EEEDFE;
    color: #534AB7;
    font-size: 17px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 3: Verify build**

```bash
ng build --project auth-portal 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add projects/auth-portal/src/app/features/account/profile/
git commit -m "feat(auth-portal): redesign profile — avatar card, identifiers, linked accounts, i18n"
```

---

### Task 10: Redesign security component

**Files:**
- Modify: `features/account/security/security.component.ts`
- Modify: `features/account/security/security.component.html`

- [ ] **Step 1: Update security.component.ts**

Replace content:

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { AccountService, ApiError, ErrorAlertComponent, LoadingButtonComponent } from '@shared';

@Component({
  selector: 'auth-security',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    TranslateModule,
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

  onManageSessions(): void {
    console.warn('not implemented: manage sessions');
  }

  onSubmit(): void {
    if (this.loading() || this.form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { oldPassword, newPassword } = this.form.value;
    this.account.changePassword({ oldPassword: oldPassword!, newPassword: newPassword! }).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set('security.success');
        this.form.reset();
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.errorId === 'error.user.wrong-password'
            ? 'security.error.wrongPassword'
            : 'security.error.default',
        );
      },
    });
  }
}
```

- [ ] **Step 2: Update security.component.html**

Replace content:

```html
<!-- Sessions card -->
<div class="info-card">
  <div class="info-row" style="padding-top:0;">
    <mat-icon class="info-row-icon">devices</mat-icon>
    <div class="info-row-body">
      <p class="info-row-label">{{ 'security.sessions.label' | translate }}</p>
      <p class="info-row-value">{{ 'security.sessions.description' | translate }}</p>
    </div>
    <button class="small-btn" (click)="onManageSessions()">
      {{ 'security.sessions.manage' | translate }}
    </button>
  </div>
</div>

<!-- Change password card -->
<div class="info-card">
  <p class="info-card-title">{{ 'security.changePassword.title' | translate }}</p>

  @if (errorMessage()) {
    <sh-error-alert [message]="errorMessage()! | translate" />
  }

  @if (successMessage()) {
    <div class="success-notice">{{ successMessage()! | translate }}</div>
  }

  <form [formGroup]="form" (ngSubmit)="onSubmit()">
    <label class="field-label">{{ 'security.changePassword.oldPassword' | translate }}</label>
    <div class="field-row">
      <input class="text-input" formControlName="oldPassword" type="password"
             autocomplete="current-password" placeholder="••••••••" />
    </div>

    <label class="field-label">{{ 'security.changePassword.newPassword' | translate }}</label>
    <div class="field-row">
      <input class="text-input" formControlName="newPassword" type="password"
             autocomplete="new-password" placeholder="••••••••" />
    </div>
    @if (form.get('newPassword')?.hasError('minlength')) {
      <p class="field-error">{{ 'register.passwordHint' | translate }}</p>
    }

    <sh-loading-button
      [loading]="loading()"
      [disabled]="form.invalid"
      (clicked)="onSubmit()"
      style="display:block;margin-top:12px;"
    >
      {{ 'security.changePassword.submit' | translate }}
    </sh-loading-button>
  </form>
</div>
```

- [ ] **Step 3: Verify build**

```bash
ng build --project auth-portal 2>&1 | tail -10
```

- [ ] **Step 4: Final full build**

```bash
ng build --project auth-portal 2>&1 | tail -30
```

Expected: `Build at: ... - Hash: ... - Time: ...ms` with no errors.

- [ ] **Step 5: Commit**

```bash
git add projects/auth-portal/src/app/features/account/security/
git commit -m "feat(auth-portal): redesign security page — sessions row, change-password card, i18n"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Design tokens → Task 2 ✓
  - ngx-translate + LangService → Task 1 ✓
  - Auth layout → Task 3 ✓
  - Login (icon circle, alt-methods, phone selector, social buttons) → Task 4 ✓
  - Register (phone/email toggle, code countdown, social buttons) → Task 5 ✓
  - Reset password (single principal field, confirm password) → Task 6 ✓
  - OAuth2 consent (app-connect header, scope list) → Task 7 ✓
  - Account shell (sidebar layout, top bar) → Task 8 ✓
  - Profile (avatar card, identifiers, linked accounts) → Task 9 ✓
  - Security (sessions row, change-password card) → Task 10 ✓
  - Shared component overrides (error-alert, loading-button) → Task 2 styles.scss ✓
  - Language toggle in auth-layout and account-shell → Tasks 3 + 8 ✓

- [x] **Type consistency:** `LangService.toggle()` used in auth-layout (Task 3) and account-shell (Task 8). `mapError()` returns translation key strings in login (Task 4), register (Task 5), reset-password (Task 6), consent (Task 7), profile (Task 9), security (Task 10). `TranslateModule` imported in every component that uses `translate` pipe.

- [x] **Non-functional elements:** social login → `onSocialLogin(provider)` → `console.warn`; phone selector → renders only; profile identifier buttons (email/phone change, link-account) → `onSocialAction(action)` → `console.warn`; sessions manage → `onManageSessions()` → `console.warn`.

- [x] **OTP 6-box not added** — `otp-verification.html` has no corresponding route; register keeps single text input.

- [x] **admin-portal untouched** — no files in `projects/admin-portal` or `projects/shared/src/lib/services|guards|interceptors` are modified.

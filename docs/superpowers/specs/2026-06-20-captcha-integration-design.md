# Captcha Integration Design

**Date:** 2026-06-20  
**Status:** Approved

## Overview

Integrate `third-party-service` captcha APIs into the auth-portal frontend. Two captcha flows are required:

1. **Image captcha** — shown in the login form after 3 consecutive failures. User solves a visual puzzle; the UUID and typed code are sent to auth-service via `X-Captcha-ID` / `X-Captcha-Token` headers.
2. **SMS/Email code captcha** — shown in register and reset-password flows. User requests a one-time code to their phone or email; they enter it to verify ownership before submitting the form.

The `third-party-service` runs on a different base URL than `auth-service`, requiring a routing change in the shared HTTP interceptor.

---

## Architecture

### Environment

Add `thirdPartyBaseUrl?: string` (optional so admin-portal is unaffected) to the `Environment` interface in `shared/.../environment.token.ts`.

**auth-portal values:**

| Config | Value |
|--------|-------|
| dev `thirdPartyBaseUrl` | `http://localhost:7100` |
| prod `thirdPartyBaseUrl` | `https://api.flyingjack.top/third` |

### Interceptor routing (`shared/.../api.interceptor.ts`)

Current behavior: prepend `env.apiBaseUrl` to every request.

New behavior: if `req.url.startsWith('/captcha/')` **and** `env.thirdPartyBaseUrl` is set, prepend `env.thirdPartyBaseUrl` instead of `env.apiBaseUrl`. All other behavior (withCredentials, ApiResponse unwrapping, error mapping) is unchanged.

```
URL starts with /captcha/ AND thirdPartyBaseUrl set
  → use thirdPartyBaseUrl
else
  → use apiBaseUrl
```

---

## CaptchaService (new, `shared/.../services/captcha.service.ts`)

Three public methods. All use relative paths; the interceptor routes them correctly.

| Method | HTTP | Path | Returns |
|--------|------|------|---------|
| `getImageCaptcha()` | GET | `/captcha/generate/image` | `{ uuid: string, base64Image: string }` |
| `sendSmsCaptcha(phone: string)` | GET | `/captcha/generate/sms?phone=…` | `boolean` |
| `sendEmailCaptcha(email: string)` | GET | `/captcha/generate/mail?email=…` | `boolean` |

The `/captcha/verify` endpoint is internal (called by auth-service via OpenFeign) and is never called by the frontend.

---

## Components

### `ImageCaptchaFieldComponent` (`sh-image-captcha-field`)

Replaces the current stub `CaptchaFieldComponent` (same file path, renamed class + selector).

**Inputs:**
- `control: FormControl` — bound to the user's text input (captcha answer)

**Outputs:**
- `captchaId: EventEmitter<string>` — emits the UUID each time a new image is fetched

**Behavior:**
- On init, calls `CaptchaService.getImageCaptcha()`, displays the returned `base64Image` as an `<img>` tag, emits the UUID via `captchaId`.
- Has a refresh icon button; clicking it re-fetches a new image and emits the new UUID.
- Shows a loading spinner while fetching.
- On fetch error, shows an inline retry message.
- On refresh click, calls `control.reset()` on the bound FormControl to clear the user's previous answer before the new image loads.

**Usage in login template:**
```html
<sh-image-captcha-field
  [control]="captchaControl"
  (captchaId)="captchaUuid.set($event)" />
```

### `CodeCaptchaFieldComponent` (`sh-code-captcha-field`)

New component for register and reset-password.

**Inputs:**
- `control: FormControl` — bound to the 6-digit code input
- `type: 'phone' | 'email'` — determines which send endpoint to call and the cooldown duration
- `principal: string` — the phone number or email address to send the code to

**Behavior:**
- Displays a "Send code" button alongside the text input.
- On click, calls `CaptchaService.sendSmsCaptcha(principal)` or `sendEmailCaptcha(principal)` based on `type`.
- Countdown after successful send: **60 s** for phone, **30 s** for email (matching API rate limits).
- While countdown is active, the button is disabled and shows the remaining seconds.
- On 429 response, shows an inline error: "请求太频繁，请稍后再试" / "Too many requests, please wait."
- On other errors, shows a generic send-failed message.
- The `principal` input is watched; if it changes and a countdown is running, the countdown is cancelled and the button resets (user switched phone/email).

**Usage in register template:**
```html
<sh-code-captcha-field
  [control]="codeControl"
  [type]="registerType()"
  [principal]="form.value.principal ?? ''" />
```

---

## Updated Consumers

### Login component

- Add `captchaUuid = signal('')`.
- Remove the use of `principal` as captchaId; pass `captchaUuid()` as `X-Captcha-ID` instead.
- On each failed login attempt that triggers a refresh (the component already calls `form.patchValue({ captchaToken: '' })`), the `ImageCaptchaFieldComponent` is already mounted and will auto-refresh on the next render cycle — no extra action needed. The component re-fetches on init; if `showCaptcha()` toggles from false to true, the `@if` block mounts the component and triggers init automatically.
- The captcha control name stays `captchaToken`; the uuid is tracked separately in `captchaUuid`.

### Register component

Remove: `codeSending`, `codeCountdown`, `canSendCode`, `sendCode()`, the `interval`/`take` import for countdown.

Replace the send-code button + countdown UI in the template with `<sh-code-captcha-field>`.

### Reset-password component

Same removals as register. Replace send-code UI with `<sh-code-captcha-field>`.

### `AccountService`

Remove `sendVerificationCode()` — no longer called by any component.

---

## i18n Keys (new)

Add to `public/assets/i18n/zh.json` (`public/` is authoritative since the recent i18n assets migration; `src/assets/i18n/` is kept in sync for completeness):

```json
"captcha": {
  "refresh": "刷新验证码",
  "imagePlaceholder": "请输入图中文字",
  "sendCode": "发送验证码",
  "resend": "重新发送 ({{s}}s)",
  "sendFailed": "发送失败，请重试",
  "tooManyRequests": "请求太频繁，请稍后再试"
}
```

Add to `public/assets/i18n/en.json`:

```json
"captcha": {
  "refresh": "Refresh captcha",
  "imagePlaceholder": "Enter the text shown",
  "sendCode": "Send code",
  "resend": "Resend ({{s}}s)",
  "sendFailed": "Send failed, please retry",
  "tooManyRequests": "Too many requests, please wait"
}
```

---

## Files Changed

| File | Type |
|------|------|
| `projects/shared/src/lib/tokens/environment.token.ts` | Modify — add `thirdPartyBaseUrl?` |
| `projects/shared/src/lib/interceptors/api.interceptor.ts` | Modify — route `/captcha/` to thirdPartyBaseUrl |
| `projects/shared/src/lib/services/captcha.service.ts` | New |
| `projects/shared/src/lib/components/captcha-field/captcha-field.component.ts` | Rewrite as `ImageCaptchaFieldComponent` |
| `projects/shared/src/lib/components/code-captcha-field/code-captcha-field.component.ts` | New |
| `projects/shared/src/lib/services/account.service.ts` | Modify — remove `sendVerificationCode` |
| `projects/shared/src/public-api.ts` | Modify — export new service + components |
| `projects/auth-portal/src/environments/environment.development.ts` | Modify — add `thirdPartyBaseUrl` |
| `projects/auth-portal/src/environments/environment.ts` | Modify — add `thirdPartyBaseUrl` |
| `projects/auth-portal/src/app/features/login/login.component.ts` | Modify — add `captchaUuid` signal, use uuid as captchaId |
| `projects/auth-portal/src/app/features/login/login.component.html` | Modify — use `sh-image-captcha-field` |
| `projects/auth-portal/src/app/features/register/register.component.ts` | Modify — remove send-code logic |
| `projects/auth-portal/src/app/features/register/register.component.html` | Modify — use `sh-code-captcha-field` |
| `projects/auth-portal/src/app/features/reset-password/reset-password.component.ts` | Modify — remove send-code logic |
| `projects/auth-portal/src/app/features/reset-password/reset-password.component.html` | Modify — use `sh-code-captcha-field` |
| `projects/auth-portal/public/assets/i18n/zh.json` | Modify — add captcha keys (authoritative) |
| `projects/auth-portal/public/assets/i18n/en.json` | Modify — add captcha keys (authoritative) |
| `projects/auth-portal/src/assets/i18n/zh.json` | Modify — kept in sync with public/ |
| `projects/auth-portal/src/assets/i18n/en.json` | Modify — kept in sync with public/ |

---

## Out of Scope

- `POST /captcha/verify` — internal microservice call, never invoked by the frontend.
- Admin portal — no captcha flows; environment files left untouched.
- Social login / phone country selector stubs in login and register — pre-existing `console.warn` placeholders, not touched.

# Auth Portal UI Redesign — Design Spec

**Date:** 2026-06-19  
**Status:** Approved  
**Scope:** `projects/auth-portal` only — admin-portal untouched

---

## 1. Goal

Replace the current sky-blue tech theme (aurora gradients, `Exo 2`/`DM Sans` fonts, Angular Material defaults) with the minimal indigo design from the `ui/` reference mockups. All six user-facing pages are rebuilt to match the mockups. Bilingual support (Chinese + English) is added via ngx-translate with a runtime language toggle.

---

## 2. Design Tokens

Replace all tokens in `projects/auth-portal/src/styles.scss`.

| Token | Old value | New value |
|---|---|---|
| Primary | `#0284c7` | `#534AB7` |
| Primary light | `#0ea5e9` | `#6B63C8` |
| Primary bg (icon circles) | — | `#EEEDFE` |
| Page background | aurora gradient | `#F2F2F5` |
| Card background | `#ffffff` | `#ffffff` |
| Card border | `rgba(2,132,199,0.18)` | `0.5px solid #E8E8ED` |
| Card radius | `14px` | `16px` |
| Input border | `rgba(2,132,199,0.18)` | `0.5px solid #C9C9D1` |
| Input focus outline | blue outline | `2px solid #534AB7` |
| Text primary | `#0f172a` | `#1C1C21` |
| Text secondary | `#475569` | `#65656E` |
| Text tertiary | — | `#94949D` |
| Success bg / text | — | `#E1F5EE` / `#0F6E56` |
| Warning bg / text | — | `#FCF0DB` / `#8A5A00` |
| Danger text | — | `#C4314B` |
| Font stack | `'Exo 2', 'DM Sans'` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |
| Card top gradient border | yes | **removed** |
| Aurora background | yes | **removed** |
| Box shadow glow | yes | **removed** |

Angular Material theme palette switches from `$azure-palette` to a custom indigo palette seeded from `#534AB7`.

---

## 3. i18n — ngx-translate

### Packages
```
@ngx-translate/core
@ngx-translate/http-loader
```

### File layout
```
projects/auth-portal/src/assets/i18n/
  zh.json    ← default language
  en.json
```

### LangService
`core/services/lang.service.ts` wraps `TranslateService`:
- `currentLang` signal, initialized from `localStorage['lang']` or browser default
- `toggle()` method switches between `zh` and `en`, persists to `localStorage`

### Usage in templates
```html
{{ 'login.title' | translate }}
```

### Key namespaces
`common.*`, `login.*`, `register.*`, `reset.*`, `consent.*`, `account.*`

### Language toggle UI
- In auth-layout: top-right corner, text button `中 / EN`
- In account shell: right side of top bar, same button

---

## 4. Component Designs

### 4.1 Auth Layout (`auth-layout`)

Wraps login, register, reset-password.

**Template:**
```
┌─ page background: #F2F2F5 ──────────────────────────────┐
│  [中/EN toggle]                              (top right) │
│                                                          │
│            🛡 flyingjack cloud                           │
│                                                          │
│  ┌─ white card · border: 0.5px #E8E8ED · r:16px ──────┐ │
│  │  <router-outlet>                                    │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

- Card `max-width: 360px`, `padding: 2rem 1.75rem`
- Brand: shield `mat-icon` (24px, `#534AB7`) + brand name text (16px, `#1C1C21`, weight 500)
- No aurora, no gradient, no grid overlay

---

### 4.2 Login Page (`login`)

Matches `ui/signin.html`.

**Template structure:**
1. Icon circle: 48×48px, `#EEEDFE` bg, lock icon `#534AB7`
2. Title: `{{ 'login.title' | translate }}` (20px, weight 500, center)
3. Subtitle: updates per active method (e.g. "Sign in with your phone number")
4. **Active method input:**
   - `phone`: country-code `<select>` (86px) + tel `<input>` (flex 1) in a row — non-functional selector
   - `email`: full-width email input
   - `username`: full-width text input
5. Password field + "Forgot password?" link (right-aligned, `#534AB7`)
6. Full-width indigo primary button: "Sign in"
7. Divider: `or sign in with`
8. Two alt-method buttons (switch active method) + Google + GitHub buttons in a 2×2 grid
9. Bottom link: "No account? Create one" → `/register`

**Method switching:**
- Angular signal `activeMethod: 'phone' | 'email' | 'username'`
- Two alt buttons show the other two methods; clicking sets `activeMethod`
- Existing `form` controls and submit logic unchanged

**Non-functional elements:** Google, GitHub buttons log `console.warn('social login not implemented')`; phone country selector renders but does not affect form value.

**Captcha / cooldown:** rendered in the same position as now, below the method input, using existing `sh-captcha-field` and cooldown notice restyled to the danger palette (`#C4314B`).

---

### 4.3 Register Page (`register`)

Matches `ui/register.html`.

**Template structure:**
1. Icon circle: user-plus icon
2. Title + subtitle (updates per mode: phone / email)
3. **Active identifier input** (phone row OR email input), controlled by `registerType` signal
4. Verification code field + Send code / countdown button (existing logic)
5. Password field + hint text (8+ chars, one number, one symbol)
6. Terms checkbox (non-functional, no backend enforcement)
7. "Verify & create account" button (maps to existing `onSubmit()`)
8. Divider: `or sign up with`
9. Alt-method button (phone ↔ email) + Google + GitHub
10. Bottom link: "Already have an account? Sign in" → `/login`

**Phone selector:** renders `<select>` with country codes — non-functional (does not affect `principalControl` value).

---

### 4.4 Reset Password Page (`reset-password`)

Matches `ui/reset-password.html`. Card `max-width: 380px` (wider than the 360px auth-layout default to accommodate the longer form).

**Template structure:**
1. Icon circle: key icon
2. Title: "Reset your password"
3. Email-or-phone field (single text input — matches current implementation)
4. Verification code field + Send code / countdown button
5. New password field + hint
6. Confirm password field + inline match validation message (green ✓ / red ✗)
7. "Reset password" button — disabled until code (6 digits) + passwords match
8. "← Back to sign in" link → `/login`

Existing TypeScript logic for `sendCode()`, countdown, and `onSubmit()` unchanged.

---

### 4.5 OAuth2 Consent Page (`oauth2-consent`)

Matches `ui/consent.html`.

**Template structure:**
1. Standalone page — own `#F2F2F5` background (not inside auth-layout)
2. Header: two icon circles (apps + shield-check) connected by arrows-exchange icon
3. Title: `"[clientId] wants to access your account"`
4. Subtitle: `"Signed in as [userEmail]"` — inject `AuthService`, read `currentUser()?.email ?? currentUser()?.username`
5. Scope list: bordered box, each scope as `mat-icon` + text row with `0.5px` dividers
6. Footer note: "By continuing, you'll be redirected to [clientId]. You can revoke access anytime."
7. Two buttons: Cancel (outlined, calls `deny()`) + Allow (indigo filled, calls `authorize()`)

Scope icon mapping: `openid` → person, `profile` → user, `email` → mail, default → check-circle.

---

### 4.6 Account Shell (`account-shell`)

Matches `ui/personal-center.html` layout.

**Replaces:** mat-toolbar + mat-tab-nav-bar

**New layout:**
```
┌─ top bar ──────────────────────────────────────────────┐
│  🛡 flyingjack cloud        [username]  [logout]  中/EN │
└────────────────────────────────────────────────────────┘
┌─ #F2F2F5 content area ─────────────────────────────────┐
│  ┌─ sidebar 160px ─┐  ┌─ main content ───────────────┐ │
│  │  👤 Profile      │  │  <router-outlet>             │ │
│  │  🔒 Security     │  │                              │ │
│  └─────────────────┘  └──────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

- Top bar: white, `0.5px solid #E8E8ED` bottom border, 56px height
- Sidebar nav items: `border-radius: 8px`, active = `#EEEDFE` bg + `#3C3489` text + icon
- Content area: `flex: 1`, cards use the same white + border style

---

### 4.7 Profile Page (`profile`)

Matches `ui/personal-center.html` — Profile tab cards.

**Cards:**

**Avatar card:**
- 52×52 initials circle (`#EEEDFE` bg, `#534AB7` text, initials from `username`) + display name + "Member since [year]" (derived from `user()?.createdAt | date:'yyyy'`) + Edit button (non-functional placeholder)

**Sign-in identifiers card:**
- Title: "Sign-in identifiers" + subtitle
- Username row: `@` icon + label/value + Change button (opens existing edit inline form)
- Email row: mail icon + label/value + Verified/Unverified badge + Change button (non-functional)
- Phone row: mobile icon + label/value + Verified/Unverified badge + Verify button (non-functional)

**Linked accounts card:**
- Google row: Google icon + "Connected as [email]" + Connected badge (non-functional)
- GitHub row: GitHub icon + "Not connected" + Connect button (non-functional)

Badges: pill shape, `border-radius: 999px`, green (`#E1F5EE`/`#0F6E56`) for verified/connected, amber (`#FCF0DB`/`#8A5A00`) for unverified.

---

### 4.8 Security Page (`security`)

Matches `ui/personal-center.html` — Security card.

The current security page is a change-password form. It is redesigned as a card that contains:
1. A non-functional **Active sessions** info row at the top (devices icon + "Active sessions" label + "2 devices signed in" hardcoded text + Manage button → `console.warn`)
2. Divider
3. The existing change-password form (oldPassword + newPassword + submit) restyled with new tokens

**No new backend wiring** — "Active sessions" data is hardcoded placeholder text.

---

## 5. Shared Components Restyling

### `sh-error-alert`
- Replace blue error styling with danger palette (`#C4314B` text, light red bg)

### `sh-loading-button`
- Primary state: `background: #534AB7`, white text, `border-radius: 8px`
- Disabled: `opacity: 0.5`
- No gradient

### `sh-captcha-field`
- Restyle border and focus colors to match new tokens

---

## 6. Scope Boundaries

| Area | In scope | Out of scope |
|---|---|---|
| `auth-portal` styles + templates | ✅ | |
| `admin-portal` | | ✅ (untouched) |
| TypeScript component logic | | ✅ (untouched) |
| Social login backend | | ✅ (UI only, `console.warn`) |
| Phone country selector backend | | ✅ (UI only) |
| OTP 6-box input (`otp-verification.html`) | | ✅ not added — no corresponding page exists; register keeps single text input for code |
| Sessions management | | ✅ (`console.warn`) |
| Social connect/disconnect | | ✅ (`console.warn`) |
| API.md, interceptors, guards | | ✅ (untouched) |

---

## 7. File Change Map

| File | Change |
|---|---|
| `projects/auth-portal/src/styles.scss` | Full token + Material theme replacement |
| `auth-layout/auth-layout.component.{html,scss}` | New flat background, brand, lang toggle |
| `login/login.component.{html,scss,ts}` | New template + `activeMethod` signal |
| `register/register.component.{html,scss}` | New template |
| `reset-password/reset-password.component.{html,scss}` | New template |
| `oauth2-consent/oauth2-consent.component.{html,scss}` | New template |
| `account/account-shell/account-shell.component.{html,scss}` | Sidebar layout |
| `account/profile/profile.component.{html,scss}` | New cards |
| `account/security/security.component.{html,scss}` | New card |
| `core/services/lang.service.ts` | New — ngx-translate wrapper |
| `app.config.ts` | TranslateModule + HttpLoaderFactory |
| `assets/i18n/zh.json` | New — Chinese translations |
| `assets/i18n/en.json` | New — English translations |
| `shared/components/error-alert/` | Restyle |
| `shared/components/loading-button/` | Restyle |
| `shared/components/captcha-field/` | Restyle |

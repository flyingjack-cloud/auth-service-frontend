# Captcha Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up third-party-service captcha APIs — image captcha for login retry gating and SMS/email code captcha for register and reset-password.

**Architecture:** The shared `api.interceptor` gains a routing branch that sends `/captcha/` requests to `thirdPartyBaseUrl` instead of `apiBaseUrl`. A new `CaptchaService` provides three typed methods. Two new components (`ImageCaptchaFieldComponent`, `CodeCaptchaFieldComponent`) replace the existing stub and the inline send-code logic in register/reset-password.

**Tech Stack:** Angular 17+ standalone components, Angular Signals (`signal`, `computed`, `input`, `output`, `effect`), `@angular/core/rxjs-interop` (`takeUntilDestroyed`), `@ngx-translate/core` (`TranslatePipe`), Jasmine + `HttpTestingController`, `fakeAsync`/`tick`.

## Global Constraints

- All new shared code lives under `projects/shared/src/lib/`.
- All new auth-portal code lives under `projects/auth-portal/src/app/features/`.
- Use `input.required<T>()` / `output<T>()` from `@angular/core` (signals API).
- Every component is `standalone: true`.
- HTTP paths are always relative (interceptor adds base URL).
- i18n: use `TranslatePipe` from `@ngx-translate/core`; key namespace `captcha.*`.
- Test runner: `ng test --include='**/<file>.spec.ts'`; use `fakeAsync`/`tick` for timer tests.

---

### Task 1: Environment token + auth-portal environments + interceptor routing

**Files:**
- Modify: `projects/shared/src/lib/tokens/environment.token.ts`
- Modify: `projects/shared/src/lib/interceptors/api.interceptor.ts`
- Modify: `projects/shared/src/lib/interceptors/api.interceptor.spec.ts`
- Modify: `projects/auth-portal/src/environments/environment.development.ts`
- Modify: `projects/auth-portal/src/environments/environment.ts`

**Interfaces:**
- Produces: `Environment.thirdPartyBaseUrl?: string` — consumed by interceptor and every downstream task that reads the environment.

- [ ] **Step 1: Add failing interceptor tests for `/captcha/` routing**

Append to the existing `describe('apiInterceptor', ...)` block in `api.interceptor.spec.ts`. The `ENV` constant at the top of the file becomes `ENV_AUTH`. Add a new describe block below the existing one:

```typescript
const ENV_FULL = {
  apiBaseUrl: 'http://localhost:9001',
  thirdPartyBaseUrl: 'http://localhost:7100',
};

describe('apiInterceptor — third-party routing', () => {
  let http: HttpClient;
  let mock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        { provide: ENVIRONMENT, useValue: ENV_FULL },
      ],
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  it('routes /captcha/ paths to thirdPartyBaseUrl', () => {
    http.get('/captcha/generate/image').subscribe();
    const req = mock.expectOne('http://localhost:7100/captcha/generate/image');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ code: 200, message: 'OK', data: { uuid: 'u', base64Image: 'b' }, timestamp: 0 });
  });

  it('still routes non-captcha paths to apiBaseUrl', () => {
    http.get('/account/profile').subscribe();
    const req = mock.expectOne('http://localhost:9001/account/profile');
    req.flush({ code: 200, message: 'OK', data: null, timestamp: 0 });
  });

  it('falls back to apiBaseUrl for /captcha/ when thirdPartyBaseUrl is absent', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        { provide: ENVIRONMENT, useValue: { apiBaseUrl: 'http://localhost:9001' } },
      ],
    });
    const h = TestBed.inject(HttpClient);
    const m = TestBed.inject(HttpTestingController);
    h.get('/captcha/generate/image').subscribe();
    const req = m.expectOne('http://localhost:9001/captcha/generate/image');
    req.flush({ code: 200, message: 'OK', data: null, timestamp: 0 });
    m.verify();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
ng test --include='**/api.interceptor.spec.ts'
```

Expected: 3 new tests FAIL ("Unexpected request", "No pending requests").

- [ ] **Step 3: Add `thirdPartyBaseUrl` to Environment interface**

Replace the entire content of `projects/shared/src/lib/tokens/environment.token.ts`:

```typescript
import { InjectionToken } from '@angular/core';

export interface Environment {
  apiBaseUrl: string;
  thirdPartyBaseUrl?: string;
}

export const ENVIRONMENT = new InjectionToken<Environment>('ENVIRONMENT');
```

- [ ] **Step 4: Update the interceptor to route `/captcha/` paths**

Replace the entire content of `projects/shared/src/lib/interceptors/api.interceptor.ts`:

```typescript
import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ENVIRONMENT } from '../tokens/environment.token';
import { ApiResponse } from '../models/api-response.model';
import { ApiError } from '../models/api-error.model';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const env = inject(ENVIRONMENT);

  const isThirdParty = req.url.startsWith('/captcha/') && !!env.thirdPartyBaseUrl;
  const baseUrl = isThirdParty ? env.thirdPartyBaseUrl! : env.apiBaseUrl;

  const apiReq = req.clone({
    url: `${baseUrl.replace(/\/$/, '')}${req.url}`,
    withCredentials: true,
  });

  return next(apiReq).pipe(
    map(event => {
      if (event instanceof HttpResponse && event.body !== null) {
        const body = event.body as ApiResponse<unknown>;
        return event.clone({ body: body.data });
      }
      return event;
    }),
    catchError(error => {
      const err = error.error ?? {};
      const errorId: string = err['errorId'] ?? 'error.system.fail';
      const message: string = err['message'] ?? 'An unexpected error occurred';
      return throwError(() => new ApiError(errorId, message, error.status ?? 0));
    })
  );
};
```

- [ ] **Step 5: Update auth-portal environments**

`projects/auth-portal/src/environments/environment.development.ts`:
```typescript
export const environment = {
  apiBaseUrl: 'http://localhost:9001',
  apiPrefix: '',
  thirdPartyBaseUrl: 'http://localhost:7100',
};
```

`projects/auth-portal/src/environments/environment.ts`:
```typescript
export const environment = {
  apiBaseUrl: 'https://auth.flyingjack.top',
  apiPrefix: '/api',
  thirdPartyBaseUrl: 'https://api.flyingjack.top/third',
};
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
ng test --include='**/api.interceptor.spec.ts'
```

Expected: All tests PASS including the 3 new ones.

- [ ] **Step 7: Commit**

```bash
git add projects/shared/src/lib/tokens/environment.token.ts \
        projects/shared/src/lib/interceptors/api.interceptor.ts \
        projects/shared/src/lib/interceptors/api.interceptor.spec.ts \
        projects/auth-portal/src/environments/environment.development.ts \
        projects/auth-portal/src/environments/environment.ts
git commit -m "feat: route /captcha/ requests to thirdPartyBaseUrl in api interceptor"
```

---

### Task 2: CaptchaService

**Files:**
- Create: `projects/shared/src/lib/services/captcha.service.ts`
- Create: `projects/shared/src/lib/services/captcha.service.spec.ts`
- Modify: `projects/shared/src/public-api.ts`

**Interfaces:**
- Produces:
  - `CaptchaService.getImageCaptcha(): Observable<{ uuid: string; base64Image: string }>`
  - `CaptchaService.sendSmsCaptcha(phone: string): Observable<boolean>`
  - `CaptchaService.sendEmailCaptcha(email: string): Observable<boolean>`

- [ ] **Step 1: Write the failing spec**

Create `projects/shared/src/lib/services/captcha.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CaptchaService } from './captcha.service';

describe('CaptchaService', () => {
  let service: CaptchaService;
  let mock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CaptchaService);
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  it('getImageCaptcha sends GET /captcha/generate/image', () => {
    let result: any;
    service.getImageCaptcha().subscribe(r => (result = r));
    const req = mock.expectOne('/captcha/generate/image');
    expect(req.request.method).toBe('GET');
    req.flush({ uuid: 'abc-123', base64Image: 'iVBORw0=' });
    expect(result).toEqual({ uuid: 'abc-123', base64Image: 'iVBORw0=' });
  });

  it('sendSmsCaptcha sends GET /captcha/generate/sms with phone param', () => {
    let result: boolean | undefined;
    service.sendSmsCaptcha('13800000000').subscribe(r => (result = r));
    const req = mock.expectOne(r => r.url === '/captcha/generate/sms');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('phone')).toBe('13800000000');
    req.flush(true);
    expect(result).toBeTrue();
  });

  it('sendEmailCaptcha sends GET /captcha/generate/mail with email param', () => {
    let result: boolean | undefined;
    service.sendEmailCaptcha('user@example.com').subscribe(r => (result = r));
    const req = mock.expectOne(r => r.url === '/captcha/generate/mail');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('email')).toBe('user@example.com');
    req.flush(true);
    expect(result).toBeTrue();
  });
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
ng test --include='**/captcha.service.spec.ts'
```

Expected: FAIL — "CaptchaService is not defined".

- [ ] **Step 3: Implement CaptchaService**

Create `projects/shared/src/lib/services/captcha.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface ImageCaptchaData {
  uuid: string;
  base64Image: string;
}

@Injectable({ providedIn: 'root' })
export class CaptchaService {
  private readonly http = inject(HttpClient);

  getImageCaptcha() {
    return this.http.get<ImageCaptchaData>('/captcha/generate/image');
  }

  sendSmsCaptcha(phone: string) {
    return this.http.get<boolean>('/captcha/generate/sms', { params: { phone } });
  }

  sendEmailCaptcha(email: string) {
    return this.http.get<boolean>('/captcha/generate/mail', { params: { email } });
  }
}
```

- [ ] **Step 4: Export from public-api.ts**

Add to `projects/shared/src/public-api.ts` (after the existing service exports):

```typescript
export * from './lib/services/captcha.service';
```

- [ ] **Step 5: Run tests to confirm PASS**

```bash
ng test --include='**/captcha.service.spec.ts'
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add projects/shared/src/lib/services/captcha.service.ts \
        projects/shared/src/lib/services/captcha.service.spec.ts \
        projects/shared/src/public-api.ts
git commit -m "feat: add CaptchaService for third-party captcha generation endpoints"
```

---

### Task 3: ImageCaptchaFieldComponent

**Files:**
- Create: `projects/shared/src/lib/components/image-captcha-field/image-captcha-field.component.ts`
- Create: `projects/shared/src/lib/components/image-captcha-field/image-captcha-field.component.spec.ts`
- Modify: `projects/shared/src/public-api.ts`

**Interfaces:**
- Consumes: `CaptchaService.getImageCaptcha()` from Task 2.
- Produces: `ImageCaptchaFieldComponent` with selector `sh-image-captcha-field`
  - Input: `control = input.required<FormControl>()`
  - Output: `captchaId = output<string>()` — emits uuid each time a new image loads
  - Public method: `refresh()` — re-fetches image and resets control

- [ ] **Step 1: Write the failing spec**

Create `projects/shared/src/lib/components/image-captcha-field/image-captcha-field.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { CaptchaService } from '../../services/captcha.service';
import { ImageCaptchaFieldComponent } from './image-captcha-field.component';

const dummyLoader = { getTranslation: () => of({}) };

describe('ImageCaptchaFieldComponent', () => {
  let mockCaptchaService: { getImageCaptcha: jasmine.Spy };

  const setup = async (getImageCaptchaReturn = of({ uuid: 'uuid-1', base64Image: 'abc=' })) => {
    mockCaptchaService = {
      getImageCaptcha: jasmine.createSpy('getImageCaptcha').and.returnValue(getImageCaptchaReturn),
    };
    await TestBed.configureTestingModule({
      imports: [ImageCaptchaFieldComponent],
      providers: [
        provideAnimationsAsync(),
        provideTranslateService({ loader: { provide: TranslateLoader, useValue: dummyLoader } }),
        { provide: CaptchaService, useValue: mockCaptchaService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ImageCaptchaFieldComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('control', new FormControl(''));
    return { fixture, component };
  };

  it('calls getImageCaptcha on init', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();
    expect(mockCaptchaService.getImageCaptcha).toHaveBeenCalledTimes(1);
  });

  it('sets imageDataUrl from base64Image on success', async () => {
    const { fixture, component } = await setup();
    fixture.detectChanges();
    expect(component.imageDataUrl()).toBe('data:image/png;base64,abc=');
  });

  it('emits captchaId with uuid on success', async () => {
    const { fixture, component } = await setup();
    const emitted: string[] = [];
    component.captchaId.subscribe(id => emitted.push(id));
    fixture.detectChanges();
    expect(emitted).toEqual(['uuid-1']);
  });

  it('sets loading to false after success', async () => {
    const { fixture, component } = await setup();
    fixture.detectChanges();
    expect(component.loading()).toBeFalse();
  });

  it('sets error to true on fetch failure', async () => {
    const { fixture, component } = await setup(throwError(() => new Error('network')));
    fixture.detectChanges();
    expect(component.error()).toBeTrue();
    expect(component.loading()).toBeFalse();
  });

  it('refresh re-fetches and emits new uuid', async () => {
    const { fixture, component } = await setup();
    const emitted: string[] = [];
    component.captchaId.subscribe(id => emitted.push(id));
    fixture.detectChanges(); // first fetch → uuid-1

    mockCaptchaService.getImageCaptcha.and.returnValue(of({ uuid: 'uuid-2', base64Image: 'xyz=' }));
    component.refresh();

    expect(emitted).toEqual(['uuid-1', 'uuid-2']);
    expect(component.imageDataUrl()).toBe('data:image/png;base64,xyz=');
  });

  it('refresh resets the bound FormControl', async () => {
    const { fixture, component } = await setup();
    const ctrl = new FormControl('old-value');
    fixture.componentRef.setInput('control', ctrl);
    fixture.detectChanges();

    component.refresh();
    expect(ctrl.value).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
ng test --include='**/image-captcha-field.component.spec.ts'
```

Expected: FAIL — "ImageCaptchaFieldComponent is not defined".

- [ ] **Step 3: Implement ImageCaptchaFieldComponent**

Create `projects/shared/src/lib/components/image-captcha-field/image-captcha-field.component.ts`:

```typescript
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { CaptchaService } from '../../services/captcha.service';

@Component({
  selector: 'sh-image-captcha-field',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, MatProgressSpinnerModule, TranslatePipe],
  styles: [`
    .captcha-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .captcha-img { height: 40px; border-radius: 4px; cursor: pointer; }
    .captcha-refresh { background: none; border: none; cursor: pointer; padding: 4px; color: #555; }
    .captcha-error { font-size: 12px; color: #c00; }
    .text-input { width: 100%; box-sizing: border-box; }
  `],
  template: `
    <div class="captcha-row">
      @if (loading()) {
        <mat-spinner diameter="40" />
      } @else if (error()) {
        <span class="captcha-error">{{ 'captcha.loadFailed' | translate }}</span>
        <button type="button" class="captcha-refresh" (click)="refresh()">
          <mat-icon>refresh</mat-icon>
        </button>
      } @else {
        <img [src]="imageDataUrl()" alt="captcha" class="captcha-img" />
        <button type="button" class="captcha-refresh" (click)="refresh()" [title]="'captcha.refresh' | translate">
          <mat-icon>refresh</mat-icon>
        </button>
      }
    </div>
    <input
      class="text-input"
      [formControl]="control()"
      autocomplete="off"
      [placeholder]="'captcha.imagePlaceholder' | translate"
    />
  `,
})
export class ImageCaptchaFieldComponent implements OnInit {
  private readonly captchaService = inject(CaptchaService);

  control = input.required<FormControl>();
  captchaId = output<string>();

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly imageDataUrl = signal('');

  ngOnInit(): void {
    this.fetchImage();
  }

  refresh(): void {
    this.control().reset();
    this.fetchImage();
  }

  private fetchImage(): void {
    this.loading.set(true);
    this.error.set(false);
    this.captchaService.getImageCaptcha().subscribe({
      next: ({ uuid, base64Image }) => {
        this.imageDataUrl.set(`data:image/png;base64,${base64Image}`);
        this.captchaId.emit(uuid);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
```

- [ ] **Step 4: Export from public-api.ts**

Add after the existing captcha-field export line in `projects/shared/src/public-api.ts`:

```typescript
export * from './lib/components/image-captcha-field/image-captcha-field.component';
```

- [ ] **Step 5: Run tests to confirm PASS**

```bash
ng test --include='**/image-captcha-field.component.spec.ts'
```

Expected: 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add projects/shared/src/lib/components/image-captcha-field/ \
        projects/shared/src/public-api.ts
git commit -m "feat: add ImageCaptchaFieldComponent for login image captcha flow"
```

---

### Task 4: CodeCaptchaFieldComponent

**Files:**
- Create: `projects/shared/src/lib/components/code-captcha-field/code-captcha-field.component.ts`
- Create: `projects/shared/src/lib/components/code-captcha-field/code-captcha-field.component.spec.ts`
- Modify: `projects/shared/src/public-api.ts`

**Interfaces:**
- Consumes: `CaptchaService.sendSmsCaptcha()`, `CaptchaService.sendEmailCaptcha()` from Task 2; `ApiError` from shared models.
- Produces: `CodeCaptchaFieldComponent` with selector `sh-code-captcha-field`
  - Input: `control = input.required<FormControl>()` — the 6-digit code FormControl from parent
  - Input: `type = input.required<'phone' | 'email'>()`
  - Input: `principal = input.required<string>()` — phone number or email address
  - Internal signals: `sending`, `countdown`, `sendError`, `canSend`

- [ ] **Step 1: Write the failing spec**

Create `projects/shared/src/lib/components/code-captcha-field/code-captcha-field.component.spec.ts`:

```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ApiError } from '../../models/api-error.model';
import { CaptchaService } from '../../services/captcha.service';
import { CodeCaptchaFieldComponent } from './code-captcha-field.component';

const dummyLoader = { getTranslation: () => of({}) };

describe('CodeCaptchaFieldComponent', () => {
  let mockCaptchaService: {
    sendSmsCaptcha: jasmine.Spy;
    sendEmailCaptcha: jasmine.Spy;
  };

  const setup = async (type: 'phone' | 'email' = 'email', principal = 'u@example.com') => {
    mockCaptchaService = {
      sendSmsCaptcha: jasmine.createSpy('sendSmsCaptcha'),
      sendEmailCaptcha: jasmine.createSpy('sendEmailCaptcha'),
    };
    await TestBed.configureTestingModule({
      imports: [CodeCaptchaFieldComponent],
      providers: [
        provideAnimationsAsync(),
        provideTranslateService({ loader: { provide: TranslateLoader, useValue: dummyLoader } }),
        { provide: CaptchaService, useValue: mockCaptchaService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CodeCaptchaFieldComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('control', new FormControl(''));
    fixture.componentRef.setInput('type', type);
    fixture.componentRef.setInput('principal', principal);
    fixture.detectChanges();
    return { fixture, component };
  };

  it('canSend is true initially', async () => {
    const { component } = await setup();
    expect(component.canSend()).toBeTrue();
  });

  it('canSend is false while sending', async () => {
    mockCaptchaService.sendEmailCaptcha.and.returnValue(of(true));
    const { component } = await setup('email');
    component.sending.set(true);
    expect(component.canSend()).toBeFalse();
  });

  it('send calls sendEmailCaptcha with principal for email type', async () => {
    mockCaptchaService.sendEmailCaptcha.and.returnValue(of(true));
    const { component } = await setup('email', 'u@example.com');
    component.send();
    expect(mockCaptchaService.sendEmailCaptcha).toHaveBeenCalledWith('u@example.com');
    expect(mockCaptchaService.sendSmsCaptcha).not.toHaveBeenCalled();
  });

  it('send calls sendSmsCaptcha with principal for phone type', async () => {
    mockCaptchaService.sendSmsCaptcha.and.returnValue(of(true));
    const { component } = await setup('phone', '13800000000');
    component.send();
    expect(mockCaptchaService.sendSmsCaptcha).toHaveBeenCalledWith('13800000000');
    expect(mockCaptchaService.sendEmailCaptcha).not.toHaveBeenCalled();
  });

  it('starts a 30-second countdown for email', fakeAsync(async () => {
    mockCaptchaService.sendEmailCaptcha.and.returnValue(of(true));
    const { component } = await setup('email');
    component.send();
    expect(component.countdown()).toBe(30);
    tick(30000);
    expect(component.countdown()).toBe(0);
  }));

  it('starts a 60-second countdown for phone', fakeAsync(async () => {
    mockCaptchaService.sendSmsCaptcha.and.returnValue(of(true));
    const { component } = await setup('phone', '13800000000');
    component.send();
    expect(component.countdown()).toBe(60);
    tick(60000);
    expect(component.countdown()).toBe(0);
  }));

  it('canSend is false during countdown', fakeAsync(async () => {
    mockCaptchaService.sendEmailCaptcha.and.returnValue(of(true));
    const { component } = await setup('email');
    component.send();
    expect(component.canSend()).toBeFalse();
    tick(30000);
    expect(component.canSend()).toBeTrue();
  }));

  it('sets captcha.tooManyRequests on 429 error', async () => {
    mockCaptchaService.sendEmailCaptcha.and.returnValue(
      throwError(() => new ApiError('error.system', 'Too many', 429)),
    );
    const { component } = await setup('email');
    component.send();
    expect(component.sendError()).toBe('captcha.tooManyRequests');
  });

  it('sets captcha.sendFailed on non-429 error', async () => {
    mockCaptchaService.sendEmailCaptcha.and.returnValue(
      throwError(() => new ApiError('error.system.fail', 'Error', 500)),
    );
    const { component } = await setup('email');
    component.send();
    expect(component.sendError()).toBe('captcha.sendFailed');
  });

  it('does nothing when principal is empty', async () => {
    const { component } = await setup('email', '');
    component.send();
    expect(mockCaptchaService.sendEmailCaptcha).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
ng test --include='**/code-captcha-field.component.spec.ts'
```

Expected: FAIL — "CodeCaptchaFieldComponent is not defined".

- [ ] **Step 3: Implement CodeCaptchaFieldComponent**

Create `projects/shared/src/lib/components/code-captcha-field/code-captcha-field.component.ts`:

```typescript
import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { interval } from 'rxjs';
import { take } from 'rxjs/operators';
import { ApiError } from '../../models/api-error.model';
import { CaptchaService } from '../../services/captcha.service';

@Component({
  selector: 'sh-code-captcha-field',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  styles: [`
    .field-code-row { display: flex; gap: 8px; align-items: center; }
    .send-code-btn { white-space: nowrap; flex-shrink: 0; }
    .field-error { color: #c00; font-size: 12px; margin: 4px 0 0; }
  `],
  template: `
    <div class="field-code-row">
      <input
        class="text-input"
        [formControl]="control()"
        maxlength="6"
        autocomplete="one-time-code"
        placeholder="6-digit code"
        style="flex:1;min-width:0;"
      />
      <button
        class="send-code-btn"
        type="button"
        [disabled]="!canSend()"
        (click)="send()"
      >
        @if (countdown() > 0) {
          {{ 'captcha.resend' | translate: { s: countdown() } }}
        } @else {
          {{ 'captcha.sendCode' | translate }}
        }
      </button>
    </div>
    @if (sendError()) {
      <p class="field-error">{{ sendError()! | translate }}</p>
    }
  `,
})
export class CodeCaptchaFieldComponent {
  private readonly captchaService = inject(CaptchaService);
  private readonly destroyRef = inject(DestroyRef);

  control = input.required<FormControl>();
  type = input.required<'phone' | 'email'>();
  principal = input.required<string>();

  readonly sending = signal(false);
  readonly countdown = signal(0);
  readonly sendError = signal<string | null>(null);
  readonly canSend = computed(() => this.countdown() === 0 && !this.sending());

  constructor() {
    effect(() => {
      this.principal(); // track; reset countdown when principal changes
      this.countdown.set(0);
      this.sendError.set(null);
    });
  }

  send(): void {
    const p = this.principal();
    if (!p || !this.canSend()) return;

    this.sending.set(true);
    this.sendError.set(null);

    const req$ = this.type() === 'phone'
      ? this.captchaService.sendSmsCaptcha(p)
      : this.captchaService.sendEmailCaptcha(p);

    req$.subscribe({
      next: () => {
        this.sending.set(false);
        this.startCountdown(this.type() === 'phone' ? 60 : 30);
      },
      error: (err: ApiError) => {
        this.sending.set(false);
        this.sendError.set(err.httpStatus === 429 ? 'captcha.tooManyRequests' : 'captcha.sendFailed');
      },
    });
  }

  private startCountdown(seconds: number): void {
    this.countdown.set(seconds);
    interval(1000)
      .pipe(take(seconds), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.countdown.update(s => Math.max(0, s - 1)));
  }
}
```

- [ ] **Step 4: Export from public-api.ts**

Add to `projects/shared/src/public-api.ts`:

```typescript
export * from './lib/components/code-captcha-field/code-captcha-field.component';
```

- [ ] **Step 5: Run tests to confirm PASS**

```bash
ng test --include='**/code-captcha-field.component.spec.ts'
```

Expected: 9 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add projects/shared/src/lib/components/code-captcha-field/ \
        projects/shared/src/public-api.ts
git commit -m "feat: add CodeCaptchaFieldComponent for SMS/email code verification"
```

---

### Task 5: i18n captcha keys

**Files:**
- Modify: `projects/auth-portal/public/assets/i18n/zh.json`
- Modify: `projects/auth-portal/public/assets/i18n/en.json`
- Modify: `projects/auth-portal/src/assets/i18n/zh.json`
- Modify: `projects/auth-portal/src/assets/i18n/en.json`

**Interfaces:** None — pure data.

- [ ] **Step 1: Add captcha keys to zh.json (both copies)**

In both `public/assets/i18n/zh.json` and `src/assets/i18n/zh.json`, add the `"captcha"` object as a top-level key (e.g. after `"login"`):

```json
"captcha": {
  "refresh": "刷新验证码",
  "imagePlaceholder": "请输入图中文字",
  "loadFailed": "加载失败，点击刷新",
  "sendCode": "发送验证码",
  "resend": "重新发送 ({{s}}s)",
  "sendFailed": "发送失败，请重试",
  "tooManyRequests": "请求太频繁，请稍后再试"
},
```

- [ ] **Step 2: Add captcha keys to en.json (both copies)**

In both `public/assets/i18n/en.json` and `src/assets/i18n/en.json`:

```json
"captcha": {
  "refresh": "Refresh captcha",
  "imagePlaceholder": "Enter the text shown",
  "loadFailed": "Load failed — click to retry",
  "sendCode": "Send code",
  "resend": "Resend ({{s}}s)",
  "sendFailed": "Send failed, please retry",
  "tooManyRequests": "Too many requests, please wait"
},
```

- [ ] **Step 3: Commit**

```bash
git add projects/auth-portal/public/assets/i18n/ \
        projects/auth-portal/src/assets/i18n/
git commit -m "feat: add captcha i18n keys for zh and en"
```

---

### Task 6: Login — wire ImageCaptchaFieldComponent

**Files:**
- Modify: `projects/auth-portal/src/app/features/login/login.component.ts`
- Modify: `projects/auth-portal/src/app/features/login/login.component.html`
- Modify: `projects/auth-portal/src/app/features/login/login.component.spec.ts`
- Modify: `projects/shared/src/public-api.ts` (remove old CaptchaFieldComponent export)
- Delete: `projects/shared/src/lib/components/captcha-field/captcha-field.component.ts`

**Interfaces:**
- Consumes: `ImageCaptchaFieldComponent` (`sh-image-captcha-field`) from Task 3; `CaptchaService` from Task 2 (needed as provider in spec).

- [ ] **Step 1: Update login spec — add CaptchaService mock and captcha submission test**

In `login.component.spec.ts`, make these changes:

1. Add import at the top:
```typescript
import { CaptchaService } from '@shared';
```

2. In `beforeEach`, add `mockCaptchaService` and provide it:
```typescript
const mockCaptchaService = {
  getImageCaptcha: jasmine.createSpy('getImageCaptcha').and.returnValue(
    of({ uuid: 'test-uuid', base64Image: 'abc=' })
  ),
};
// Inside providers array:
{ provide: CaptchaService, useValue: mockCaptchaService },
```

3. Add a new test in the `onSubmit` section:
```typescript
it('onSubmit passes captchaUuid and captchaToken as captcha when showCaptcha is true', () => {
  mockAuthService.login.and.returnValue(of(makeUser()));
  component.failCount.set(3);
  component.captchaUuid.set('test-uuid');
  component.form.patchValue({ principal: 'alice', password: 'secret123', captchaToken: 'ABC123' });
  component.onSubmit();
  expect(mockAuthService.login).toHaveBeenCalledWith(
    { loginType: 'username', principal: 'alice', password: 'secret123' },
    { id: 'test-uuid', token: 'ABC123' },
  );
});
```

- [ ] **Step 2: Run spec to confirm the new test FAILS**

```bash
ng test auth-portal --include='**/login.component.spec.ts'
```

Expected: 1 new test FAIL — `captchaUuid` does not exist on component.

- [ ] **Step 3: Update login.component.ts**

Replace the entire file content:

```typescript
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
```

- [ ] **Step 4: Update login.component.html — replace sh-captcha-field block**

In `login.component.html`, replace lines 51–53:

```html
    @if (showCaptcha()) {
      <sh-captcha-field [control]="captchaControl" [captchaId]="form.value.principal ?? ''" />
    }
```

with:

```html
    @if (showCaptcha()) {
      <sh-image-captcha-field
        [control]="captchaControl"
        (captchaId)="captchaUuid.set($event)"
      />
    }
```

- [ ] **Step 5: Remove old CaptchaFieldComponent stub and update public-api.ts**

In `projects/shared/src/public-api.ts`, remove the line:
```typescript
export * from './lib/components/captcha-field/captcha-field.component';
```

Stage the deletion of the old stub (this also removes it from disk):
```bash
git rm projects/shared/src/lib/components/captcha-field/captcha-field.component.ts
```

- [ ] **Step 6: Run all specs to confirm PASS**

```bash
ng test auth-portal --include='**/login.component.spec.ts'
```

Expected: All existing tests + 1 new test PASS.

- [ ] **Step 7: Commit**

```bash
git add projects/auth-portal/src/app/features/login/ \
        projects/shared/src/public-api.ts
git commit -m "feat: wire login to ImageCaptchaFieldComponent, use uuid as X-Captcha-ID"
```

---

### Task 7: Register — wire CodeCaptchaFieldComponent

**Files:**
- Modify: `projects/auth-portal/src/app/features/register/register.component.ts`
- Modify: `projects/auth-portal/src/app/features/register/register.component.html`
- Modify: `projects/auth-portal/src/app/features/register/register.component.spec.ts`

**Interfaces:**
- Consumes: `CodeCaptchaFieldComponent` (`sh-code-captcha-field`) from Task 4.

- [ ] **Step 1: Update register spec — remove send-code tests, remove sendVerificationCode mock**

Replace the entire `register.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AccountService, ApiError, CaptchaService } from '@shared';
import { RegisterComponent } from './register.component';

const dummyLoader = { getTranslation: () => of({}) };

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let mockAccountService: jasmine.SpyObj<Pick<AccountService,
    'register' | 'checkEmail' | 'checkPhone' | 'checkUsername'>>;
  let router: Router;

  beforeEach(async () => {
    mockAccountService = jasmine.createSpyObj('AccountService', [
      'register', 'checkEmail', 'checkPhone', 'checkUsername',
    ]);
    mockAccountService.checkEmail.and.returnValue(of(false));
    mockAccountService.checkPhone.and.returnValue(of(false));
    mockAccountService.checkUsername.and.returnValue(of(false));

    const mockCaptchaService = {
      sendSmsCaptcha: jasmine.createSpy().and.returnValue(of(true)),
      sendEmailCaptcha: jasmine.createSpy().and.returnValue(of(true)),
    };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        provideTranslateService({ loader: { provide: TranslateLoader, useValue: dummyLoader } }),
        { provide: AccountService, useValue: mockAccountService },
        { provide: CaptchaService, useValue: mockCaptchaService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  // ── registerType / switchMode ──────────────────────────────────────────────

  it('defaults to email mode', () => {
    expect(component.registerType()).toBe('email');
  });

  it('switchMode toggles to phone', () => {
    component.switchMode();
    expect(component.registerType()).toBe('phone');
  });

  it('switchMode toggles back to email', () => {
    component.switchMode();
    component.switchMode();
    expect(component.registerType()).toBe('email');
  });

  it('switchMode clears the principal field', () => {
    component.form.patchValue({ principal: 'test@test.com' });
    component.switchMode();
    expect(component.form.value.principal).toBe('');
  });

  it('switchMode clears errorMessage', () => {
    component.errorMessage.set('some error');
    component.switchMode();
    expect(component.errorMessage()).toBeNull();
  });

  // ── form validation ────────────────────────────────────────────────────────

  it('form is invalid when code is less than 6 chars', () => {
    component.form.patchValue({
      principal: 'user@example.com', code: '123', username: 'alice1', password: 'pass1234',
    });
    expect(component.form.invalid).toBeTrue();
  });

  it('form is valid when code is exactly 6 chars', () => {
    component.form.patchValue({
      principal: 'user@example.com', code: '123456', username: 'alice1', password: 'pass1234',
    });
    expect(component.form.valid).toBeTrue();
  });

  it('username control rejects values shorter than 5 chars', () => {
    component.form.patchValue({ username: 'abc' });
    expect(component.form.get('username')!.invalid).toBeTrue();
  });

  it('username control rejects uppercase letters', () => {
    component.form.patchValue({ username: 'Alice1' });
    expect(component.form.get('username')!.invalid).toBeTrue();
  });

  it('username control accepts valid lowercase alphanumeric', () => {
    component.form.patchValue({ username: 'alice1' });
    expect(component.form.get('username')!.valid).toBeTrue();
  });

  // ── onSubmit ───────────────────────────────────────────────────────────────

  it('onSubmit does nothing when form is invalid', () => {
    component.onSubmit();
    expect(mockAccountService.register).not.toHaveBeenCalled();
  });

  it('onSubmit calls account.register with correct payload', () => {
    mockAccountService.register.and.returnValue(of(null as any));
    component.form.patchValue({
      principal: 'user@example.com', code: '123456', username: 'alice1', password: 'pass1234',
    });
    component.onSubmit();
    expect(mockAccountService.register).toHaveBeenCalledWith({
      registerType: 'email',
      principal: 'user@example.com',
      password: 'pass1234',
      code: '123456',
    });
  });

  it('onSubmit navigates to /login on success', () => {
    const navigateSpy = spyOn(router, 'navigate');
    mockAccountService.register.and.returnValue(of(null as any));
    component.form.patchValue({
      principal: 'user@example.com', code: '123456', username: 'alice1', password: 'pass1234',
    });
    component.onSubmit();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  // ── error mapping ──────────────────────────────────────────────────────────

  const errorMappings: [string, string][] = [
    ['error.business.conflict',    'register.error.conflict'],
    ['error.common.param.invalid', 'register.error.invalidCode'],
    ['error.totally.unknown',      'register.error.default'],
  ];

  errorMappings.forEach(([errorId, expectedKey]) => {
    it(`maps ${errorId} → ${expectedKey}`, () => {
      mockAccountService.register.and.returnValue(
        throwError(() => new ApiError(errorId, 'msg', 400)),
      );
      component.form.patchValue({
        principal: 'user@example.com', code: '123456', username: 'alice1', password: 'pass1234',
      });
      component.onSubmit();
      expect(component.errorMessage()).toBe(expectedKey);
    });
  });
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
ng test auth-portal --include='**/register.component.spec.ts'
```

Expected: Tests that reference `sendVerificationCode`, `canSendCode`, `codeSending`, `codeCountdown` will now fail because the mock no longer provides `sendVerificationCode` — confirms we need to remove these from the component.

- [ ] **Step 3: Update register.component.ts — remove send-code logic**

Replace the entire file:

```typescript
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AccountService, ApiError, CodeCaptchaFieldComponent, ErrorAlertComponent } from '@shared';

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
    CodeCaptchaFieldComponent,
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
  readonly errorMessage = signal<string | null>(null);

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

  get codeControl(): FormControl {
    return this.form.get('code') as FormControl;
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

- [ ] **Step 4: Update register.component.html — replace inline send-code block**

Replace lines 35–51 (the `<label class="field-label">{{ 'register.label.code'...` block through `</div><p class="field-hint">{{ 'register.codeHint'...`):

```html
    <label class="field-label">{{ 'register.label.code' | translate }}</label>
    <sh-code-captcha-field
      [control]="codeControl"
      [type]="registerType()"
      [principal]="form.value.principal ?? ''"
    />
    <p class="field-hint">{{ 'register.codeHint' | translate }}</p>
```

- [ ] **Step 5: Run tests to confirm PASS**

```bash
ng test auth-portal --include='**/register.component.spec.ts'
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add projects/auth-portal/src/app/features/register/
git commit -m "feat: replace inline send-code logic in register with CodeCaptchaFieldComponent"
```

---

### Task 8: Reset-password — wire CodeCaptchaFieldComponent + AccountService cleanup

**Files:**
- Modify: `projects/auth-portal/src/app/features/reset-password/reset-password.component.ts`
- Modify: `projects/auth-portal/src/app/features/reset-password/reset-password.component.html`
- Modify: `projects/auth-portal/src/app/features/reset-password/reset-password.component.spec.ts`
- Modify: `projects/shared/src/lib/services/account.service.ts`

**Interfaces:**
- Consumes: `CodeCaptchaFieldComponent` from Task 4.
- `AccountService.sendVerificationCode` is removed (no longer called by any component).

- [ ] **Step 1: Update reset-password spec**

Replace the entire `reset-password.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AccountService, ApiError, CaptchaService } from '@shared';
import { ResetPasswordComponent } from './reset-password.component';

const dummyLoader = { getTranslation: () => of({}) };

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let mockAccountService: jasmine.SpyObj<Pick<AccountService, 'resetPassword'>>;
  let router: Router;

  beforeEach(async () => {
    mockAccountService = jasmine.createSpyObj('AccountService', ['resetPassword']);

    const mockCaptchaService = {
      sendSmsCaptcha: jasmine.createSpy().and.returnValue(of(true)),
      sendEmailCaptcha: jasmine.createSpy().and.returnValue(of(true)),
    };

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        provideTranslateService({ loader: { provide: TranslateLoader, useValue: dummyLoader } }),
        { provide: AccountService, useValue: mockAccountService },
        { provide: CaptchaService, useValue: mockCaptchaService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  // ── resetType ──────────────────────────────────────────────────────────────

  it('resetType returns email when principal contains @', () => {
    component.form.patchValue({ principal: 'u@example.com' });
    expect(component.resetType).toBe('email');
  });

  it('resetType returns phone when principal has no @', () => {
    component.form.patchValue({ principal: '13800000000' });
    expect(component.resetType).toBe('phone');
  });

  // ── passwordsMatch / passwordsMismatch ────────────────────────────────────

  it('passwordsMatch is true when both fields are identical', () => {
    component.form.patchValue({ password: 'abc12345', confirmPassword: 'abc12345' });
    expect(component.passwordsMatch).toBeTrue();
  });

  it('passwordsMismatch is true when fields differ', () => {
    component.form.patchValue({ password: 'abc12345', confirmPassword: 'different' });
    expect(component.passwordsMismatch).toBeTrue();
  });

  it('passwordsMatch and passwordsMismatch are both false when fields are empty', () => {
    expect(component.passwordsMatch).toBeFalse();
    expect(component.passwordsMismatch).toBeFalse();
  });

  // ── form validation ────────────────────────────────────────────────────────

  it('form is invalid when passwords mismatch', () => {
    component.form.patchValue({
      principal: 'u@example.com', code: '123456',
      password: 'pass1234', confirmPassword: 'different',
    });
    expect(component.form.invalid).toBeTrue();
  });

  it('form is valid when all fields are correct and passwords match', () => {
    component.form.patchValue({
      principal: 'u@example.com', code: '123456',
      password: 'pass1234', confirmPassword: 'pass1234',
    });
    expect(component.form.valid).toBeTrue();
  });

  // ── onSubmit ───────────────────────────────────────────────────────────────

  it('onSubmit does nothing when form is invalid', () => {
    component.onSubmit();
    expect(mockAccountService.resetPassword).not.toHaveBeenCalled();
  });

  it('onSubmit calls account.resetPassword with correct payload', () => {
    mockAccountService.resetPassword.and.returnValue(of(null));
    component.form.patchValue({
      principal: 'u@example.com', code: '123456',
      password: 'pass1234', confirmPassword: 'pass1234',
    });
    component.onSubmit();
    expect(mockAccountService.resetPassword).toHaveBeenCalledWith({
      registerType: 'email',
      principal: 'u@example.com',
      password: 'pass1234',
      code: '123456',
    });
  });

  it('onSubmit sets successMessage and clears loading on success', () => {
    mockAccountService.resetPassword.and.returnValue(of(null));
    component.form.patchValue({
      principal: 'u@example.com', code: '123456',
      password: 'pass1234', confirmPassword: 'pass1234',
    });
    component.onSubmit();
    expect(component.successMessage()).toBe('reset.success');
    expect(component.loading()).toBeFalse();
  });

  // ── error mapping ──────────────────────────────────────────────────────────

  const errorMappings: [string, string][] = [
    ['error.common.param.invalid', 'reset.error.invalidCode'],
    ['error.user.not-found',       'reset.error.notFound'],
    ['error.totally.unknown',      'reset.error.default'],
  ];

  errorMappings.forEach(([errorId, expectedKey]) => {
    it(`maps ${errorId} → ${expectedKey}`, () => {
      mockAccountService.resetPassword.and.returnValue(
        throwError(() => new ApiError(errorId, 'msg', 400)),
      );
      component.form.patchValue({
        principal: 'u@example.com', code: '123456',
        password: 'pass1234', confirmPassword: 'pass1234',
      });
      component.onSubmit();
      expect(component.errorMessage()).toBe(expectedKey);
    });
  });
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
ng test auth-portal --include='**/reset-password.component.spec.ts'
```

Expected: Tests that reference `sendCode`, `codeSending`, `canSendCode`, `codeSent`, `codeCountdown` will FAIL; other tests will PASS or compile-error due to `sendVerificationCode` being expected.

- [ ] **Step 3: Update reset-password.component.ts — remove send-code logic**

Replace the entire file:

```typescript
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { AccountService, ApiError, CodeCaptchaFieldComponent, ErrorAlertComponent } from '@shared';

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
    TranslatePipe,
    ErrorAlertComponent,
    CodeCaptchaFieldComponent,
  ],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

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

  get codeControl(): FormControl {
    return this.form.get('code') as FormControl;
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
}
```

- [ ] **Step 4: Update reset-password.component.html — replace inline send-code block**

Replace lines 23–45 (the `<label class="field-label">{{ 'reset.label.code'...` block through `@if (codeSent())...`):

```html
    <label class="field-label">{{ 'reset.label.code' | translate }}</label>
    <sh-code-captcha-field
      [control]="codeControl"
      [type]="resetType"
      [principal]="form.value.principal ?? ''"
    />
    <p class="field-hint">{{ 'reset.codeHint' | translate }}</p>
```

- [ ] **Step 5: Remove sendVerificationCode from AccountService**

In `projects/shared/src/lib/services/account.service.ts`, delete the `sendVerificationCode` method (lines 44–47):

```typescript
  sendVerificationCode(type: 'phone' | 'email', principal: string) {
    return this.http.post<null>('/account/send-code', { type, principal });
  }
```

Also remove unused imports if present (`RegisterRequest` etc. remain used by `register()`; only remove imports that become unused).

- [ ] **Step 6: Run all tests to confirm PASS**

```bash
ng test auth-portal --include='**/reset-password.component.spec.ts'
ng test --include='**/account.service*'
```

Expected: All tests PASS.

- [ ] **Step 7: Full test suite — confirm no regressions**

```bash
ng test
```

Expected: All tests PASS across shared, auth-portal, admin-portal.

- [ ] **Step 8: Commit**

```bash
git add projects/auth-portal/src/app/features/reset-password/ \
        projects/shared/src/lib/services/account.service.ts
git commit -m "feat: wire reset-password to CodeCaptchaFieldComponent, remove sendVerificationCode"
```

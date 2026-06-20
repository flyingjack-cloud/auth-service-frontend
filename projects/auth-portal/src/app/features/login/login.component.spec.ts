import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { computed, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ApiError, AuthService } from '@shared';
import { LoginComponent } from './login.component';
import { User } from '@shared';

const dummyLoader = { getTranslation: () => of({}) };

function makeUser(partial: Partial<User> = {}): User {
  return { id: '1', username: 'alice', phone: null, email: null, ...partial };
}

describe('LoginComponent', () => {
  let component: LoginComponent;
  let mockAuthService: { login: jasmine.Spy; currentUser: ReturnType<typeof signal<User | null>> };
  let router: Router;

  beforeEach(async () => {
    const currentUser = signal<User | null>(null);
    mockAuthService = {
      currentUser: currentUser as ReturnType<typeof signal<User | null>>,
      login: jasmine.createSpy('login'),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        provideTranslateService({ loader: { provide: TranslateLoader, useValue: dummyLoader } }),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  // ── altMethods ─────────────────────────────────────────────────────────────

  it('altMethods excludes the current loginType', () => {
    component.loginType.set('username');
    expect(component.altMethods()).not.toContain('username');
    expect(component.altMethods()).toContain('phone');
    expect(component.altMethods()).toContain('email');
  });

  it('altMethods always contains exactly 2 items', () => {
    (['username', 'phone', 'email'] as const).forEach(t => {
      component.loginType.set(t);
      expect(component.altMethods().length).toBe(2);
    });
  });

  // ── setMethod ──────────────────────────────────────────────────────────────

  it('setMethod updates loginType', () => {
    component.setMethod('email');
    expect(component.loginType()).toBe('email');
  });

  it('setMethod clears principal and captchaToken fields', () => {
    component.form.patchValue({ principal: 'test@test.com', captchaToken: 'tok' });
    component.setMethod('phone');
    expect(component.form.value.principal).toBe('');
    expect(component.form.value.captchaToken).toBe('');
  });

  it('setMethod clears errorMessage', () => {
    component.errorMessage.set('some error');
    component.setMethod('email');
    expect(component.errorMessage()).toBeNull();
  });

  // ── showCaptcha / showCooldown ─────────────────────────────────────────────

  it('showCaptcha is false when failCount < 3', () => {
    component.failCount.set(2);
    expect(component.showCaptcha()).toBeFalse();
  });

  it('showCaptcha is true when failCount is 3', () => {
    component.failCount.set(3);
    expect(component.showCaptcha()).toBeTrue();
  });

  it('showCaptcha is true when failCount is 9', () => {
    component.failCount.set(9);
    expect(component.showCaptcha()).toBeTrue();
  });

  it('showCaptcha is false when failCount reaches 10', () => {
    component.failCount.set(10);
    expect(component.showCaptcha()).toBeFalse();
  });

  it('showCooldown is false when failCount is 9', () => {
    component.failCount.set(9);
    expect(component.showCooldown()).toBeFalse();
  });

  it('showCooldown is true when failCount reaches 10', () => {
    component.failCount.set(10);
    expect(component.showCooldown()).toBeTrue();
  });

  // ── cooldownDisplay ────────────────────────────────────────────────────────

  it('cooldownDisplay formats 125s as 2:05', () => {
    component.cooldownSeconds.set(125);
    expect(component.cooldownDisplay()).toBe('2:05');
  });

  it('cooldownDisplay pads seconds below 10 with leading zero', () => {
    component.cooldownSeconds.set(65);
    expect(component.cooldownDisplay()).toBe('1:05');
  });

  it('cooldownDisplay shows 0:00 at zero', () => {
    component.cooldownSeconds.set(0);
    expect(component.cooldownDisplay()).toBe('0:00');
  });

  it('cooldownDisplay formats 600s as 10:00', () => {
    component.cooldownSeconds.set(600);
    expect(component.cooldownDisplay()).toBe('10:00');
  });

  // ── principalInputType ─────────────────────────────────────────────────────

  it('principalInputType returns text for username', () => {
    component.loginType.set('username');
    expect(component.principalInputType()).toBe('text');
  });

  it('principalInputType returns email for email', () => {
    component.loginType.set('email');
    expect(component.principalInputType()).toBe('email');
  });

  it('principalInputType returns tel for phone', () => {
    component.loginType.set('phone');
    expect(component.principalInputType()).toBe('tel');
  });

  // ── onSubmit ───────────────────────────────────────────────────────────────

  it('onSubmit does nothing when form is invalid', () => {
    component.onSubmit();
    expect(mockAuthService.login).not.toHaveBeenCalled();
  });

  it('onSubmit calls auth.login with loginType, principal and password', () => {
    mockAuthService.login.and.returnValue(of(makeUser()));
    component.form.patchValue({ principal: 'alice', password: 'secret123' });
    component.onSubmit();
    expect(mockAuthService.login).toHaveBeenCalledWith(
      { loginType: 'username', principal: 'alice', password: 'secret123' },
      undefined,
    );
  });

  it('onSubmit navigates to /account on success with no redirect_uri', async () => {
    const navigateSpy = spyOn(router, 'navigate');
    mockAuthService.login.and.returnValue(of(makeUser()));
    component.form.patchValue({ principal: 'alice', password: 'secret123' });
    component.onSubmit();
    expect(navigateSpy).toHaveBeenCalledWith(['/account']);
  });

  it('onSubmit clears loading on error', () => {
    mockAuthService.login.and.returnValue(
      throwError(() => new ApiError('error.unknown', 'fail', 500)),
    );
    component.form.patchValue({ principal: 'alice', password: 'pw' });
    component.onSubmit();
    expect(component.loading()).toBeFalse();
  });

  it('onSubmit increments failCount on error', () => {
    mockAuthService.login.and.returnValue(
      throwError(() => new ApiError('error.unknown', 'fail', 500)),
    );
    component.form.patchValue({ principal: 'alice', password: 'pw' });
    component.onSubmit();
    expect(component.failCount()).toBe(1);
  });

  // ── error mapping ──────────────────────────────────────────────────────────

  // errorId-based mappings — all use a non-401 status so the 401 fallback
  // does not interfere with the default case.
  const errorMappings: [string, string, number][] = [
    ['error.security.authenticated.bad-credential',            'login.error.badCredential',  401],
    ['error.security.authenticated.invalid-account',           'login.error.invalidAccount', 401],
    ['error.security.authenticated.expired-credential',        'login.error.expiredCredential', 401],
    ['error.common.param.miss-captcha',                        'login.error.missCaptcha',    400],
    ['error.security.authenticated.authenticated.over-attempt','login.error.overAttempt',    429],
    ['error.totally.unknown',                                  'login.error.default',         500],
  ];

  errorMappings.forEach(([errorId, expectedKey, status]) => {
    it(`maps ${errorId} (${status}) → ${expectedKey}`, () => {
      mockAuthService.login.and.returnValue(
        throwError(() => new ApiError(errorId, 'msg', status)),
      );
      component.form.patchValue({ principal: 'alice', password: 'pw' });
      component.onSubmit();
      expect(component.errorMessage()).toBe(expectedKey);
    });
  });

  it('maps unrecognized errorId with 401 → login.error.badCredential', () => {
    mockAuthService.login.and.returnValue(
      throwError(() => new ApiError('error.system.fail', 'Bad authentication information', 401)),
    );
    component.form.patchValue({ principal: 'alice', password: 'pw' });
    component.onSubmit();
    expect(component.errorMessage()).toBe('login.error.badCredential');
  });
});

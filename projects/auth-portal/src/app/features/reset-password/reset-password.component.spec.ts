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

  it('resetType returns email when principal is a valid email', () => {
    component.form.patchValue({ principal: 'u@example.com' });
    expect(component.resetType).toBe('email');
  });

  it('resetType returns phone when principal is an 11-digit phone number', () => {
    component.form.patchValue({ principal: '13800000000' });
    expect(component.resetType).toBe('phone');
  });

  it('marks principal invalid when it is neither email nor phone', () => {
    component.form.patchValue({ principal: 'not-a-contact' });
    expect(component.principalControl.hasError('emailOrPhone')).toBeTrue();
    expect(component.captchaPrincipal).toBe('');
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

  it('form is valid with an 11-digit phone principal', () => {
    component.form.patchValue({
      principal: '13800000000', code: '123456',
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

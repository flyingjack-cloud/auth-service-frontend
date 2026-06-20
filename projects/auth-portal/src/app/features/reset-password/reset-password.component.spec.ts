import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AccountService, ApiError } from '@shared';
import { ResetPasswordComponent } from './reset-password.component';

const dummyLoader = { getTranslation: () => of({}) };

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let mockAccountService: jasmine.SpyObj<Pick<AccountService, 'sendVerificationCode' | 'resetPassword'>>;
  let router: Router;

  beforeEach(async () => {
    mockAccountService = jasmine.createSpyObj('AccountService', [
      'sendVerificationCode', 'resetPassword',
    ]);

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        provideTranslateService({ loader: { provide: TranslateLoader, useValue: dummyLoader } }),
        { provide: AccountService, useValue: mockAccountService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  // ── resetType getter ───────────────────────────────────────────────────────

  it('resetType is email when principal contains @', () => {
    component.form.patchValue({ principal: 'user@example.com' });
    expect(component.resetType).toBe('email');
  });

  it('resetType is phone when principal has no @', () => {
    component.form.patchValue({ principal: '13800138000' });
    expect(component.resetType).toBe('phone');
  });

  it('resetType defaults to phone for empty principal', () => {
    expect(component.resetType).toBe('phone');
  });

  // ── passwordsMatch / passwordsMismatch getters ─────────────────────────────

  it('passwordsMatch returns true when both passwords are equal and non-empty', () => {
    component.form.patchValue({ password: 'pass1234', confirmPassword: 'pass1234' });
    expect(component.passwordsMatch).toBeTrue();
  });

  it('passwordsMatch returns false when passwords differ', () => {
    component.form.patchValue({ password: 'pass1234', confirmPassword: 'different' });
    expect(component.passwordsMatch).toBeFalse();
  });

  it('passwordsMismatch returns true when both filled but differ', () => {
    component.form.patchValue({ password: 'pass1234', confirmPassword: 'different' });
    expect(component.passwordsMismatch).toBeTrue();
  });

  it('passwordsMismatch returns false when passwords match', () => {
    component.form.patchValue({ password: 'pass1234', confirmPassword: 'pass1234' });
    expect(component.passwordsMismatch).toBeFalse();
  });

  it('passwordsMismatch returns false when confirmPassword is empty', () => {
    component.form.patchValue({ password: 'pass1234', confirmPassword: '' });
    expect(component.passwordsMismatch).toBeFalse();
  });

  // ── form cross-field validator ─────────────────────────────────────────────

  it('form has passwordMismatch error when passwords differ', () => {
    component.form.patchValue({
      principal: 'user@example.com',
      code: '123456',
      password: 'pass1234',
      confirmPassword: 'different',
    });
    expect(component.form.hasError('passwordMismatch')).toBeTrue();
  });

  it('form does not have passwordMismatch error when passwords match', () => {
    component.form.patchValue({
      principal: 'user@example.com',
      code: '123456',
      password: 'pass1234',
      confirmPassword: 'pass1234',
    });
    expect(component.form.hasError('passwordMismatch')).toBeFalse();
  });

  // ── sendCode ───────────────────────────────────────────────────────────────

  it('sendCode does nothing when principal is empty', () => {
    component.sendCode();
    expect(mockAccountService.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('sendCode calls sendVerificationCode with detected type and principal', () => {
    mockAccountService.sendVerificationCode.and.returnValue(of(null));
    component.form.patchValue({ principal: 'user@example.com' });
    component.sendCode();
    expect(mockAccountService.sendVerificationCode).toHaveBeenCalledWith('email', 'user@example.com');
  });

  it('sendCode sets codeSent to true on success', () => {
    mockAccountService.sendVerificationCode.and.returnValue(of(null));
    component.form.patchValue({ principal: 'user@example.com' });
    component.sendCode();
    expect(component.codeSent()).toBeTrue();
  });

  it('sendCode starts the 60-second countdown on success', () => {
    mockAccountService.sendVerificationCode.and.returnValue(of(null));
    component.form.patchValue({ principal: 'user@example.com' });
    component.sendCode();
    expect(component.codeCountdown()).toBe(60);
  });

  it('sendCode sets reset.error.sendFailed on failure', () => {
    mockAccountService.sendVerificationCode.and.returnValue(throwError(() => new Error('fail')));
    component.form.patchValue({ principal: 'user@example.com' });
    component.sendCode();
    expect(component.errorMessage()).toBe('reset.error.sendFailed');
  });

  // ── onSubmit ───────────────────────────────────────────────────────────────

  it('onSubmit does nothing when form is invalid', () => {
    component.onSubmit();
    expect(mockAccountService.resetPassword).not.toHaveBeenCalled();
  });

  it('onSubmit calls account.resetPassword with correct payload', () => {
    mockAccountService.resetPassword.and.returnValue(of(null));
    component.form.patchValue({
      principal: 'user@example.com', code: '123456',
      password: 'pass1234', confirmPassword: 'pass1234',
    });
    component.onSubmit();
    expect(mockAccountService.resetPassword).toHaveBeenCalledWith({
      registerType: 'email',
      principal: 'user@example.com',
      password: 'pass1234',
      code: '123456',
    });
  });

  it('onSubmit sets successMessage on success', () => {
    mockAccountService.resetPassword.and.returnValue(of(null));
    component.form.patchValue({
      principal: 'user@example.com', code: '123456',
      password: 'pass1234', confirmPassword: 'pass1234',
    });
    component.onSubmit();
    expect(component.successMessage()).toBe('reset.success');
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
        principal: 'user@example.com', code: '123456',
        password: 'pass1234', confirmPassword: 'pass1234',
      });
      component.onSubmit();
      expect(component.errorMessage()).toBe(expectedKey);
    });
  });
});

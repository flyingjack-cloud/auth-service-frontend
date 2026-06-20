import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AccountService, ApiError } from '@shared';
import { RegisterComponent } from './register.component';

const dummyLoader = { getTranslation: () => of({}) };

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let mockAccountService: jasmine.SpyObj<Pick<AccountService,
    'sendVerificationCode' | 'register' | 'checkEmail' | 'checkPhone' | 'checkUsername'>>;
  let router: Router;

  beforeEach(async () => {
    mockAccountService = jasmine.createSpyObj('AccountService', [
      'sendVerificationCode', 'register', 'checkEmail', 'checkPhone', 'checkUsername',
    ]);
    mockAccountService.checkEmail.and.returnValue(of(false));
    mockAccountService.checkPhone.and.returnValue(of(false));
    mockAccountService.checkUsername.and.returnValue(of(false));

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        provideTranslateService({ loader: { provide: TranslateLoader, useValue: dummyLoader } }),
        { provide: AccountService, useValue: mockAccountService },
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

  // ── canSendCode ────────────────────────────────────────────────────────────

  it('canSendCode is true initially', () => {
    expect(component.canSendCode()).toBeTrue();
  });

  it('canSendCode is false while codeSending', () => {
    component.codeSending.set(true);
    expect(component.canSendCode()).toBeFalse();
  });

  it('canSendCode is false while countdown > 0', () => {
    component.codeCountdown.set(30);
    expect(component.canSendCode()).toBeFalse();
  });

  // ── sendCode ───────────────────────────────────────────────────────────────

  it('sendCode does nothing when principal is empty', () => {
    component.sendCode();
    expect(mockAccountService.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('sendCode calls sendVerificationCode with registerType and principal', () => {
    mockAccountService.sendVerificationCode.and.returnValue(of(null));
    component.form.patchValue({ principal: 'user@example.com' });
    component.sendCode();
    expect(mockAccountService.sendVerificationCode).toHaveBeenCalledWith('email', 'user@example.com');
  });

  it('sendCode starts the 60-second countdown on success', () => {
    mockAccountService.sendVerificationCode.and.returnValue(of(null));
    component.form.patchValue({ principal: 'user@example.com' });
    component.sendCode();
    expect(component.codeCountdown()).toBe(60);
  });

  it('sendCode sets register.error.sendFailed on failure', () => {
    mockAccountService.sendVerificationCode.and.returnValue(throwError(() => new Error('fail')));
    component.form.patchValue({ principal: 'user@example.com' });
    component.sendCode();
    expect(component.errorMessage()).toBe('register.error.sendFailed');
  });

  // ── form validation ────────────────────────────────────────────────────────

  it('form is invalid when code is less than 6 chars', () => {
    component.form.patchValue({
      principal: 'user@example.com', code: '123', username: 'alice1', password: 'pass1234',
    });
    expect(component.form.invalid).toBeTrue();
  });

  it('form is invalid when code is more than 6 chars', () => {
    component.form.patchValue({
      principal: 'user@example.com', code: '1234567', username: 'alice1', password: 'pass1234',
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

  it('username control rejects values longer than 15 chars', () => {
    component.form.patchValue({ username: 'a'.repeat(16) });
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

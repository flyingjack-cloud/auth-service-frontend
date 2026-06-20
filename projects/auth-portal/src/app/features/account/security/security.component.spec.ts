import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AccountService, ApiError } from '@shared';
import { SecurityComponent } from './security.component';

const dummyLoader = { getTranslation: () => of({}) };

describe('SecurityComponent', () => {
  let component: SecurityComponent;
  let mockAccountService: jasmine.SpyObj<Pick<AccountService, 'changePassword'>>;

  beforeEach(async () => {
    mockAccountService = jasmine.createSpyObj('AccountService', ['changePassword']);

    await TestBed.configureTestingModule({
      imports: [SecurityComponent],
      providers: [
        provideAnimationsAsync(),
        provideTranslateService({ loader: { provide: TranslateLoader, useValue: dummyLoader } }),
        { provide: AccountService, useValue: mockAccountService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SecurityComponent);
    component = fixture.componentInstance;
  });

  // ── form validation ────────────────────────────────────────────────────────

  it('form is invalid when fields are empty', () => {
    expect(component.form.invalid).toBeTrue();
  });

  it('form is invalid when newPassword is shorter than 8 chars', () => {
    component.form.patchValue({ oldPassword: 'current1', newPassword: 'short' });
    expect(component.form.invalid).toBeTrue();
  });

  it('form is invalid when newPassword is longer than 16 chars', () => {
    component.form.patchValue({ oldPassword: 'current1', newPassword: 'a'.repeat(17) });
    expect(component.form.invalid).toBeTrue();
  });

  it('form is valid with correct inputs', () => {
    component.form.patchValue({ oldPassword: 'current1', newPassword: 'newpass123' });
    expect(component.form.valid).toBeTrue();
  });

  // ── onSubmit ───────────────────────────────────────────────────────────────

  it('onSubmit does nothing when form is invalid', () => {
    component.onSubmit();
    expect(mockAccountService.changePassword).not.toHaveBeenCalled();
  });

  it('onSubmit calls account.changePassword with correct payload', () => {
    mockAccountService.changePassword.and.returnValue(of(null));
    component.form.patchValue({ oldPassword: 'current1', newPassword: 'newpass123' });
    component.onSubmit();
    expect(mockAccountService.changePassword).toHaveBeenCalledWith({
      oldPassword: 'current1',
      newPassword: 'newpass123',
    });
  });

  it('onSubmit sets successMessage and resets form on success', () => {
    mockAccountService.changePassword.and.returnValue(of(null));
    component.form.patchValue({ oldPassword: 'current1', newPassword: 'newpass123' });
    component.onSubmit();
    expect(component.successMessage()).toBe('security.success');
    expect(component.form.value.oldPassword).toBeNull();
    expect(component.form.value.newPassword).toBeNull();
  });

  it('onSubmit clears loading on success', () => {
    mockAccountService.changePassword.and.returnValue(of(null));
    component.form.patchValue({ oldPassword: 'current1', newPassword: 'newpass123' });
    component.onSubmit();
    expect(component.loading()).toBeFalse();
  });

  // ── error mapping ──────────────────────────────────────────────────────────

  it('sets security.error.wrongPassword for wrong-password errorId', () => {
    mockAccountService.changePassword.and.returnValue(
      throwError(() => new ApiError('error.user.wrong-password', 'Wrong', 400)),
    );
    component.form.patchValue({ oldPassword: 'current1', newPassword: 'newpass123' });
    component.onSubmit();
    expect(component.errorMessage()).toBe('security.error.wrongPassword');
  });

  it('sets security.error.default for any other errorId', () => {
    mockAccountService.changePassword.and.returnValue(
      throwError(() => new ApiError('error.unknown', 'Unknown', 500)),
    );
    component.form.patchValue({ oldPassword: 'current1', newPassword: 'newpass123' });
    component.onSubmit();
    expect(component.errorMessage()).toBe('security.error.default');
  });

  it('clears loading on error', () => {
    mockAccountService.changePassword.and.returnValue(
      throwError(() => new ApiError('error.unknown', 'Unknown', 500)),
    );
    component.form.patchValue({ oldPassword: 'current1', newPassword: 'newpass123' });
    component.onSubmit();
    expect(component.loading()).toBeFalse();
  });
});

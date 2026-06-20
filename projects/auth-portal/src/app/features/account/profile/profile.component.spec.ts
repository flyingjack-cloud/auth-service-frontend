import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AccountService, ApiError, AuthService, User } from '@shared';
import { ProfileComponent } from './profile.component';

const dummyLoader = { getTranslation: () => of({}) };

function makeUser(partial: Partial<User> = {}): User {
  return {
    id: '1', username: 'alice', phone: null, email: null,
    createdAt: '2022-03-15T00:00:00Z',
    ...partial,
  };
}

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let currentUserSignal: ReturnType<typeof signal<User | null>>;
  let mockAuthService: Partial<AuthService>;
  let mockAccountService: jasmine.SpyObj<Pick<AccountService, 'updateProfile'>>;

  beforeEach(async () => {
    currentUserSignal = signal<User | null>(null);
    mockAuthService = {
      currentUser: currentUserSignal.asReadonly(),
      checkLogin: jasmine.createSpy('checkLogin').and.returnValue(of(makeUser())),
    };
    mockAccountService = jasmine.createSpyObj('AccountService', ['updateProfile']);

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideAnimationsAsync(),
        provideTranslateService({ loader: { provide: TranslateLoader, useValue: dummyLoader } }),
        { provide: AuthService, useValue: mockAuthService },
        { provide: AccountService, useValue: mockAccountService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
  });

  // ── initials() ─────────────────────────────────────────────────────────────

  it('initials returns first 2 chars of username uppercased', () => {
    currentUserSignal.set(makeUser({ username: 'alice' }));
    expect(component.initials()).toBe('AL');
  });

  it('initials handles single-char usernames', () => {
    currentUserSignal.set(makeUser({ username: 'a' }));
    expect(component.initials()).toBe('A');
  });

  it('initials returns empty string when user is null', () => {
    currentUserSignal.set(null);
    expect(component.initials()).toBe('');
  });

  // ── memberYear() ───────────────────────────────────────────────────────────

  it('memberYear returns the year from createdAt', () => {
    currentUserSignal.set(makeUser({ createdAt: '2022-03-15T00:00:00Z' }));
    expect(component.memberYear()).toBe('2022');
  });

  it('memberYear returns empty string when user is null', () => {
    currentUserSignal.set(null);
    expect(component.memberYear()).toBe('');
  });

  it('memberYear returns empty string when createdAt is absent', () => {
    currentUserSignal.set(makeUser({ createdAt: undefined }));
    expect(component.memberYear()).toBe('');
  });

  // ── startEdit / cancelEdit ─────────────────────────────────────────────────

  it('startEdit sets editing to true', () => {
    currentUserSignal.set(makeUser());
    component.startEdit();
    expect(component.editing()).toBeTrue();
  });

  it('startEdit populates form with current username', () => {
    currentUserSignal.set(makeUser({ username: 'alice' }));
    component.startEdit();
    expect(component.form.value.username).toBe('alice');
  });

  it('startEdit clears errorMessage', () => {
    component.errorMessage.set('some error');
    currentUserSignal.set(makeUser());
    component.startEdit();
    expect(component.errorMessage()).toBeNull();
  });

  it('cancelEdit sets editing to false', () => {
    component.editing.set(true);
    component.cancelEdit();
    expect(component.editing()).toBeFalse();
  });

  // ── save ───────────────────────────────────────────────────────────────────

  it('save does nothing when form is invalid', () => {
    component.form.patchValue({ username: 'ab' }); // too short
    component.save();
    expect(mockAccountService.updateProfile).not.toHaveBeenCalled();
  });

  it('save calls account.updateProfile with username from form', () => {
    mockAccountService.updateProfile.and.returnValue(of(makeUser({ username: 'bobby' })));
    component.form.patchValue({ username: 'bobby' });
    component.save();
    expect(mockAccountService.updateProfile).toHaveBeenCalledWith({ username: 'bobby' });
  });

  it('save sets editing to false on success', () => {
    mockAccountService.updateProfile.and.returnValue(of(makeUser()));
    component.editing.set(true);
    component.form.patchValue({ username: 'alice1' });
    component.save();
    expect(component.editing()).toBeFalse();
  });

  it('save clears loading on success', () => {
    mockAccountService.updateProfile.and.returnValue(of(makeUser()));
    component.form.patchValue({ username: 'alice1' });
    component.save();
    expect(component.loading()).toBeFalse();
  });

  it('save sets profile.error.conflict for conflict errorId', () => {
    mockAccountService.updateProfile.and.returnValue(
      throwError(() => new ApiError('error.business.conflict', 'Conflict', 409)),
    );
    component.form.patchValue({ username: 'alice1' });
    component.save();
    expect(component.errorMessage()).toBe('profile.error.conflict');
  });

  it('save sets profile.error.default for other errors', () => {
    mockAccountService.updateProfile.and.returnValue(
      throwError(() => new ApiError('error.unknown', 'Unknown', 500)),
    );
    component.form.patchValue({ username: 'alice1' });
    component.save();
    expect(component.errorMessage()).toBe('profile.error.default');
  });
});

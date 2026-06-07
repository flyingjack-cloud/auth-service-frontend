import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { User } from '../models/user.model';

const MOCK_USER: User = { id: '1', username: 'alice', phone: null, email: 'alice@test.com' };

describe('AuthService', () => {
  let service: AuthService;
  let mock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  it('starts with null currentUser and isLoggedIn = false', () => {
    expect(service.currentUser()).toBeNull();
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('checkLogin sets currentUser on success', (done) => {
    service.checkLogin().subscribe(() => {
      expect(service.currentUser()).toEqual(MOCK_USER);
      expect(service.isLoggedIn()).toBeTrue();
      done();
    });
    mock.expectOne('/account/check-login').flush(MOCK_USER);
  });

  it('login sets currentUser', (done) => {
    service.login({ loginType: 'username', principal: 'alice', password: 'pw' }).subscribe(() => {
      expect(service.currentUser()).toEqual(MOCK_USER);
      done();
    });
    mock.expectOne('/account/login').flush(MOCK_USER);
  });

  it('login with captcha sends X-Captcha-* headers', (done) => {
    service.login(
      { loginType: 'username', principal: 'alice', password: 'pw' },
      { id: 'cap-id-123', token: '456789' }
    ).subscribe(() => done());

    const req = mock.expectOne('/account/login');
    expect(req.request.headers.get('X-Captcha-ID')).toBe('cap-id-123');
    expect(req.request.headers.get('X-Captcha-Token')).toBe('456789');
    req.flush(MOCK_USER);
  });

  it('logout clears currentUser', (done) => {
    // Pre-seed: log in first
    service.login({ loginType: 'username', principal: 'alice', password: 'pw' }).subscribe(() => {
      // Now log out
      service.logout().subscribe(() => {
        expect(service.currentUser()).toBeNull();
        expect(service.isLoggedIn()).toBeFalse();
        done();
      });
      mock.expectOne('/account/logout').flush(null);
    });
    mock.expectOne('/account/login').flush(MOCK_USER);
  });

  it('checkLogin leaves currentUser null on 401', (done) => {
    service.checkLogin().subscribe({
      error: () => {
        expect(service.currentUser()).toBeNull();
        expect(service.isLoggedIn()).toBeFalse();
        done();
      }
    });
    mock.expectOne('/account/check-login').flush(
      { code: 401, message: '用户未登录', data: null },
      { status: 401, statusText: 'Unauthorized' }
    );
  });
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TwoFaService } from './two-fa.service';
import { User } from '../models/user.model';

const MOCK_USER: User = { id: '1', username: 'alice', phone: null, email: 'alice@test.com' };

describe('TwoFaService', () => {
  let service: TwoFaService;
  let mock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TwoFaService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TwoFaService);
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  it('verify() POSTs to /account/2fa/verify with pendingToken and code', (done) => {
    service.verify({ pendingToken: 'tok-abc', code: '123456' }).subscribe(user => {
      expect(user).toEqual(MOCK_USER);
      done();
    });
    const req = mock.expectOne('/account/2fa/verify');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ pendingToken: 'tok-abc', code: '123456' });
    req.flush(MOCK_USER);
  });

  it('setup() POSTs to /account/2fa/setup and returns otpAuthUri', (done) => {
    service.setup().subscribe(res => {
      expect(res.otpAuthUri).toBe('otpauth://totp/test');
      done();
    });
    const req = mock.expectOne('/account/2fa/setup');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ otpAuthUri: 'otpauth://totp/test' });
  });

  it('confirm() POSTs to /account/2fa/confirm with code', (done) => {
    service.confirm({ code: '654321' }).subscribe(() => done());
    const req = mock.expectOne('/account/2fa/confirm');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: '654321' });
    req.flush(null);
  });

  it('disable() DELETEs /account/2fa with password and code in body', (done) => {
    service.disable({ password: 'mypass', code: '111222' }).subscribe(() => done());
    const req = mock.expectOne('/account/2fa');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ password: 'mypass', code: '111222' });
    req.flush(null);
  });
});

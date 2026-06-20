import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiInterceptor } from './api.interceptor';
import { ENVIRONMENT } from '../tokens/environment.token';
import { ApiError } from '../models/api-error.model';

const ENV_AUTH = { apiBaseUrl: 'http://localhost:9001' };

describe('apiInterceptor', () => {
  let http: HttpClient;
  let mock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        { provide: ENVIRONMENT, useValue: ENV_AUTH },
      ],
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  it('prepends apiBaseUrl and sets withCredentials', () => {
    http.get('/account/check-login').subscribe();
    const req = mock.expectOne('http://localhost:9001/account/check-login');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ code: 200, message: 'OK', data: { id: '1' }, timestamp: 0 });
  });

  it('unwraps the data field from a successful response', (done) => {
    http.get<{ id: string }>('/account/profile').subscribe(result => {
      expect(result).toEqual({ id: '42', username: 'alice' } as any);
      done();
    });
    mock.expectOne('http://localhost:9001/account/profile').flush({
      code: 200, message: 'OK', data: { id: '42', username: 'alice' }, timestamp: 0,
    });
  });

  it('throws ApiError with errorId and httpStatus on 4xx', (done) => {
    http.get('/account/profile').subscribe({
      error: (err: ApiError) => {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.httpStatus).toBe(401);
        expect(err.errorId).toBe('error.security.authenticated.bad-credential');
        done();
      },
    });
    mock.expectOne('http://localhost:9001/account/profile').flush(
      { code: 401, message: '凭证错误', errorId: 'error.security.authenticated.bad-credential', data: null },
      { status: 401, statusText: 'Unauthorized' }
    );
  });

  it('falls back to error.system.fail errorId when none is provided', (done) => {
    http.get('/account/profile').subscribe({
      error: (err: ApiError) => {
        expect(err.errorId).toBe('error.system.fail');
        done();
      },
    });
    mock.expectOne('http://localhost:9001/account/profile').flush(
      { code: 500, message: '系统错误', data: null },
      { status: 500, statusText: 'Server Error' }
    );
  });
});

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
    expect(req.request.withCredentials).toBeTrue();
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
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ code: 200, message: 'OK', data: null, timestamp: 0 });
    m.verify();
  });
});

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

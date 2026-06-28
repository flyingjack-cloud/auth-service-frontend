import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { TwoFaVerifyComponent } from './two-fa-verify.component';
import { ENVIRONMENT, apiInterceptor } from '@shared';

const dummyLoader = { getTranslation: () => of({}) };

describe('TwoFaVerifyComponent', () => {
  let fixture: ComponentFixture<TwoFaVerifyComponent>;
  let router: Router;
  let mock: HttpTestingController;

  function setup(stateOverride: object = { pendingToken: 'tok-123' }) {
    spyOnProperty(history, 'state', 'get').and.returnValue(stateOverride);
    TestBed.configureTestingModule({
      imports: [TwoFaVerifyComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useValue: dummyLoader } }),
        { provide: ENVIRONMENT, useValue: { apiBaseUrl: 'http://localhost:9001' } },
      ],
    });
    router = TestBed.inject(Router);
    mock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TwoFaVerifyComponent);
    fixture.detectChanges();
  }

  afterEach(() => mock.verify());

  it('redirects to /login when pendingToken is absent', async () => {
    spyOnProperty(history, 'state', 'get').and.returnValue({});
    TestBed.configureTestingModule({
      imports: [TwoFaVerifyComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useValue: dummyLoader } }),
        { provide: ENVIRONMENT, useValue: { apiBaseUrl: 'http://localhost:9001' } },
      ],
    });
    router = TestBed.inject(Router);
    mock = TestBed.inject(HttpTestingController);
    spyOn(router, 'navigate');
    fixture = TestBed.createComponent(TwoFaVerifyComponent);
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('renders the TOTP input when pendingToken is present', () => {
    setup();
    const input = fixture.nativeElement.querySelector('input[formControlName="code"]');
    expect(input).toBeTruthy();
  });

  it('submits verify request and navigates to /account on success', async () => {
    setup();
    spyOn(router, 'navigate');
    const input = fixture.nativeElement.querySelector('input[formControlName="code"]');
    input.value = '123456';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const req = mock.expectOne('http://localhost:9001/account/2fa/verify');
    expect(req.request.body).toEqual({ pendingToken: 'tok-123', code: '123456' });
    req.flush({ id: '1', username: 'alice', phone: null, email: null });
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/account']);
  });

  it('shows inline error on invalid-code, does not navigate', () => {
    setup();
    spyOn(router, 'navigate');
    const input = fixture.nativeElement.querySelector('input[formControlName="code"]');
    input.value = '000000';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    mock.expectOne('http://localhost:9001/account/2fa/verify').flush(
      { errorId: 'error.2fa.invalid-code', message: 'bad' },
      { status: 401, statusText: 'Unauthorized' }
    );
    fixture.detectChanges();
    expect(router.navigate).not.toHaveBeenCalledWith(['/login']);
  });
});

import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ApiError } from '../../models/api-error.model';
import { CaptchaService } from '../../services/captcha.service';
import { CodeCaptchaFieldComponent } from './code-captcha-field.component';

const dummyLoader = { getTranslation: () => of({}) };

describe('CodeCaptchaFieldComponent', () => {
  let mockCaptchaService: {
    sendSmsCaptcha: jasmine.Spy;
    sendEmailCaptcha: jasmine.Spy;
  };

  const setup = async (type: 'phone' | 'email' = 'email', principal = 'u@example.com') => {
    mockCaptchaService = {
      sendSmsCaptcha: jasmine.createSpy('sendSmsCaptcha'),
      sendEmailCaptcha: jasmine.createSpy('sendEmailCaptcha'),
    };
    await TestBed.configureTestingModule({
      imports: [CodeCaptchaFieldComponent],
      providers: [
        provideAnimationsAsync(),
        provideTranslateService({ loader: { provide: TranslateLoader, useValue: dummyLoader } }),
        { provide: CaptchaService, useValue: mockCaptchaService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CodeCaptchaFieldComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('control', new FormControl(''));
    fixture.componentRef.setInput('type', type);
    fixture.componentRef.setInput('principal', principal);
    fixture.detectChanges();
    return { fixture, component };
  };

  it('canSend is true initially', async () => {
    const { component } = await setup();
    expect(component.canSend()).toBeTrue();
  });

  it('canSend is false while sending', async () => {
    const { component } = await setup('email');
    mockCaptchaService.sendEmailCaptcha.and.returnValue(of(true));
    component.sending.set(true);
    expect(component.canSend()).toBeFalse();
  });

  it('send calls sendEmailCaptcha with principal for email type', async () => {
    const { component } = await setup('email', 'u@example.com');
    mockCaptchaService.sendEmailCaptcha.and.returnValue(of(true));
    component.send();
    expect(mockCaptchaService.sendEmailCaptcha).toHaveBeenCalledWith('u@example.com');
    expect(mockCaptchaService.sendSmsCaptcha).not.toHaveBeenCalled();
  });

  it('send calls sendSmsCaptcha with principal for phone type', async () => {
    const { component } = await setup('phone', '13800000000');
    mockCaptchaService.sendSmsCaptcha.and.returnValue(of(true));
    component.send();
    expect(mockCaptchaService.sendSmsCaptcha).toHaveBeenCalledWith('13800000000');
    expect(mockCaptchaService.sendEmailCaptcha).not.toHaveBeenCalled();
  });

  it('starts a 30-second countdown for email', fakeAsync(async () => {
    const { component } = await setup('email');
    mockCaptchaService.sendEmailCaptcha.and.returnValue(of(true));
    component.send();
    expect(component.countdown()).toBe(30);
    tick(30000);
    expect(component.countdown()).toBe(0);
  }));

  it('starts a 60-second countdown for phone', fakeAsync(async () => {
    const { component } = await setup('phone', '13800000000');
    mockCaptchaService.sendSmsCaptcha.and.returnValue(of(true));
    component.send();
    expect(component.countdown()).toBe(60);
    tick(60000);
    expect(component.countdown()).toBe(0);
  }));

  it('canSend is false during countdown', fakeAsync(async () => {
    const { component } = await setup('email');
    mockCaptchaService.sendEmailCaptcha.and.returnValue(of(true));
    component.send();
    expect(component.canSend()).toBeFalse();
    tick(30000);
    expect(component.canSend()).toBeTrue();
  }));

  it('sets captcha.tooManyRequests on 429 error', async () => {
    const { component } = await setup('email');
    mockCaptchaService.sendEmailCaptcha.and.returnValue(
      throwError(() => new ApiError('error.system', 'Too many', 429)),
    );
    component.send();
    expect(component.sendError()).toBe('captcha.tooManyRequests');
  });

  it('sets captcha.sendFailed on non-429 error', async () => {
    const { component } = await setup('email');
    mockCaptchaService.sendEmailCaptcha.and.returnValue(
      throwError(() => new ApiError('error.system.fail', 'Error', 500)),
    );
    component.send();
    expect(component.sendError()).toBe('captcha.sendFailed');
  });

  it('does nothing when principal is empty', async () => {
    const { component } = await setup('email', '');
    component.send();
    expect(mockCaptchaService.sendEmailCaptcha).not.toHaveBeenCalled();
  });
});

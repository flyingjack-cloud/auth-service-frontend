import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { CaptchaService } from '../../services/captcha.service';
import { ImageCaptchaFieldComponent } from './image-captcha-field.component';

const dummyLoader = { getTranslation: () => of({}) };

describe('ImageCaptchaFieldComponent', () => {
  let mockCaptchaService: { getImageCaptcha: jasmine.Spy };

  const setup = async (getImageCaptchaReturn = of({ uuid: 'uuid-1', base64Image: 'abc=' })) => {
    mockCaptchaService = {
      getImageCaptcha: jasmine.createSpy('getImageCaptcha').and.returnValue(getImageCaptchaReturn),
    };
    await TestBed.configureTestingModule({
      imports: [ImageCaptchaFieldComponent],
      providers: [
        provideAnimationsAsync(),
        provideTranslateService({ loader: { provide: TranslateLoader, useValue: dummyLoader } }),
        { provide: CaptchaService, useValue: mockCaptchaService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ImageCaptchaFieldComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('control', new FormControl(''));
    return { fixture, component };
  };

  it('calls getImageCaptcha on init', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();
    expect(mockCaptchaService.getImageCaptcha).toHaveBeenCalledTimes(1);
  });

  it('sets imageDataUrl from base64Image on success', async () => {
    const { fixture, component } = await setup();
    fixture.detectChanges();
    expect(component.imageDataUrl()).toBe('data:image/png;base64,abc=');
  });

  it('emits captchaId with uuid on success', async () => {
    const { fixture, component } = await setup();
    const emitted: string[] = [];
    component.captchaId.subscribe(id => emitted.push(id));
    fixture.detectChanges();
    expect(emitted).toEqual(['uuid-1']);
  });

  it('sets loading to false after success', async () => {
    const { fixture, component } = await setup();
    fixture.detectChanges();
    expect(component.loading()).toBeFalse();
  });

  it('sets error to true on fetch failure', async () => {
    const { fixture, component } = await setup(throwError(() => new Error('network')));
    fixture.detectChanges();
    expect(component.error()).toBeTrue();
    expect(component.loading()).toBeFalse();
  });

  it('refresh re-fetches and emits new uuid', async () => {
    const { fixture, component } = await setup();
    const emitted: string[] = [];
    component.captchaId.subscribe(id => emitted.push(id));
    fixture.detectChanges(); // first fetch → uuid-1

    mockCaptchaService.getImageCaptcha.and.returnValue(of({ uuid: 'uuid-2', base64Image: 'xyz=' }));
    component.refresh();

    expect(emitted).toEqual(['uuid-1', 'uuid-2']);
    expect(component.imageDataUrl()).toBe('data:image/png;base64,xyz=');
  });

  it('refresh resets the bound FormControl', async () => {
    const { fixture, component } = await setup();
    const ctrl = new FormControl('old-value');
    fixture.componentRef.setInput('control', ctrl);
    fixture.detectChanges();

    component.refresh();
    expect(ctrl.value).toBeNull();
  });
});

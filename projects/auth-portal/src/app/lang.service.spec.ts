import { TestBed } from '@angular/core/testing';
import { TranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LangService } from './lang.service';

const dummyLoader = { getTranslation: () => of({}) };

function setup(): LangService {
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useValue: dummyLoader } }),
    ],
  });
  return TestBed.inject(LangService);
}

describe('LangService', () => {
  beforeEach(() => localStorage.removeItem('lang'));

  it('defaults to zh when localStorage is empty', () => {
    expect(setup().currentLang()).toBe('zh');
  });

  it('reads initial lang from localStorage', () => {
    localStorage.setItem('lang', 'en');
    expect(setup().currentLang()).toBe('en');
  });

  it('toggle switches zh to en', () => {
    const svc = setup();
    svc.toggle();
    expect(svc.currentLang()).toBe('en');
  });

  it('toggle switches en back to zh', () => {
    const svc = setup();
    svc.toggle();
    svc.toggle();
    expect(svc.currentLang()).toBe('zh');
  });

  it('toggle persists lang to localStorage', () => {
    const svc = setup();
    svc.toggle();
    expect(localStorage.getItem('lang')).toBe('en');
  });
});

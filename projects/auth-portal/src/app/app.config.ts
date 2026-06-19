import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideZoneChangeDetection,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { TranslateLoader, TranslationObject, provideTranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs';
import { routes } from './app.routes';
import { apiInterceptor, ENVIRONMENT, AuthService } from '@shared';
import { environment } from '../environments/environment';
import zhTranslations from '../assets/i18n/zh.json';
import enTranslations from '../assets/i18n/en.json';

// Inline loader — bundles translations at build time so no HTTP request is
// needed and the apiInterceptor cannot interfere.
class InlineTranslateLoader implements TranslateLoader {
  private readonly map: Record<string, TranslationObject> = {
    zh: zhTranslations as TranslationObject,
    en: enTranslations as TranslationObject,
  };
  getTranslation(lang: string): Observable<TranslationObject> {
    return of(this.map[lang] ?? this.map['zh']);
  }
}

function initAuth(authService: AuthService) {
  return () => authService.checkLogin().pipe(catchError(() => of(null)));
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiInterceptor])),
    provideAnimationsAsync(),
    provideBrowserGlobalErrorListeners(),
    { provide: ENVIRONMENT, useValue: environment },
    { provide: APP_INITIALIZER, useFactory: initAuth, deps: [AuthService], multi: true },
    provideTranslateService({
      fallbackLang: 'zh',
      lang: 'zh',
      loader: { provide: TranslateLoader, useClass: InlineTranslateLoader },
    }),
  ],
};

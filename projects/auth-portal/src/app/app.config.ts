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
import { Observable, from } from 'rxjs';
import { catchError, of } from 'rxjs';
import { routes } from './app.routes';
import { apiInterceptor, ENVIRONMENT, AuthService } from '@shared';
import { environment } from '../environments/environment';

// Uses fetch instead of HttpClient so the apiInterceptor (which prepends
// apiBaseUrl to every request) does not intercept translation file loads.
class AssetTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return from(fetch(`assets/i18n/${lang}.json`).then(r => r.json()));
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
      loader: { provide: TranslateLoader, useClass: AssetTranslateLoader },
    }),
  ],
};

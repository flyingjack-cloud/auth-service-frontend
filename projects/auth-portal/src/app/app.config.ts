import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideZoneChangeDetection,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { catchError, of } from 'rxjs';
import { routes } from './app.routes';
import { apiInterceptor, ENVIRONMENT, AuthService } from '@shared';
import { environment } from '../environments/environment';

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
    provideTranslateService({ fallbackLang: 'zh', lang: 'zh' }),
    provideTranslateHttpLoader({ prefix: './assets/i18n/', suffix: '.json' }),
  ],
};

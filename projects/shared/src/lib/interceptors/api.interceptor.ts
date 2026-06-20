import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ENVIRONMENT } from '../tokens/environment.token';
import { ApiResponse } from '../models/api-response.model';
import { ApiError } from '../models/api-error.model';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const env = inject(ENVIRONMENT);

  const isThirdParty = req.url.startsWith('/captcha/') && !!env.thirdPartyBaseUrl;
  const baseUrl = isThirdParty ? env.thirdPartyBaseUrl! : env.apiBaseUrl;

  const apiReq = req.clone({
    url: `${baseUrl.replace(/\/$/, '')}${req.url}`,
    withCredentials: true,
  });

  return next(apiReq).pipe(
    map(event => {
      if (event instanceof HttpResponse && event.body !== null) {
        const body = event.body as ApiResponse<unknown>;
        return event.clone({ body: body.data });
      }
      return event;
    }),
    catchError(error => {
      const err = error.error ?? {};
      const errorId: string = err['errorId'] ?? 'error.system.fail';
      const message: string = err['message'] ?? 'An unexpected error occurred';
      return throwError(() => new ApiError(errorId, message, error.status ?? 0));
    })
  );
};
